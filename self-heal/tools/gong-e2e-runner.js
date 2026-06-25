/* self-heal/tools/gong-e2e-runner.js — end-to-end loop runner for the REAL Gong DOM.
 *
 * Proves the full pipeline ASSEMBLY (record → drift → match → heal → diagnose → report) against a
 * real, captured Gong SPA DOM. NOT new matcher logic: it only orchestrates the already-measured
 * pieces. Core stays PRISTINE.
 *
 * Reuses (never modifies):
 *   selfheal-core.js          captureStep, descFromStep, WEB.extract/actionable, matchStep, bestLocator, verifyEffect
 *   candidate-generation.js   captureContext, disambiguateByContext, containerOf, rowTextOf
 *   change-diagnosis.js       diagnoseFailure
 *   failure-reporter.js       report
 *   outcome-verification.js   verify/decide/CONFIDENCE (three-way; modelled — no live click)
 * Drift mutators (mutate/parseHTML/revWords) are ported verbatim from live-inspector.js so any
 * number here is comparable to the inspector + test-suite numbers (same code path).
 *
 * EXECUTION MODEL (env-constrained — see Ledger K14/K18):
 *   The real Gong DOM (cross-origin, https) cannot load our http://localhost modules (mixed content)
 *   and is too large to transcribe. So the Gong tab stashes its (pruned) DOM in `window.name`, then
 *   navigates IN-PLACE to this harness on the static server (same-origin → <script src> loads the
 *   real modules cleanly). The harness renders that DOM and points the runner at it via
 *   window.__GONG_DOC. DOC therefore IS a rendered document → getBoundingClientRect works and the
 *   WEB.actionable gate is exercised on real (CSS-degraded) layout for the round-trip regime.
 *
 * GROUND TRUTH = a data-oracle mark placed on the recorded element. It survives DOMParser cloning
 * and the restyle/localize mutators (they touch class/hashed-id/text only). After a heal we read
 * best.el's data-oracle and compare to the recorded id → correct-heal vs FALSE-HEAL.
 */
