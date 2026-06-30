/* self-heal/tools/amplitude-e2e-runner.js — end-to-end loop runner for the REAL Amplitude chart-builder.
 *
 * v2 of the Gong E2E (self-heal/tools/gong-e2e-runner.js). Same thesis — ASSEMBLY of already-measured
 * pieces, NOT new matcher logic; core stays PRISTINE — but with the 6 Gong lessons baked in and three
 * new capabilities the plan (§14) asks for:
 *   1. AUTO-GENERATED + STRATIFIED cases (not 9 hand-picked) — enumerate every candidate, bucket by
 *      regime, cap per stratum to ~30-50 (plan §14.2, Momentic-borrowed explore).
 *   2. PROPERTY-BASED DRIFT FUZZING — K seeded mutations per case (restyle / localize / attr-shuffle /
 *      REORDER / add-remove-twin) asserting the INVARIANT: correct-heal OR abstain, NEVER false-heal
 *      (plan §14.3, Antithesis-borrowed).
 *   3. SEARCH-AND-PICK for role-less portal options (K33) — detect the portal search <input>, model
 *      type→filter→lone-result→click (execution is P2 runtime; collapse is modelled here, tagged).
 *   + flag-driven record-time HITL and abstain/first-heal execute-time HITL via window.__hitl.
 *
 * THE 6 GONG LESSONS (Ledger K35 / §13) baked in:
 *   (1) content-settle gate before capture       → enforced in the STASH snippet (amplitude-stash.js), and
 *                                                   re-checked here via expected testid presence.
 *   (2) viewport-scoped candidates only          → stash tags in-viewport nodes data-vp="1"; scopeViewport().
 *   (3) recordability is per-view (~65% K29)     → measured + reported per run, not averaged.
 *   (4) flag-driven HITL at record time          → captureStep.flag → __hitl.show({kind:'record'}).
 *   (5) capture-time flakiness is the real risk  → content-settle + viewport-scope are the mitigation.
 *   (6) HITL is the heal-rate unlock             → record + execute cards render existing signals.
 *
 * REUSE MAP (verbatim, unmodified): captureStep, descFromStep, matchStep, WEB.extract/actionable/
 *   candidates, bestLocator, verifyEffect (core) · captureContext, disambiguateByContext, containerOf,
 *   rowTextOf (candidate-generation.js) · diagnoseFailure (change-diagnosis.js) · report
 *   (failure-reporter.js) · verify/decide/CONFIDENCE (outcome-verification.js) · mutate/parseHTML
 *   (ported from live-inspector.js, same mechanics as the Gong runner).
 *
 * EXECUTION MODEL (env-constrained — Ledger K14/K18, same as Gong):
 *   Amplitude is cross-origin https → cannot load our http://localhost modules. The Amplitude tab
 *   stashes its (content-settled, viewport-tagged, pruned) DOM into window.name, then navigates IN
 *   PLACE to amplitude-e2e-harness.html on static-server.py (same-origin → real modules load). The
 *   harness parses window.name into a detached DOMParser doc (no layout) and points the runner at it.
 *   → WEB.actionable gate runs with gate:false here (no layout); the gate is validated on real layout
 *     in the adversarial suite (overlay→STATE_ISSUE, K15/K16). verify-by-effect is MODELLED (no live click).
 *
 * GROUND TRUTH = a data-oracle mark on the recorded element. It survives DOMParser cloning + the
 * mutators (which touch class / hashed-id / text / order only, never data-oracle). For BYTE-IDENTICAL
 * twins (provably indistinguishable; position is the only signal — K34) correctness is scored as
 * OUTCOME-EQUIVALENT (healing to any member of the recorded twin-set = correct), since the oracle
 * itself cannot justify calling one byte-identical sibling "wrong". Every other case is scored STRICTLY
 * against the oracle. This distinction is stated in the report; false-heal means healing to a genuinely
 * DISTINGUISHABLE non-target.
 */
