/* self-heal/shell/shell.js — S5: the plugin shell that WIRES the existing pieces into one user-facing
 * flow: suggest → review → run(live) → report, with HITL-on-stuck and brain priming. Builds no new
 * matcher/heal/executor logic — it orchestrates S6 authoring + S7 executor + S3 report + S2 brain +
 * the existing hitl-overlay. The honest successor to the MOCK flow-pretotype.js (real executor/report now).
 *
 * Dependencies (all must be loaded first): SELFHEAL (core), SELFHEAL_DIAGNOSIS, __TESTGEN (S6),
 * __RUNTIME (S7), SELFHEAL_REPORT (S3), SELFHEAL_BRAIN (S2). hitl is passed in (the real __hitl overlay,
 * or a canned auto-answerer for headless runs) so the shell itself stays testable without a human.
 *
 * SCOPE / honest bounds:
 *   - Runs live on the interactive in-page fixture (synthetic events) — same bound as S7.
 *   - HITL fires when executeLive reports a step it could NOT locate (verdict abstain/fail). The shell
 *     SURFACES the pipeline's stuck signal + records the human decision as ground truth; it does NOT yet
 *     resolve-and-continue mid-test (that deeper loop is S8/S9). Stated, not hidden.
 *   - Brain PRIMING is measured (cache hit-rate per run) and the brain COMPOUNDS (ingest on HIGH), but
 *     executeLive does not yet consult the brain to short-circuit matching — wiring the executor to be
 *     brain-first is S8/S9. So a primed cache is shown to be populated + valid, not yet load-bearing.
 */
(function (root) {
  const S = root.SELFHEAL, TG = root.__TESTGEN, RT = root.__RUNTIME,
        REP = root.SELFHEAL_REPORT, BRAIN = root.SELFHEAL_BRAIN;

  function need(name, v) { if (!v) throw new Error('shell.js: ' + name + ' not loaded'); }

  // adapt one S7 executeLive() result into a flywheel-event/v1 row (S3/S1 contract).
  // false_heal on a LIVE row is NOT identity-computed here: executeLive does not expose which element it
  // resolved, and "intended element" is a benchmark-only concept (needs an oracle). At runtime a wrong
  // heal surfaces through verify-by-effect FAILING → outcome FAILED, not through a boolean. So live rows
  // carry false_heal:false; identity-level false-heal is S4's benchmark authority (schemas/false-heal.js).
  // verify_confidence is the runtime's REAL value (HIGH/MEDIUM/NONE) — never 'simulated'.
  function toRow(res, app) {
    return {
      schemaVersion: 'flywheel-event/v1', ts: new Date().toISOString(), app: app,
      testId: res.id, stepId: null, outcome: res.outcome,
      verify_confidence: res.verify_confidence, category: res.category || 'UNKNOWN',
      source: 'live', driftKind: res._driftKind || 'pristine',
      healed: res.located ? true : false, false_heal: false,
      diagnosis: res.located ? null : (res.prescription || res.category || 'not located'),
      hitl_decision: res._hitlDecision || null
    };
  }

  function createSession(opts) {
    opts = opts || {};
    const doc = opts.doc || document;
    const app = opts.app || 'fixture:login';
    const mount = opts.mount;                 // mount(driftKind) → (re)mount the interactive fixture; returns stage el
    const hitl = opts.hitl || { show: () => Promise.resolve({ action: 'skip' }) };
    const brain = opts.brain || BRAIN.makeBrain();
    need('SELFHEAL', S); need('__TESTGEN', TG); need('__RUNTIME', RT); need('SELFHEAL_REPORT', REP); need('SELFHEAL_BRAIN', BRAIN);
    if (typeof mount !== 'function') throw new Error('shell.js createSession: opts.mount(driftKind)→stageEl is required');

    let suite = null, approved = null;

    function suggest() {
      const stage = mount('pristine');
      suite = TG.authorTests(doc, {});
      approved = suite.tests.map(t => t.id);   // default: all approved (review UI can narrow)
      return suite;
    }

    function setApproved(ids) { approved = ids.slice(); }

    // build a HITL card from a stuck executeLive result (execute-time card — the pipeline already
    // emitted category + reason; we only render them, per hitl-overlay's design).
    function cardFor(res) {
      return {
        kind: 'execute', cardId: res.id + ':stuck', title: 'Stuck: ' + res.title,
        category: res.category, headline: res.outcome + ' — ' + (res.category || 'UNKNOWN'),
        reason: res.prescription || res.diagnosis || 'could not locate the target', candidates: []
      };
    }

    // run the approved suite once under a given drift. useBrain=true → measure cache priming first.
    async function run(o) {
      o = o || {};
      const drift = o.drift || 'pristine';
      const useBrain = !!o.useBrain;
      if (!suite) suggest();
      const tests = suite.tests.filter(t => approved.indexOf(t.id) !== -1);

      const results = [], rows = [], hitlFires = [];
      let brainHits = 0, brainEligible = 0;

      for (const test of tests) {
        const stage = mount(drift);

        // brain priming MEASUREMENT (not yet load-bearing — see header): count how many of this test's
        // real-anchor steps the brain would already resolve on the current (possibly drifted) DOM.
        if (useBrain) {
          test.steps.filter(s => s._anchor && s._anchor.stepId && BRAIN.isRealAnchor(s._anchor.target && s._anchor.target.bestLocator))
            .forEach(s => { brainEligible++; if (brain.get(test.id, s._anchor.stepId, doc)) brainHits++; });
        }

        const res = RT.executeLive(stage, test);
        res._driftKind = drift;

        if (res.located === false) {                 // STUCK → raise a HITL card, record the decision
          const decision = await hitl.show(cardFor(res));
          res._hitlDecision = decision && decision.action || 'skip';
          hitlFires.push({ test: res.id, category: res.category, decision: res._hitlDecision });
        } else if (res.outcome === 'PASS' && res.verify_confidence === 'HIGH') {
          BRAIN.ingestLiveResult(brain, test, res);  // compound only verified-HIGH (OV#4)
        }

        results.push(res);
        rows.push(toRow(res, app));
      }

      const report = REP.buildReport(rows);
      return { drift, results, rows, report, hitlFires,
               brainPriming: { hits: brainHits, eligible: brainEligible,
                               ratePct: brainEligible ? Math.round(100 * brainHits / brainEligible) : null } };
    }

    return { suggest, setApproved, run, getSuite: () => suite, getApproved: () => approved.slice(), getBrain: () => brain };
  }

  const API = { createSession, toRow };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.SELFHEAL_SHELL = API;
})(typeof window !== 'undefined' ? window : globalThis);