window.__GONG_E2E = (function () {
  const S  = window.SELFHEAL;
  const CG = window.SELFHEAL_CANDGEN;
  const DG = window.SELFHEAL_DIAGNOSIS;
  const RP = window.SELFHEAL_REPORTER;
  const VF = window.SELFHEAL_VERIFY;
  if (!S || !CG || !DG || !RP) throw new Error('load selfheal-core + pipeline modules first');
  const DOC = () => window.__GONG_DOC || document;

  // ---- ported drift mutators (verbatim mechanics from live-inspector.js) ----
  const cssEsc = s => (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&');
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const revWords = s => s.replace(/[A-Za-z0-9À-ɏ]+/g, w => w.split('').reverse().join(''));
  const parseHTML = h => { const d = new DOMParser().parseFromString(h, 'text/html'); d.querySelectorAll('script,style,noscript').forEach(n => n.remove()); return d; };
  function mutate(doc, mode) {
    const r = rng(mode === 'restyle' ? 777 : 888);
    doc.querySelectorAll('*').forEach(el => {
      if (el.hasAttribute('class')) el.setAttribute('class', 'c' + Math.floor(r() * 1e9).toString(36));
      const id = el.getAttribute('id');
      if (id && S.looksHashed(id)) {
        const m = id.match(/[-_:]([A-Za-z]{3,}[A-Za-z0-9_-]*)$/); const suffix = m ? m[1] : '';
        const newId = 'g' + Math.floor(r() * 1e9).toString(36) + (suffix ? '-' + suffix : '');
        const lbls = doc.querySelectorAll('label[for="' + cssEsc(id) + '"]'); el.setAttribute('id', newId); lbls.forEach(l => l.setAttribute('for', newId));
      }
    });
    if (mode === 'localize') {
      const w = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null); const texts = []; let n;
      while (n = w.nextNode()) { if (n.nodeValue && n.nodeValue.trim()) texts.push(n); }
      texts.forEach(t => { t.nodeValue = revWords(t.nodeValue); });
      doc.querySelectorAll('[aria-label]').forEach(el => el.setAttribute('aria-label', revWords(el.getAttribute('aria-label'))));
      doc.querySelectorAll('[placeholder]').forEach(el => el.setAttribute('placeholder', revWords(el.getAttribute('placeholder'))));
      doc.querySelectorAll('[title]').forEach(el => el.setAttribute('title', revWords(el.getAttribute('title'))));
    }
    return doc;
  }

  // ---- target pickers (predicates over WEB.candidates, document order) ----
  const norm = s => (s || '').replace(/\s+/g, ' ').trim();
  const nm = el => S.WEB.nameOf(el, DOC());
  const rowOf = el => norm(CG.rowTextOf(el));
  function pickTargets() {
    const doc = DOC();
    const cands = S.WEB.candidates(doc);
    const role = el => S.WEB.roleOf(el);
    const copies = cands.filter(el => role(el) === 'button' && nm(el) === 'Copy');
    const copyIn = txt => copies.find(el => rowOf(el).indexOf(txt) !== -1);
    const nameless = cands.filter(el => role(el) === 'button' && !nm(el) && !S.WEB.testid(el) && !el.getAttribute('id'));
    const speakerSeg = nameless.find(el => /speaker-segment/.test(el.getAttribute('class') || ''));
    const stylesPlay = nameless.find(el => /styles-module/.test(el.getAttribute('class') || ''));
    return [
      { id: 'C1', label: 'tab "Outline" (role+name, hashed-id)', regime: 'role+name unique',
        el: cands.find(el => role(el) === 'tab' && nm(el) === 'Outline'), expect: { type: 'domChange' } },
      { id: 'C2', label: 'tab "Highlights" (role+name, hashed-id)', regime: 'role+name unique',
        el: cands.find(el => role(el) === 'tab' && nm(el) === 'Highlights'), expect: { type: 'domChange' } },
      { id: 'C3', label: 'button "Copy all" (name-only unique)', regime: 'name-only unique',
        el: cands.find(el => role(el) === 'button' && nm(el) === 'Copy all'), expect: { type: 'domChange' } },
      { id: 'C4', label: 'per-section "Copy" @ Product Overview', regime: 'ambiguous repeating (Clue-2)',
        el: copyIn('Product Overview'), expect: { type: 'domChange' } },
      { id: 'C5', label: 'per-section "Copy" @ Agentic Approach', regime: 'ambiguous repeating (Clue-2)',
        el: copyIn('Agentic Approach'), expect: { type: 'domChange' } },
      { id: 'C6', label: 'per-section "Copy" @ Ad Hoc Generation', regime: 'ambiguous repeating (Clue-2)',
        el: copyIn('Ad Hoc Generation'), expect: { type: 'domChange' } },
      { id: 'C7', label: '"Play at 44:42" link/btn (cross-viewport twin)', regime: 'ambiguous, twin-context',
        el: cands.find(el => nm(el) === 'Play at 44:42'), expect: { type: 'urlChange' } },
      { id: 'C8', label: 'nameless speaker-segment icon (identical context)', regime: 'nameless residue',
        el: speakerSeg, expect: { type: 'urlChange' } },
      { id: 'C9', label: 'nameless play icon (distinct context)', regime: 'nameless, distinct-context',
        el: stylesPlay, expect: { type: 'urlChange' } }
    ];
  }

  let RECORDED = null, SNAPSHOT = null;

  async function capture() {
    const doc = DOC();
    doc.querySelectorAll('[data-oracle]').forEach(el => el.removeAttribute('data-oracle'));
    const targets = pickTargets();
    await tick();
    const recorded = [];
    for (const t of targets) {
      await tick();
      if (!t.el) { recorded.push({ id: t.id, label: t.label, regime: t.regime, missing: true }); continue; }
      t.el.setAttribute('data-oracle', t.id);
      const step = S.captureStep(t.el, doc, { stepId: t.id, action: 'click', verify: t.expect });
      step.context = CG.captureContext(t.el);
      recorded.push({
        id: t.id, label: t.label, regime: t.regime, oracle: t.id, step,
        recRowText: norm(step.context.rowText).slice(0, 60), recCount: step.context.count,
        bestLocator: step.target.bestLocator, locTier: S.bestLocator(S.WEB.extract(t.el, doc)).tier,
        flag: step.flag, name: nm(t.el), role: S.WEB.roleOf(t.el)
      });
    }
    SNAPSHOT = doc.documentElement.outerHTML;   // re-serialized WITH oracle marks (for drift clones)
    RECORDED = recorded;
    return recorded.map(r => ({ id: r.id, label: r.label, regime: r.regime, missing: !!r.missing,
      name: r.name, locTier: r.locTier, flag: r.flag, recRowText: r.recRowText, recCount: r.recCount }));
  }

  // run one recorded step through the full pipeline on a given doc
  function runStep(rec, doc, opts) {
    const base = S.matchStep(doc, rec.step, opts);
    let result = base, viaContext = false;
    if (base.verdict !== 'heal') {
      const dis = CG.disambiguateByContext(doc, rec.step, opts);
      if (dis.verdict === 'heal' || dis.disambiguated) { result = dis; viaContext = (dis.via === 'context'); }
      else result = base;
    }
    let outcome;
    if (result.verdict === 'heal') {
      const got = result.best && result.best.el && result.best.el.getAttribute('data-oracle');
      outcome = (got === rec.oracle) ? 'correct-heal' : 'false-heal';
    } else outcome = result.verdict; // 'abstain' | 'fail'
    const diag = DG.diagnoseFailure(result);
    const rep = RP.report(diag, rec.step);
    // verify-by-effect (modelled — no live click in a shared browser): record what WOULD be checked
    const verifyConf = (rec.step.verify && VF) ? (VF.CONFIDENCE[rec.step.verify.type] || 'NONE') : 'NONE';
    const verdict3 = VF ? VF.decide(result.verdict === 'heal', { passed: null, confidence: verifyConf }).outcome : null;
    return {
      id: rec.id, outcome, viaContext,
      baseVerdict: base.verdict, baseDiagnosis: base.diagnosis || null,
      contextMargin: (result.contextMargin != null ? result.contextMargin : null),
      category: diag.category, headline: rep.headline, reason: diag.reason,
      verify: { type: rec.step.verify ? rec.step.verify.type : null, confidence: verifyConf, threeWay: verdict3, ranLive: false }
    };
  }

  // yield to the event loop so a 15k-candidate × 27-pass scan can't freeze the renderer past the
  // CDP eval timeout — lets the harness poll progress while the run proceeds. [env: huge SPA DOM]
  const tick = () => new Promise(r => setTimeout(r, 0));
  window.__GONG_PROGRESS = { done: 0, total: 0, phase: 'idle' };
  async function mapAsync(arr, fn, phase) {
    const o = [];
    for (let i = 0; i < arr.length; i++) { o.push(fn(arr[i], i)); window.__GONG_PROGRESS.done++; window.__GONG_PROGRESS.phase = phase; await tick(); }
    return o;
  }

  async function run() {
    if (!RECORDED || !SNAPSHOT) await capture();
    const present = RECORDED.filter(r => !r.missing);
    window.__GONG_PROGRESS = { done: 0, total: present.length * 3, phase: 'roundtrip' };
    // regime A: round-trip on the SAME captured doc. gate OFF because a DOMParser/non-rendered doc has
    // no layout (getBoundingClientRect=0) → WEB.actionable can't run here; the gate is exercised on
    // real layout in the adversarial suite (overlay→STATE_ISSUE, Ledger K15/K16). Tagged in the report.
    const roundtrip = await mapAsync(present, r => runStep(r, DOC(), { gate: false, scopeVisible: false }), 'roundtrip');
    // regimes B/C: synthetic drift on detached DOMParser clones, gate OFF (no layout in a parsed doc)
    const restyleDoc  = mutate(parseHTML(SNAPSHOT), 'restyle');
    const localizeDoc = mutate(parseHTML(SNAPSHOT), 'localize');
    const restyle  = await mapAsync(present, r => runStep(r, restyleDoc,  { gate: false, scopeVisible: false }), 'restyle');
    const localize = await mapAsync(present, r => runStep(r, localizeDoc, { gate: false, scopeVisible: false }), 'localize');
    DOC().querySelectorAll('[data-oracle]').forEach(el => el.removeAttribute('data-oracle'));

    const tally = arr => { const t = { 'correct-heal': 0, 'false-heal': 0, abstain: 0, fail: 0 }; arr.forEach(x => t[x.outcome] = (t[x.outcome] || 0) + 1); return t; };
    return {
      url: location.href,
      cases: present.map(r => ({ id: r.id, label: r.label, regime: r.regime, name: r.name,
        locTier: r.locTier, flag: r.flag, recRowText: r.recRowText, recCount: r.recCount })),
      missing: RECORDED.filter(r => r.missing).map(r => ({ id: r.id, label: r.label })),
      roundtrip: { results: roundtrip, tally: tally(roundtrip) },
      restyle:   { results: restyle,   tally: tally(restyle) },
      localize:  { results: localize,  tally: tally(localize) },
      falseHealTotal: [roundtrip, restyle, localize].reduce((s, a) => s + a.filter(x => x.outcome === 'false-heal').length, 0)
    };
  }

  return { capture, run, mutate, parseHTML, pickTargets };
})();
window.__GONG_E2E_READY = true;