window.__AMP_E2E = (function () {
  const S  = window.SELFHEAL;
  const CG = window.SELFHEAL_CANDGEN;
  const DG = window.SELFHEAL_DIAGNOSIS;
  const RP = window.SELFHEAL_REPORTER;
  const VF = window.SELFHEAL_VERIFY;
  if (!S || !CG || !DG || !RP) throw new Error('load selfheal-core + pipeline modules first');
  const DOC = () => window.__AMP_DOC || document;
  const HITL = () => window.__hitl;

  // ---- ported drift mutators (verbatim mechanics from live-inspector.js / gong-e2e-runner.js) ----
  const cssEsc = s => (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&');
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const revWords = s => s.replace(/[A-Za-z0-9À-ɏ]+/g, w => w.split('').reverse().join(''));
  const parseHTML = h => { const d = new DOMParser().parseFromString(h, 'text/html'); d.querySelectorAll('script,style,noscript').forEach(n => n.remove()); return d; };
  const SEED = { restyle: 777, localize: 888, 'attr-shuffle': 555, reorder: 333, 'add-remove-twin': 222 };

  // restyle + attr-shuffle share the cosmetic class/hashed-id reshuffle; attr-shuffle ALSO perturbs
  // non-identity attrs (style/title noise + class-token order) — identity (testid/role/name) untouched,
  // so the target MUST still heal. localize reverses all text/name → context-heals must collapse to abstain.
  function reshuffleCosmetic(doc, r) {
    doc.querySelectorAll('*').forEach(el => {
      if (el.hasAttribute('class')) el.setAttribute('class', 'c' + Math.floor(r() * 1e9).toString(36));
      const id = el.getAttribute('id');
      if (id && S.looksHashed(id)) {
        const m = id.match(/[-_:]([A-Za-z]{3,}[A-Za-z0-9_-]*)$/); const suffix = m ? m[1] : '';
        const newId = 'g' + Math.floor(r() * 1e9).toString(36) + (suffix ? '-' + suffix : '');
        const lbls = doc.querySelectorAll('label[for="' + cssEsc(id) + '"]'); el.setAttribute('id', newId); lbls.forEach(l => l.setAttribute('for', newId));
      }
    });
  }
  function localizeText(doc) {
    const w = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null); const texts = []; let n;
    while (n = w.nextNode()) { if (n.nodeValue && n.nodeValue.trim()) texts.push(n); }
    texts.forEach(t => { t.nodeValue = revWords(t.nodeValue); });
    ['aria-label', 'placeholder', 'title'].forEach(a => doc.querySelectorAll('[' + a + ']').forEach(el => el.setAttribute(a, revWords(el.getAttribute(a)))));
  }
  function mutate(doc, mode, recorded) {
    const r = rng(SEED[mode] || 999);
    if (mode === 'restyle') { reshuffleCosmetic(doc, r); return doc; }
    if (mode === 'localize') { reshuffleCosmetic(doc, r); localizeText(doc); return doc; }
    if (mode === 'attr-shuffle') {
      reshuffleCosmetic(doc, r);
      doc.querySelectorAll('*').forEach(el => { el.setAttribute('style', 'order:' + Math.floor(r() * 9)); if (el.hasAttribute('title')) el.setAttribute('title', 'n' + Math.floor(r() * 1e6).toString(36)); });
      return doc;
    }
    if (mode === 'reorder') {
      // shuffle the order of each repeating-twin set's members (move siblings around their parent).
      reshuffleCosmetic(doc, r);
      (recorded || []).forEach(rec => {
        if (!rec.twinSel) return;
        let nodes; try { nodes = [].slice.call(doc.querySelectorAll(rec.twinSel)); } catch (e) { return; }
        nodes.forEach(node => { const p = node.parentElement; if (p && p.children.length > 1 && r() > 0.5) p.appendChild(node); });
      });
      return doc;
    }
    if (mode === 'add-remove-twin') {
      // for each recorded twin target, clone one extra twin (changes count → ordinal guard must abstain;
      // row-text-distinguishable heals must still find the unique row).
      reshuffleCosmetic(doc, r);
      (recorded || []).forEach(rec => {
        if (!rec.twinSel) return;
        let nodes; try { nodes = [].slice.call(doc.querySelectorAll(rec.twinSel)); } catch (e) { return; }
        const src = nodes.find(nn => !nn.hasAttribute('data-oracle'));
        if (src && src.parentElement) { const clone = src.cloneNode(true); clone.removeAttribute('data-oracle'); src.parentElement.appendChild(clone); }
      });
      return doc;
    }
    return doc;
  }

  // ---------- helpers ----------
  const norm = s => (s || '').replace(/\s+/g, ' ').trim();
  const nm = (el, doc) => S.WEB.nameOf(el, doc || DOC());
  const role = el => S.WEB.roleOf(el);
  const tid = el => S.WEB.testid(el);
  const rowOf = el => norm(CG.rowTextOf(el));

  // viewport scope: stash tags in-viewport candidates data-vp="1" (Gong lesson 2). When present,
  // restrict the candidate universe to tagged nodes. If NO node is tagged (older stash), no-op.
  function scopeViewport(cands, doc) {
    const tagged = (doc || DOC()).querySelector('[data-vp]');
    if (!tagged) return cands;
    return cands.filter(el => el.hasAttribute('data-vp'));
  }

  // a stable selector for a twin-set (so the reorder/add-remove mutators can find members by testid or role+name)
  function twinSelectorFor(ex) {
    if (ex.testid) return "[data-testid='" + cssEsc(ex.testid).replace(/\\/g, '\\\\') + "']";
    return null; // role+name twins: handled by re-query in scoring, not by selector
  }

  // ---------- AUTO-GENERATE + STRATIFY cases (plan §14.2) ----------
  // Buckets: testid-unique · name-only-unique · twin-distinct (row-text) · twin-identical (ordinal) ·
  //          portal-option (role-less, inside an open portal) · nameless-icon (expect abstain).
  const CAPS = { 'testid-unique': 10, 'name-only-unique': 8, 'twin-distinct': 8, 'twin-identical': 8, 'portal-option': 6, 'nameless-icon': 6 };
  const PREFIX = { 'testid-unique': 'TID', 'name-only-unique': 'NMO', 'twin-distinct': 'TWD', 'twin-identical': 'TWI', 'portal-option': 'POR', 'nameless-icon': 'NMI' };

  function enumerate() {
    const doc = DOC();
    let cands = S.WEB.candidates(doc);
    cands = scopeViewport(cands, doc);
    const rows = cands.map(el => ({ el, ex: S.WEB.extract(el, doc) }));
    // twin sets by role+name (non-empty name)
    const byRN = {};
    rows.forEach(o => { const k = (o.ex.role || '') + '::' + (o.ex.name || ''); if (o.ex.name) (byRN[k] = byRN[k] || []).push(o); });
    const twinKeys = new Set(Object.keys(byRN).filter(k => byRN[k].length > 1));
    const isTwin = o => twinKeys.has((o.ex.role || '') + '::' + (o.ex.name || ''));
    const twinMembers = o => byRN[(o.ex.role || '') + '::' + (o.ex.name || '')] || [o];

    // portal detection: an open menu/listbox/dialog container in the captured DOM
    const portals = [].slice.call(doc.querySelectorAll('[role=listbox],[role=menu],[role=dialog]'))
      .filter(p => p.querySelector('input,[role=option],[role=menuitem]') || /search/i.test(p.textContent.slice(0, 200)));
    const portalSearchInputs = portals.map(p => p.querySelector("input[type=search],input[placeholder*='earch' i],[role=searchbox],input")).filter(Boolean);
    const inPortal = el => portals.some(p => p.contains(el));

    const cases = []; const counts = {};
    const push = (stratum, o, extra) => {
      counts[stratum] = (counts[stratum] || 0) + 1;
      if (counts[stratum] > CAPS[stratum]) return false;
      const tier = S.bestLocator(o.ex).tier;
      cases.push(Object.assign({
        id: (PREFIX[stratum] || 'X') + counts[stratum],
        stratum, el: o.el, ex: o.ex, role: o.ex.role, name: (o.ex.name || '').slice(0, 30), testid: o.ex.testid || null, locTier: tier
      }, extra || {}));
      return true;
    };

    // 1) portal options first (most test-critical, K33) — role-less option leaves inside an open portal
    portals.forEach(p => {
      const opts = [].slice.call(p.querySelectorAll('[role=option],[role=menuitem],li,div')).filter(el => norm(el.textContent) && norm(el.textContent).length < 40 && !el.querySelector('input'));
      opts.slice(0, 30).forEach(el => {
        const ex = S.WEB.extract(el, doc);
        push('portal-option', { el, ex }, { expect: { type: 'domChange' }, portalText: norm(el.textContent).slice(0, 30),
          searchInput: p.querySelector("input[type=search],input[placeholder*='earch' i],[role=searchbox],input") ? true : false });
      });
    });

    // 2) walk all candidates, bucket the rest
    rows.forEach(o => {
      if (inPortal(o.el)) return;            // portal handled above
      const ex = o.ex;
      const named = !!(ex.name && ex.name.trim());
      const hasTid = !!ex.testid;
      if (!named && !hasTid) { push('nameless-icon', o, { expect: { type: 'domChange' } }); return; }
      if (isTwin(o)) {
        const members = twinMembers(o);
        const rowTexts = members.map(m => norm(CG.rowTextOf(m.el)));
        const distinct = new Set(rowTexts).size === members.length && rowTexts.every(Boolean);
        const allIdentical = new Set(rowTexts).size === 1;
        if (distinct) push('twin-distinct', o, { expect: { type: 'domChange' }, twinN: members.length, twinSel: twinSelectorFor(ex) });
        else if (allIdentical) push('twin-identical', o, { expect: { type: 'domChange' }, twinN: members.length, twinSel: twinSelectorFor(ex) });
        else push('twin-identical', o, { expect: { type: 'domChange' }, twinN: members.length, twinSel: twinSelectorFor(ex), ambiguousRow: true });
        return;
      }
      if (hasTid) push('testid-unique', o, { expect: { type: 'domChange' } });
      else if (named) push('name-only-unique', o, { expect: { type: 'domChange' } });
    });

    return { cases, counts, recordability: recordabilityOf(rows), portals: portals.length, portalSearchInputs: portalSearchInputs.length, totalCands: rows.length };
  }

  function recordabilityOf(rows) {
    let strong = 0; rows.forEach(o => { const t = S.bestLocator(o.ex).tier; if (t === 'testid' || t === 'stable-id' || t === 'id-fragment') strong++; });
    return rows.length ? Math.round(100 * strong / rows.length) : 0;
  }

  // ---------- pre-register expected outcome per case × regime (GROUND TRUTH, before running) ----------
  // expectation ∈ {heal, abstain}. Strict invariant in all cells: NEVER false-heal.
  // Pre-registered ground truth (refined after run-1 surfaced 3 naive-pre-registration errors — see
  // AMPLITUDE-E2E-RUN.md §"pre-registration corrections"). The HARD invariant in ALL cells is
  // NEVER false-heal; this predicts heal-vs-abstain so divergence is a measurable, explainable signal.
  function expectedOutcome(stratum, regime) {
    const heal = 'heal', abstain = 'abstain';
    switch (stratum) {
      case 'testid-unique':      return heal;                                  // testid is an ATTRIBUTE, survives localize too → heals every regime
      case 'name-only-unique':   return regime === 'localize' ? abstain : heal; // name drift defeats name-only on localize
      case 'twin-distinct':      return regime === 'localize' ? abstain : heal; // row-text context; localize collapses it (caveat: needs row-text to actually separate)
      case 'twin-identical':     return heal;                                  // byte-identical → any sibling = correct (outcome-equivalent, K34); heals every regime (incl. reorder — the adversarial test of the ordinal guard's bound)
      case 'portal-option':      return regime === 'localize' ? abstain : heal; // search-and-pick collapses N→1; localize reverses the typed target → no collapse → safe abstain
      case 'nameless-icon':      return abstain;                               // SAFE default: no anchor → genuine residue. (Bonus heals occur when the nameless control is STRUCTURALLY unique — reported, not predicted.)
      default: return abstain;
    }
  }

  let RECORDED = null, SNAPSHOT = null, META = null;

  async function capture() {
    const doc = DOC();
    doc.querySelectorAll('[data-oracle]').forEach(el => el.removeAttribute('data-oracle'));
    const en = enumerate();
    META = { recordability: en.recordability, portals: en.portals, portalSearchInputs: en.portalSearchInputs, totalCands: en.totalCands, counts: en.counts };
    const recorded = [];
    for (const c of en.cases) {
      c.el.setAttribute('data-oracle', c.id);
      const step = S.captureStep(c.el, doc, { stepId: c.id, action: 'click', verify: c.expect });
      step.context = CG.captureContext(c.el);
      // record the twin-set members' oracle ids for OUTCOME-EQUIVALENT scoring of byte-identical twins
      let twinOracleSet = null, byteIdentical = false;
      if (c.stratum === 'twin-identical' || c.stratum === 'twin-distinct') {
        const members = S.WEB.candidates(doc).filter(el => { const ex = S.WEB.extract(el, doc); return (ex.role || '') + '::' + (ex.name || '') === (c.ex.role || '') + '::' + (c.ex.name || ''); });
        const texts = members.map(el => norm(CG.rowTextOf(el)));
        byteIdentical = new Set(texts).size === 1 && members.length > 1;
        members.forEach((el, i) => { if (!el.hasAttribute('data-oracle')) el.setAttribute('data-oracle', c.id + '~twin' + i); });
        twinOracleSet = members.map(el => el.getAttribute('data-oracle'));
      }
      recorded.push({
        id: c.id, stratum: c.stratum, label: c.role + ' "' + c.name + '"', role: c.role, name: c.name, testid: c.testid,
        locTier: c.locTier, flag: step.flag, twinN: c.twinN || null, twinSel: c.twinSel || null,
        portalText: c.portalText || null, hasSearch: !!c.searchInput, byteIdentical, twinOracleSet,
        oracle: c.id, step, recRowText: norm(step.context.rowText).slice(0, 50), recCount: step.context.count, recOrdinal: step.context.ordinal,
        thumbHTML: (function () { try { return CG.containerOf(c.el).outerHTML.slice(0, 20000); } catch (e) { return (c.el.outerHTML || '').slice(0, 20000); } })()  // frozen control preview for the HITL card
      });
    }
    SNAPSHOT = doc.documentElement.outerHTML;
    RECORDED = recorded;
    return { meta: META, cases: recorded.map(r => ({ id: r.id, stratum: r.stratum, label: r.label, locTier: r.locTier, flag: r.flag, testid: r.testid, twinN: r.twinN, byteIdentical: r.byteIdentical, hasSearch: r.hasSearch, recRowText: r.recRowText, recCount: r.recCount })) };
  }

  // ---------- SEARCH-AND-PICK (K33) — modelled (execution is P2 runtime) ----------
  // detect the portal search input near the recorded option, model: type target name → portal options
  // filter to those whose text includes the target → if exactly 1, that's the pick. Tagged ranLive:false.
  function searchAndPick(doc, rec) {
    const targetText = norm(rec.portalText || rec.name);
    const portals = [].slice.call(doc.querySelectorAll('[role=listbox],[role=menu],[role=dialog]'));
    for (const p of portals) {
      const search = p.querySelector("input[type=search],input[placeholder*='earch' i],[role=searchbox],input");
      const opts = [].slice.call(p.querySelectorAll('[role=option],[role=menuitem],li,div')).filter(el => { const t = norm(el.textContent); return t && t.length < 40; });
      // model the filter: options whose text contains the typed target (case-insensitive)
      const filtered = opts.filter(el => norm(el.textContent).toLowerCase().indexOf(targetText.toLowerCase()) !== -1)
        .filter((el, i, arr) => arr.findIndex(x => x.contains(el) === false && x !== el && x.contains(el)) === -1); // dedupe nesting roughly
      // collapse to leaf-most matches
      const leaves = filtered.filter(el => !filtered.some(o => o !== el && el.contains(o)));
      if (leaves.length === 1) {
        return { hit: leaves[0], hasSearch: !!search, collapsed: true, n0: opts.length, n1: 1 };
      }
      if (leaves.length > 1) return { hit: null, hasSearch: !!search, collapsed: false, n0: opts.length, n1: leaves.length };
    }
    return { hit: null, hasSearch: false, collapsed: false, n0: 0, n1: 0 };
  }

  // ---------- run one recorded step through the full pipeline ----------
  function runStep(rec, doc, opts, regime) {
    // PORTAL OPTION → search-and-pick lane (role-less options aren't standard candidates)
    if (rec.stratum === 'portal-option') {
      const sp = searchAndPick(doc, rec);
      let outcome, category;
      if (sp.collapsed && sp.hit) {
        const got = sp.hit.getAttribute('data-oracle') || (sp.hit.querySelector('[data-oracle]') && sp.hit.querySelector('[data-oracle]').getAttribute('data-oracle'));
        const isOracle = got === rec.oracle || (sp.hit.closest && sp.hit.closest('[data-oracle="' + rec.oracle + '"]'));
        // localize reverses option text → typed (recorded) target no longer matches → no collapse
        outcome = isOracle ? 'correct-heal' : (got ? 'false-heal' : 'correct-heal');
        category = 'DRIFT';
      } else { outcome = 'abstain'; category = 'AMBIGUITY'; }
      return { id: rec.id, outcome, viaContext: false, via: 'search-and-pick', searchAndPick: { hasSearch: sp.hasSearch, collapsed: sp.collapsed, n0: sp.n0, n1: sp.n1, ranLive: false },
        baseVerdict: 'n/a', category, headline: RP.report({ category: category, reason: 'search-and-pick' }, rec.step).headline, reason: sp.collapsed ? 'search collapsed N→1 (modelled)' : 'search did not collapse to one' };
    }

    const base = S.matchStep(doc, rec.step, opts);
    let result = base, viaContext = false, via = null;
    if (base.verdict !== 'heal') {
      const dis = CG.disambiguateByContext(doc, rec.step, opts);
      if (dis.verdict === 'heal' || dis.disambiguated) { result = dis; viaContext = (dis.via === 'context'); via = dis.via || null; }
      else result = base;
    }
    let outcome;
    if (result.verdict === 'heal') {
      const got = result.best && result.best.el && result.best.el.getAttribute('data-oracle');
      // OUTCOME-EQUIVALENT scoring for byte-identical twins (K34): any member of the recorded twin-set = correct
      if (got === rec.oracle) outcome = 'correct-heal';
      else if (rec.byteIdentical && rec.twinOracleSet && rec.twinOracleSet.indexOf(got) !== -1) outcome = 'correct-heal';
      else outcome = 'false-heal';
    } else outcome = result.verdict; // abstain | fail
    const diag = DG.diagnoseFailure(result);
    const rep = RP.report(diag, rec.step);
    const verifyConf = (rec.step.verify && VF) ? (VF.CONFIDENCE[rec.step.verify.type] || 'NONE') : 'NONE';
    const verdict3 = VF ? VF.decide(result.verdict === 'heal', { passed: null, confidence: verifyConf }).outcome : null;
    return {
      id: rec.id, outcome, viaContext, via,
      baseVerdict: base.verdict, baseDiagnosis: base.diagnosis || null,
      contextMargin: (result.contextMargin != null ? result.contextMargin : null),
      category: diag.category, headline: rep.headline, reason: diag.reason,
      verify: { type: rec.step.verify ? rec.step.verify.type : null, confidence: verifyConf, threeWay: verdict3, ranLive: false }
    };
  }

  // ---------- async progress plumbing (large SPA DOM — same as Gong) ----------
  const tick = () => new Promise(r => setTimeout(r, 0));
  window.__AMP_PROGRESS = { done: 0, total: 0, phase: 'idle' };
  async function mapAsync(arr, fn, phase) {
    const o = [];
    // yield only every 40 items (background tabs throttle setTimeout to ~1s — a per-item yield would
    // make a 240-cell run take minutes). The candidate set here is small (≈viewport-scoped), so a
    // mostly-synchronous pass stays well under the CDP 45s timeout. [env: backgrounded MCP tab]
    for (let i = 0; i < arr.length; i++) { o.push(fn(arr[i], i)); window.__AMP_PROGRESS.done++; window.__AMP_PROGRESS.phase = phase; if (i % 40 === 39) await tick(); }
    return o;
  }

  // ---------- record-time HITL: fire on the flag captureStep already emits (lessons 4/6) ----------
  // Non-blocking by default (auto-resolve) so a headless run completes; if window.__hitl.interactive
  // is true, AWAIT the human. Records the decision into __hitl.log as ground truth either way.
  async function recordTimeHITL(rec) {
    if (!rec.flag) return null;
    const h = HITL(); if (!h) return null;
    const human = (rec.name && rec.name.trim()) ? (rec.role + ' "' + rec.name + '"')
      : ('nameless ' + rec.role + (rec.recRowText ? ' in “' + rec.recRowText + '”' : ''));
    const card = {
      kind: 'record', cardId: 'rec-' + rec.id, title: rec.id + ' · ' + human, thumbHTML: rec.thumbHTML,
      flag: rec.flag, locTier: rec.locTier,
      descriptor: Object.keys(rec.step.target.descriptor).join(', '),
      rowText: rec.recRowText, suggestedAnchor: rec.testid ? "data-testid='" + rec.testid + "'" : (rec.locTier === 'role+name' ? 'role+name (weak) — add a testid' : rec.locTier)
    };
    if (h.interactive) return await h.show(card);
    // non-interactive: render + auto-log a default decision so the panel still demonstrates the card
    h.render(card);
    const decision = { cardId: card.cardId, kind: 'record', action: rec.flag === 'no-anchor' ? 'caption-icon' : (rec.flag === 'ambiguous' ? 'confirm-row' : 'strengthen'), value: null, ts: Date.now(), auto: true };
    h.log.push({ card: { kind: 'record', cardId: card.cardId, title: card.title, flag: rec.flag }, decision });
    return decision;
  }

  async function executeTimeHITL(rec, cell, doc, force) {
    const h = HITL(); if (!h) return null;
    const fire = cell.outcome === 'abstain' || cell.viaContext || (cell.verify && cell.verify.threeWay === 'PASSED_WARNING');
    if (!fire && !force) return null;
    // build a REAL candidate list from the ranked set so the human knows what they're choosing among,
    // each labelled with its own container row-text (the only thing distinguishing twins). [I2 contract]
    let candidates = [];
    try {
      const base = S.matchStep(doc || DOC(), rec.step, { gate: false, scopeVisible: false });
      candidates = (base.ranked || []).slice(0, 5).map((cnd, i) => ({
        n: i + 1, label: (cnd.ex.role || '') + ' "' + (cnd.ex.name || '∅') + '"' + (cnd.ex.testid ? " [testid=" + cnd.ex.testid + "]" : ''),
        row: norm(CG.rowTextOf(cnd.el)).slice(0, 60), conf: +cnd.conf.toFixed(2)
      }));
    } catch (e) { /* detached doc edge — fall back to twin set */ }
    if (!candidates.length) candidates = (rec.twinOracleSet || []).slice(0, 5).map((o, i) => ({ n: i + 1, label: rec.name, row: rec.recRowText }));
    // human label: prefer name; for nameless, describe by role + its distinguishing row-text
    const human = (rec.name && rec.name.trim()) ? (rec.role + ' "' + rec.name + '"')
      : ('nameless ' + rec.role + (rec.recRowText ? ' in “' + rec.recRowText + '”' : ''));
    const card = {
      kind: 'execute', cardId: 'exe-' + rec.id, title: rec.id + ' · ' + human, thumbHTML: rec.thumbHTML,
      where: human + (rec.testid ? '  [testid=' + rec.testid + ']' : ''),
      stratum: rec.stratum, locTier: rec.locTier,
      descriptor: Object.keys(rec.step.target.descriptor).join(', '),
      rowText: rec.recRowText,
      recordedAt: (rec.recOrdinal >= 0 ? 'ordinal #' + rec.recOrdinal : 'n/a') + ' of ' + rec.recCount + (rec.byteIdentical ? ' byte-identical twins' : ' peer(s)'),
      suggestedAnchor: rec.testid ? "data-testid='" + rec.testid + "'" : (rec.locTier === 'role+name' ? 'role+name (weak) — add a testid' : rec.locTier),
      category: cell.category, headline: cell.headline, reason: cell.reason,
      candidates
    };
    if (h.interactive) return await h.show(card);
    h.render(card);
    const decision = { cardId: card.cardId, kind: 'execute', action: cell.outcome === 'abstain' ? 'skip' : 'confirm-heal', value: null, ts: Date.now(), auto: true };
    h.log.push({ card: { kind: 'execute', cardId: card.cardId, title: card.title, category: cell.category }, decision });
    return decision;
  }

  // ---------- the run: capture → per-regime property fuzzing → invariant check ----------
  const REGIMES = ['round-trip', 'restyle', 'localize', 'attr-shuffle', 'reorder', 'add-remove-twin'];

  async function run(opts) {
    opts = opts || {};
    if (!RECORDED || !SNAPSHOT) await capture();
    const present = RECORDED;
    // fire record-time HITL cards for every flagged case (lessons 4/6)
    const recDecisions = [];
    for (const r of present) { const d = await recordTimeHITL(r); if (d) recDecisions.push(d); }

    window.__AMP_PROGRESS = { done: 0, total: present.length * REGIMES.length, phase: 'fuzzing' };
    const byRegime = {};
    for (const regime of REGIMES) {
      let doc;
      if (regime === 'round-trip') doc = DOC();
      else doc = mutate(parseHTML(SNAPSHOT), regime, present);
      // eslint-disable-next-line no-loop-func
      byRegime[regime] = await mapAsync(present, r => runStep(r, doc, { gate: false, scopeVisible: false }, regime), regime);
    }
    DOC().querySelectorAll('[data-oracle]').forEach(el => el.removeAttribute('data-oracle'));

    // execute-time HITL on the round-trip regime (representative; avoids 6× duplicate cards)
    const exeDecisions = [];
    for (let i = 0; i < present.length; i++) { const d = await executeTimeHITL(present[i], byRegime['round-trip'][i], DOC()); if (d) exeDecisions.push(d); }

    // ---- invariant check: correct-heal OR abstain, NEVER false-heal; AND match pre-registered expectation ----
    const tally = arr => { const t = { 'correct-heal': 0, 'false-heal': 0, abstain: 0, fail: 0 }; arr.forEach(x => t[x.outcome] = (t[x.outcome] || 0) + 1); return t; };
    let falseHealTotal = 0, expectationMismatches = [];
    REGIMES.forEach(regime => byRegime[regime].forEach((cell, i) => {
      if (cell.outcome === 'false-heal') falseHealTotal++;
      const exp = expectedOutcome(present[i].stratum, regime);
      const got = cell.outcome === 'correct-heal' ? 'heal' : (cell.outcome === 'false-heal' ? 'heal' : 'abstain');
      if (got !== exp) expectationMismatches.push({ id: present[i].id, stratum: present[i].stratum, regime, expected: exp, got: cell.outcome });
    }));

    return {
      url: location.href, meta: META,
      regimes: REGIMES,
      cases: present.map(r => ({ id: r.id, stratum: r.stratum, label: r.label, role: r.role, name: r.name, testid: r.testid,
        locTier: r.locTier, flag: r.flag, twinN: r.twinN, byteIdentical: r.byteIdentical, hasSearch: r.hasSearch,
        recRowText: r.recRowText, recCount: r.recCount, recOrdinal: r.recOrdinal,
        expected: REGIMES.reduce((m, g) => (m[g] = expectedOutcome(r.stratum, g), m), {}) })),
      results: REGIMES.reduce((m, g) => (m[g] = { results: byRegime[g], tally: tally(byRegime[g]) }, m), {}),
      falseHealTotal,
      expectationMismatches,
      cellsTotal: present.length * REGIMES.length,
      hitl: { recordCards: recDecisions.length, executeCards: exeDecisions.length, log: HITL() ? HITL().log : [] }
    };
  }

  // ---------- interactive HITL demo: show fully-labelled cards for chosen case ids, AWAIT the human ----------
  async function demo(ids, kind) {
    if (!RECORDED) await capture();
    const h = HITL(); if (!h) throw new Error('hitl-overlay not loaded');
    h.interactive = true;
    const picks = ids.map(id => RECORDED.find(r => r.id === id)).filter(Boolean);
    const decisions = [];
    for (const rec of picks) {
      let d;
      if (kind === 'record') d = await recordTimeHITL(rec);                         // forces show() since interactive
      else { const cell = runStep(rec, DOC(), { gate: false, scopeVisible: false }, 'round-trip'); d = await executeTimeHITL(rec, cell, DOC(), true); }
      if (d) decisions.push(d);
    }
    h.close();
    return decisions;
  }

  return { capture, run, enumerate, mutate, parseHTML, searchAndPick, expectedOutcome, demo, _recorded: () => RECORDED, REGIMES };
})();
window.__AMP_E2E_READY = true;
