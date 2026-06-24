/* self-heal/pipeline/candidate-generation.js — Step 2: heal-candidate finding + disambiguation.
 *
 * Depends on the validated matcher core (window.SELFHEAL / require('../../selfheal-core.js')).
 * Does NOT modify the core.
 *
 * WHY this is the highest-surface / least-code lever (Ledger K8–K9, verified):
 *   Name-only controls already clear the heal floor on role+tag alone (score 0.737 > TH.heal 0.62);
 *   a full-text-drift form input scores ~0.898. So the matcher ALREADY heals through text change —
 *   what makes it abstain on a duplicate set is MARGIN (a tie), not the threshold. Healing is
 *   therefore mostly a *disambiguation* problem, and elimination breaks the tie deterministically.
 *
 * STATUS:
 *   eliminate(tied, desc)        P1 — BUILT + TESTED (pure, hermetic). Idea 5.
 *   disambiguate(doc, step, opts) P1 — BUILT + TESTED. Wraps matchStep; safe (never lowers safety).
 *   temporalLocality(...)        P2 — STUB (needs runtime interaction history; Idea 6 / I21).
 *   structuralDiff(...)          P2 — STUB (needs record-time DOM snapshot + stable anchors; Idea 2).
 */
(function (root) {
  const S = (typeof require !== 'undefined') ? require('../../selfheal-core.js') : root.SELFHEAL;
  const { TH, WEB, descFromStep, resolveScope, scoreEx, verdict, isEnabled } = S;

  // Negative-constraint denylist: a recorded target is rarely a "cancel/back/close/delete" control.
  const DISMISS_NAME = /(cancel|back|close|dismiss|delete|remove|skip)/i;

  // Pure. Input = the tied band [{el, ex, conf}] (candidates within TH.margin of the top).
  // Output = survivors after dropping those that violate a constraint the recorded target satisfies.
  function eliminate(tied, desc) {
    if (!tied || tied.length < 2) return tied || [];
    const tName = desc.signals.name ? String(desc.signals.name.value) : null;
    const tDismiss = tName ? DISMISS_NAME.test(tName) : false;
    const wantForm = !!(desc.signals.inForm && desc.signals.inForm.value === true);
    return tied.filter(r => {
      if (!isEnabled(r.el)) return false;                                       // drop disabled / aria-disabled
      if (r.ex.name && DISMISS_NAME.test(r.ex.name) && !tDismiss) return false;  // drop dismissive-named (unless target is)
      if (wantForm && r.ex.inForm !== true) return false;                       // drop out-of-form when target was in-form
      return true;
    });
  }

  // Replay a recorded step; if a top tie blocked the heal, try to break it deterministically.
  // Returns matchStep's shape, plus `disambiguated:true` when elimination resolved the tie.
  // SAFETY: only ever promotes within an already-high tied band, and only when a UNIQUE survivor
  // emerges with a real margin over the rest — otherwise returns the original (abstain) verbatim.
  function disambiguate(doc, step, opts) {
    opts = opts || {};
    const base = S.matchStep(doc, step, opts);
    if (base.verdict === 'heal' || base.best === null) return base;     // already healed / nothing to do

    const desc = descFromStep(step.target.descriptor);
    const cands = (opts.scopeVisible === false)
      ? WEB.candidates(doc)
      : resolveScope(doc, { visibleOnly: true, container: step.scope && step.scope.container });
    if (cands.length < 2) return base;

    const ranked = cands
      .map(el => { const ex = WEB.extract(el, doc); return { el, ex, conf: scoreEx(ex, desc) }; })
      .sort((a, b) => b.conf - a.conf);
    const top = ranked[0].conf;
    const tied = ranked.filter(r => (top - r.conf) < TH.margin);
    if (tied.length < 2) return base;                                   // not a tie — elimination can't help

    const kept = eliminate(tied, desc);
    if (kept.length < 1 || kept.length >= tied.length) return base;     // no genuine reduction

    // Rebuild: survivors + everyone already outside the tied band, then re-verdict.
    const ranked2 = ranked
      .filter(r => kept.indexOf(r) !== -1 || (top - r.conf) >= TH.margin)
      .sort((a, b) => b.conf - a.conf);
    const vd2 = verdict(ranked2);
    if (vd2.v !== 'heal') return base;                                  // still tied among survivors → stay abstain (safe)

    if (opts.gate !== false) {
      const act = WEB.actionable(vd2.best.el);
      if (!act.usable) {
        return { verdict: 'abstain', best: vd2.best, margin: vd2.margin, gated: true,
                 diagnosis: act.reason || 'not-usable', disambiguated: true };
      }
    }
    return { verdict: 'heal', best: vd2.best, margin: vd2.margin, diagnosis: null, disambiguated: true };
  }

  // ---- Clue-2 context: the GENUINE deterministic disambiguator (Ledger K13) --------------------
  // Container row-text and ordinal are NOT scoreEx signals, so they break ties the matcher cannot.
  // This is the AirPods answer: "the Add-to-Bag button in the column whose header is 'AirPods Pro'".
  const norm = s => (s || '').replace(/\s+/g, ' ').trim();
  const ROW_TAGS = ['tr', 'li', 'td', 'th', 'article', 'section', 'fieldset', 'dd', 'dt'];
  const ROW_ROLES = ['row', 'listitem', 'gridcell', 'group'];

  // nearest "row/cell/section" ancestor — the unit that carries distinguishing text
  function containerOf(el) {
    let n = el.parentElement;
    while (n && n.nodeType === 1) {
      const tag = n.tagName.toLowerCase();
      const role = n.getAttribute && n.getAttribute('role');
      if (ROW_TAGS.indexOf(tag) !== -1 || (role && ROW_ROLES.indexOf(role) !== -1)) return n;
      n = n.parentElement;
    }
    return el.parentElement || el;
  }

  // distinguishing text of the element's container, with the control's OWN label removed
  function rowTextOf(el, ownName) {
    let t = norm(containerOf(el).textContent);
    if (ownName) t = norm(t.split(norm(ownName)).join(' '));
    return t;
  }

  // CAPTURE-TIME (Clue-2): attach to the recorded step → `step.context = captureContext(el)`.
  function captureContext(el) {
    const doc = el.ownerDocument;
    const ex = WEB.extract(el, doc);
    const sig = (ex.role || '') + '::' + (ex.name || '');
    const peers = WEB.candidates(doc).filter(c => {
      const e = WEB.extract(c, doc); return (e.role || '') + '::' + (e.name || '') === sig;
    });
    return { rowText: rowTextOf(el, ex.name), ordinal: peers.indexOf(el), count: peers.length };
  }

  // Heuristic, UNCALIBRATED context thresholds (per honesty rule — not derived). Conservative.
  const CTX = { floor: 0.30, margin: 0.15 };

  // Break a margin tie using recorded container context. Heal-ADDING (unlike eliminate). SAFE:
  // heals only when ONE candidate's row-text clearly wins; otherwise returns the base abstain.
  function disambiguateByContext(doc, step, opts) {
    opts = opts || {};
    const base = S.matchStep(doc, step, opts);
    if (base.verdict === 'heal' || base.best === null) return base;
    const rec = step.context;
    if (!rec || !norm(rec.rowText)) return base;                  // no recorded context → can't; stay safe

    const desc = descFromStep(step.target.descriptor);
    const cands = (opts.scopeVisible === false)
      ? WEB.candidates(doc)
      : resolveScope(doc, { visibleOnly: true, container: step.scope && step.scope.container });
    if (cands.length < 2) return base;
    const ranked = cands.map(el => { const ex = WEB.extract(el, doc); return { el, ex, conf: scoreEx(ex, desc) }; })
                        .sort((a, b) => b.conf - a.conf);
    const top = ranked[0].conf;
    const tied = ranked.filter(r => (top - r.conf) < TH.margin);
    if (tied.length < 2) return base;

    const scored = tied.map(r => ({ r, s: S.fuzzy(rec.rowText, rowTextOf(r.el, r.ex.name)) }))
                       .sort((a, b) => b.s - a.s);
    const win = scored[0], runner = scored[1];
    if (win.s >= CTX.floor && (win.s - (runner ? runner.s : 0)) >= CTX.margin) {
      if (opts.gate !== false) {
        const act = WEB.actionable(win.r.el);
        if (!act.usable) return { verdict: 'abstain', best: win.r, margin: base.margin, gated: true, diagnosis: act.reason || 'not-usable', disambiguated: true, via: 'context' };
      }
      return { verdict: 'heal', best: win.r, margin: +(win.s - (runner ? runner.s : 0)).toFixed(2), diagnosis: null, disambiguated: true, via: 'context' };
    }
    return base;                                                 // context didn't cleanly distinguish → safe abstain
  }

  // ---- P2 generators — documented, NOT implemented (no runtime in P1). Throw to block silent fake use.
  function temporalLocality() {
    throw new Error('temporalLocality: P2 — needs runtime interaction history (spatial prior; Idea 6 / I21).');
  }
  function structuralDiff() {
    throw new Error('structuralDiff: P2 — needs record-time DOM snapshot + stable ancestor anchors (Idea 2).');
  }

  const API = { eliminate, disambiguate, captureContext, disambiguateByContext, containerOf, rowTextOf, temporalLocality, structuralDiff };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.SELFHEAL_CANDGEN = API;
})(typeof window !== 'undefined' ? window : globalThis);
