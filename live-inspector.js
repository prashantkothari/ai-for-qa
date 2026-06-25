/* live-inspector.js — point self-heal at any rendered page.
 *
 * Inject via DevTools console (or a bookmarklet, or Chrome MCP). Reads the live DOM, builds
 * a descriptor per visible interactive control, classifies anchor tier + predicted robustness,
 * then SIMULATES restyle+structure and localization drifts on a clone of the rendered HTML and
 * reports per-element verdicts (heal / abstain / fail / false-heal). Aggregates into a page
 * scorecard (anchor mix, recordability %, duplicates, portals).
 *
 * Self-contained on purpose: cross-origin pages block external <script src> loads, so we port
 * the relevant pieces of selfheal-core.js inline. Same weights (DEF), same thresholds
 * (.62 / .12 margin / .45), same hardened fuzzy as the tested core — so any number this
 * inspector prints is comparable to the test-suite numbers.
 *
 * Usage:
 *   <paste this whole file in DevTools console on any page>
 *   window.__SELFHEAL_RESULT  // structured result
 */
window.__SELFHEAL_INSPECT = (function(){
  // ---- ported extraction (verbatim mechanics from selfheal-core.js WEB) ----
  const cssEsc = s => (window.CSS&&CSS.escape) ? CSS.escape(s) : String(s).replace(/["\\]/g,'\\$&');
  const roleOf = el => { const t=el.tagName.toLowerCase(), ty=(el.getAttribute('type')||'').toLowerCase();
    if(el.getAttribute('role')) return el.getAttribute('role');
    if(t==='a')return'link'; if(t==='button')return'button'; if(t==='select')return'combobox'; if(t==='textarea')return'textbox';
    if(t==='input'){ if(['submit','button','reset','image'].includes(ty))return'button'; if(ty==='checkbox')return'checkbox'; if(ty==='radio')return'radio'; return'textbox'; }
    return t; };
  const nameOf = (el,doc) => { const a=el.getAttribute('aria-label'); if(a)return a.trim();
    const id=el.getAttribute('id'); if(id){ try{ const lb=doc.querySelector('label[for="'+cssEsc(id)+'"]'); if(lb)return lb.textContent.trim(); }catch(e){} }
    const v=el.getAttribute('value'); if(v)return v.trim();
    const t=(el.textContent||'').replace(/\s+/g,' ').trim(); if(t&&t.length<=40)return t;
    return (el.getAttribute('placeholder')||'').trim(); };
  const looksHashed = s => { if(!s)return false; return /[0-9a-f]{6,}/i.test(s)||/^(css-|sc-|jsx-|emotion-)/.test(s)||/:r[0-9a-z]+:/.test(s)||/__|\d{3,}/.test(s)||(/[a-z]/i.test(s)&&/\d/.test(s)&&s.length>=8&&!/[ _]/.test(s)); };
  const testid = el => { for(const a of ['data-testid','data-test','data-qa','data-cy','data-automation']){ const v=el.getAttribute(a); if(v)return v; } return null; };
  const extract = (el,doc) => { const f=el.closest&&el.closest('form'); return {
    role:roleOf(el), tag:el.tagName.toLowerCase(), name:nameOf(el,doc),
    nameAttr:el.getAttribute('name'), type:el.getAttribute('type'), autocomplete:el.getAttribute('autocomplete'),
    testid:testid(el), id:el.getAttribute('id'), cls:(el.getAttribute('class')||'').trim()||null,
    inForm:f?true:null, formAction:f?f.getAttribute('action'):null }; };
  const DEF  = {role:.9,tag:.5,name:.5,nameAttr:.85,type:.7,autocomplete:.8,testid:.95,id:.7,cls:.2,inForm:.75,formAction:.7};
  const DURA = {testid:1,role:.95,nameAttr:.9,autocomplete:.9,formAction:.85,inForm:.8,type:.8,id:.8,name:.55,tag:.4,cls:.1};
  const buildDescriptor = (el,doc) => { const ex=extract(el,doc), sig={};
    for(const k in ex){ const v=ex[k]; if(v==null||v==='')continue; let st=DEF[k]; if(st==null)continue;
      if(k==='id'&&looksHashed(v))st=.2; if(k==='cls'&&looksHashed(v))st=.08; sig[k]={value:v,stability:st}; }
    return {signals:sig}; };
  const tok = s => (s==null?'':String(s)).toLowerCase().split(/[^a-z0-9]+/i).filter(Boolean);
  // HARDENED fuzzy (Phase 0.5 fix): substring boost gated on token overlap
  const fuzzy = (a,b) => { if(a==null||b==null)return 0; a=String(a);b=String(b); if(a===b)return 1;
    const A=new Set(tok(a)),B=new Set(tok(b)); if(!A.size||!B.size)return 0;
    let i=0;A.forEach(x=>{if(B.has(x))i++;}); const u=new Set([...A,...B]).size; const jac=i/u;
    const sub=(a.toLowerCase().includes(b.toLowerCase())||b.toLowerCase().includes(a.toLowerCase()));
    return Math.max(jac, (jac>0&&sub)?0.85:0); };
  const mv = (k,cv,sv) => (k==='name'||k==='cls') ? fuzzy(cv,sv) : (cv!=null&&String(cv)===String(sv))?1:0;
  const scoreEx = (ex,desc) => { let n=0,d=0; for(const k in desc.signals){ const{value,stability}=desc.signals[k]; n+=mv(k,ex[k],value)*stability; d+=stability; } return d?n/d:0; };
  const verdict = ranked => { const b=ranked[0], s=ranked[1]; const m=b.conf-(s?s.conf:0);
    let v; if(b.conf>=.62 && m>=.12) v='heal'; else if(b.conf>=.45) v='abstain'; else v='fail';
    return {v, best:b, margin:m}; };
  const predicted = desc => { let n=0,t=0; for(const k in desc.signals){ const s=desc.signals[k]; let du=DURA[k]!=null?DURA[k]:.5; if(k==='id'&&looksHashed(s.value))du=.15; n+=s.stability*du; t+=s.stability; } return t?n/t:0; };
  const candidates = doc => [...doc.querySelectorAll('input,button,a,select,textarea,[role]')].filter(el => (el.getAttribute('type')||'')!=='hidden');
  const isVisible = el => { try{ const cs=getComputedStyle(el); if(cs.display==='none'||cs.visibility==='hidden'||cs.opacity==='0')return false; const r=el.getBoundingClientRect(); return r.width>1&&r.height>1; }catch(e){ return false; } };
  const anchorOf = ex => { if(ex.testid)return'testid'; if(ex.id&&!looksHashed(ex.id))return'stable-id';
    if(ex.id&&looksHashed(ex.id)&&/[-_:][A-Za-z]{3,}/.test(ex.id))return'id-fragment';
    if(ex.nameAttr)return'form-name'; if(ex.autocomplete)return'autocomplete';
    if(ex.name)return'name-only'; return'none'; };

  // ---- drift mutators (act on a cloned DOMParser doc, not the live page) ----
  const rng = seed => () => { seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
  const revWords = s => s.replace(/[A-Za-z0-9À-ɏ]+/g, w => w.split('').reverse().join(''));
  const parseHTML = h => { const d=new DOMParser().parseFromString(h,'text/html'); d.querySelectorAll('script,style,noscript').forEach(n=>n.remove()); return d; };
  const mutate = (doc, mode) => {
    const r = rng(mode==='restyle' ? 777 : 888);
    doc.querySelectorAll('*').forEach(el => {
      if(el.hasAttribute('class')) el.setAttribute('class','c'+Math.floor(r()*1e9).toString(36));
      const id = el.getAttribute('id');
      if(id && looksHashed(id)){
        const m = id.match(/[-_:]([A-Za-z]{3,}[A-Za-z0-9_-]*)$/); const suffix = m?m[1]:'';
        const newId = 'g'+Math.floor(r()*1e9).toString(36)+(suffix?'-'+suffix:'');
        const lbls = doc.querySelectorAll('label[for="'+cssEsc(id)+'"]'); el.setAttribute('id', newId); lbls.forEach(l=>l.setAttribute('for', newId));
      }
    });
    if(mode==='localize'){
      const w = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null); const texts=[]; let n;
      while(n=w.nextNode()){ if(n.nodeValue&&n.nodeValue.trim()) texts.push(n); }
      texts.forEach(t => { t.nodeValue = revWords(t.nodeValue); });
      doc.querySelectorAll('[aria-label]').forEach(el => el.setAttribute('aria-label', revWords(el.getAttribute('aria-label'))));
      doc.querySelectorAll('[placeholder]').forEach(el => el.setAttribute('placeholder', revWords(el.getAttribute('placeholder'))));
      doc.querySelectorAll('[title]').forEach(el => el.setAttribute('title', revWords(el.getAttribute('title'))));
      doc.querySelectorAll('input[type=submit],input[type=button],input[type=reset]').forEach(el => { if(el.getAttribute('value')) el.setAttribute('value', revWords(el.getAttribute('value'))); });
    }
    return doc;
  };

  // ---- duplicate detection on the LIVE page (offsetParent-aware) ----
  function detectDuplicates(els){
    const byKey = {};
    els.forEach(el => { const ex = extract(el, document); const key = (ex.role||'') + '::' + ((ex.name||'').slice(0,32));
      if(!key.endsWith('::')) (byKey[key] = byKey[key] || []).push(el); });
    return Object.entries(byKey).filter(([_,xs]) => xs.length>1)
      .map(([k,xs]) => ({key:k, total:xs.length, visible: xs.filter(isVisible).length}))
      .filter(d => d.visible > 1);  // only ACTUAL duplicate-render problems (both visible)
  }

  // ---- portal/overlay heuristic (top-level mounts that aren't ancestor-linked to triggers) ----
  function detectPortals(){
    const out=[];
    document.querySelectorAll('body > *').forEach(el => {
      const role = el.getAttribute('role');
      const innerOverlays = el.querySelectorAll('[role=menu],[role=listbox],[role=dialog],[role=tooltip]').length;
      if(innerOverlays > 0 || ['dialog','menu','tooltip','listbox'].includes(role||'')){
        out.push({tag:el.tagName.toLowerCase(), id:el.id||'', role: role||'', innerOverlays});
      }
    });
    return out;
  }

  // ---- main scan ----
  function scan(opts){
    opts = opts || {}; const maxSamples = opts.maxSamples || 60;
    const live = candidates(document).filter(isVisible);

    // per-element analysis
    const mix = {};
    const rows = live.map((el, idx) => {
      const ex = extract(el, document); const desc = buildDescriptor(el, document);
      const anchor = anchorOf(ex); mix[anchor] = (mix[anchor]||0) + 1;
      return { idx, el, ex, desc, anchor,
        robust: Math.round(predicted(desc)*100),
        name: (ex.name||'').slice(0,32), role: ex.role };
    });

    // sample for drift simulation — stratified by anchor tier so every regime is covered
    document.querySelectorAll('[data-oracle-inspect]').forEach(el => el.removeAttribute('data-oracle-inspect'));
    const byA = {}; rows.forEach((r,i) => (byA[r.anchor] = byA[r.anchor] || []).push(i));
    const picked = []; Object.keys(byA).forEach(a => picked.push(...byA[a].slice(0, Math.min(8, byA[a].length))));
    const remaining = rows.map((_,i)=>i).filter(i => !picked.includes(i));
    while(picked.length < Math.min(maxSamples, rows.length) && remaining.length){
      picked.push(remaining.splice(Math.floor(Math.random()*remaining.length), 1)[0]); }
    picked.forEach((idx, k) => rows[idx].el.setAttribute('data-oracle-inspect','o'+k));

    const html = document.documentElement.outerHTML;
    const sampleDescs = picked.map((idx, k) => ({oid:'o'+k, desc:rows[idx].desc, idx}));

    function runDrift(mode){
      const md = mutate(parseHTML(html), mode);
      const cands = candidates(md);
      const results = sampleDescs.map(s => {
        const ranked = cands.map(el => ({el, ex:extract(el,md), conf:scoreEx(extract(el,md), s.desc)})).sort((a,b)=>b.conf-a.conf);
        const v = verdict(ranked); const bestOracle = v.best.el.getAttribute('data-oracle-inspect');
        let outcome; if(v.v==='heal') outcome = (bestOracle === s.oid) ? 'correct-heal' : 'false-heal'; else outcome = v.v;
        return {oid:s.oid, idx:s.idx, outcome, conf:+v.best.conf.toFixed(2), margin:+v.margin.toFixed(2)};
      });
      const t = {correctHeal:0, falseHeal:0, abstain:0, fail:0};
      results.forEach(r => { if(r.outcome==='correct-heal')t.correctHeal++; else if(r.outcome==='false-heal')t.falseHeal++; else if(r.outcome==='abstain')t.abstain++; else t.fail++; });
      return {mode, tally:t, n:results.length, results};
    }
    const restyle = runDrift('restyle'); const localize = runDrift('localize');
    // attach drift outcomes back to rows for narrative
    picked.forEach((idx, k) => { rows[idx].restyle = restyle.results.find(x => x.oid==='o'+k); rows[idx].localize = localize.results.find(x => x.oid==='o'+k); });

    // cleanup
    document.querySelectorAll('[data-oracle-inspect]').forEach(el => el.removeAttribute('data-oracle-inspect'));

    // page scorecard
    const duplicates = detectDuplicates(live); const portals = detectPortals();
    const strongAnchors = (mix.testid||0) + (mix['stable-id']||0) + (mix['id-fragment']||0);
    const recordability = live.length ? Math.round(100 * strongAnchors / live.length) : 0;

    // narrative examples — one per anchor tier
    const order = ['testid','stable-id','id-fragment','form-name','autocomplete','name-only','none'];
    const examples = order.map(a => {
      const r = rows.find(r => r.anchor===a && r.restyle);
      if(!r) return null;
      return { anchor:a, role:r.role, name:r.name, robustness:r.robust,
        restyle: r.restyle.outcome+'@conf='+r.restyle.conf, localize: r.localize.outcome+'@conf='+r.localize.conf };
    }).filter(Boolean);

    return {
      scorecard: {
        url: location.href, title: document.title.slice(0,80),
        visibleInteractive: live.length, anchorMix: mix,
        strongAnchors, recordability_pct: recordability,
        duplicates_both_visible: duplicates.length, duplicateTop3: duplicates.sort((a,b)=>b.visible-a.visible).slice(0,3),
        portals: portals.length, portalSummary: portals.slice(0,5)
      },
      drift: { sampleSize: picked.length, restyle: restyle.tally, localize: localize.tally },
      examples
    };
  }

  return { scan };
})();
window.__SELFHEAL_RESULT = window.__SELFHEAL_INSPECT.scan();
window.__SELFHEAL_RESULT;
