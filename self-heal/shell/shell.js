/* self-heal/shell/shell.js — S5/S8: the plugin shell that WIRES the existing pieces into one
 * user-facing flow: suggest → review → run(live) → report, with HITL-on-stuck, brain priming, and
 * (S8) a load-bearing autonomy ladder. Builds no new matcher/heal logic — it orchestrates S6 authoring +
 * S7 executor + S3 report + S2 brain + S8 ladder + the existing hitl-overlay.
 *
 * Dependencies (all must be loaded first): SELFHEAL (core), SELFHEAL_DIAGNOSIS, __TESTGEN (S6),
 * __RUNTIME (S7), SELFHEAL_REPORT (S3), SELFHEAL_BRAIN (S2), SELFHEAL_LEARN (S8). hitl is passed in
 * (the real __hitl overlay, or a canned auto-answerer for headless runs) so the shell itself stays
 * testable without a human.
 *
 * SCOPE / honest bounds:
 *   - Runs live on the interactive in-page fixture (synthetic events) — same bound as S7.
 *   - HITL fires when executeLive reports a step it could NOT locate (verdict abstain/fail). The shell
 *     SURFACES the pipeline's stuck signal + records the human decision as ground truth; it does NOT yet
 *     resolve-and-continue mid-test (that deeper loop is S9+). Stated, not hidden.
 *   - S8: the brain is now LOAD-BEARING, not just measured. Each run threads {brain, ladder} into
 *     __RUNTIME.executeLive; once a step's ladder tier reaches 'L2' (see learning-loop.js), the executor
 *     skips re-matching for that step and acts directly on the brain's cached (live-reverified) locator.
 *     verify-by-effect is NEVER skipped — only re-matching is. A per-run tally of brain-served vs
 *     matcher-served steps (session.brainServed/matcherServed) makes this measurable, not asserted.
 *   - Flywheel log: createSession() keeps an in-memory, PROCESS-LIFETIME (not durable — no persistence
 *     backend exists) array of every flywheel-event/v1 row ever produced by this session's run() calls.
 *     getFlywheelLog() reads it back. This is the first REAL (accumulating, not logged-then-discarded)
 *     use of the flywheel shape; it disappears when the tab/process ends. Stated, not hidden.
 */
(function (root) {
  const S = root.SELFHEAL, TG = root.__TESTGEN, RT = root.__RUNTIME,
        REP = root.SELFHEAL_REPORT, BRAIN = root.SELFHEAL_BRAIN, LEARN = root.SELFHEAL_LEARN;

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
    const ladder = opts.ladder || (LEARN ? LEARN.makeLadder() : null);
    need('SELFHEAL', S); need('__TESTGEN', TG); need('__RUNTIME', RT); need('SELFHEAL_REPORT', REP); need('SELFHEAL_BRAIN', BRAIN); need('SELFHEAL_LEARN', LEARN);
    if (typeof mount !== 'function') throw new Error('shell.js createSession: opts.mount(driftKind)→stageEl is required');

    let suite = null, approved = null;
    const flywheelLog = [];   // S8: in-memory, process-lifetime accumulation across every run() call — not durable

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

    // run the approved suite once under a given drift. useBrain=true → (S8) LOAD-BEARING: threads
    // {brain, ladder} into executeLive so a step promoted to 'L2' is acted on directly (matcher skipped);
    // still measures cache priming (hits/eligible) exactly as before, PLUS a servedTally of how many
    // steps were actually brain-served vs matcher-served this run (the observable proof the ladder did
    // something, not just a claim). useBrain=false → byte-identical to pre-S8 (no opts passed to
    // executeLive at all, ladder never consulted, ladder never advanced).
    async function run(o) {
      o = o || {};
      const drift = o.drift || 'pristine';
      const useBrain = !!o.useBrain;
      if (!suite) suggest();
      const tests = suite.tests.filter(t => approved.indexOf(t.id) !== -1);

      const results = [], rows = [], hitlFires = [];
      let brainHits = 0, brainEligible = 0, brainServed = 0, matcherServed = 0;

      for (const test of tests) {
        const stage = mount(drift);

        // brain priming MEASUREMENT: count how many of this test's real-anchor steps the brain would
        // already resolve on the current (possibly drifted) DOM — independent of ladder tier.
        if (useBrain) {
          test.steps.filter(s => s._anchor && s._anchor.stepId && BRAIN.isRealAnchor(s._anchor.target && s._anchor.target.bestLocator))
            .forEach(s => { brainEligible++; if (brain.get(test.id, s._anchor.stepId, doc)) brainHits++; });
        }

        const res = await RT.executeLive(stage, test, useBrain ? { brain, ladder } : undefined);   // P2 T5.1: executeLive is now async
        res._driftKind = drift;

        // S8 observability: tally how steps were actually served this run (brain-first vs matcher).
        res.steps.forEach(st => {
          if (st.servedBy === 'brain') brainServed++;
          else if (st.servedBy === 'matcher') matcherServed++;
        });

        if (res.located === false) {                 // STUCK → raise a HITL card, record the decision
          const decision = await hitl.show(cardFor(res));
          res._hitlDecision = decision && decision.action || 'skip';
          hitlFires.push({ test: res.id, category: res.category, decision: res._hitlDecision });
        } else {
          if (res.outcome === 'PASS' && res.verify_confidence === 'HIGH') {
            BRAIN.ingestLiveResult(brain, test, res);  // compound only verified-HIGH (OV#4)
          }
          // S8: advance the ladder for every step that reached verification (a locate FAILURE took the
          // branch above and never reaches here) — mirrors ingestLiveResult's "all steps that got there
          // are evidence for the whole test's outcome" rationale (brain.js header). A FAILED outcome
          // demotes+evicts regardless of confidence (aggressive, false-heal=0 discipline); only a HIGH-
          // confidence PASS promotes (OV#4); everything else (PASS_WARNING/ABSTAIN/non-HIGH PASS) is inert.
          //
          // EXCEPTION — category==='APP_BUG': this means locate+act succeeded but the app's own behavior
          // failed the assertion (the false-PASS guard, I25's located!=acted!=asserted distinction). That
          // is evidence the APP is wrong, not that the LOCATOR is wrong — demoting/evicting a correct
          // locator because of an unrelated app defect would defeat the cache on every unrelated bug.
          // Treat APP_BUG as neutral for the ladder (same as PASS_WARNING/ABSTAIN), never as a demote signal.
          if (ladder && res.category !== 'APP_BUG') {
            res.steps.forEach(st => {
              if (st.acted && st.stepId) ladder.record(test.id, st.stepId, res.outcome, res.verify_confidence, brain);
            });
          }
        }

        results.push(res);
        const row = toRow(res, app);
        rows.push(row);
        flywheelLog.push(row);   // S8: real, accumulating flywheel log — process-lifetime only, no durability
      }

      const report = REP.buildReport(rows);
      return { drift, results, rows, report, hitlFires,
               brainPriming: { hits: brainHits, eligible: brainEligible,
                               ratePct: brainEligible ? Math.round(100 * brainHits / brainEligible) : null },
               servedTally: { brainServed, matcherServed } };
    }

    return { suggest, setApproved, run, getSuite: () => suite, getApproved: () => approved.slice(), getBrain: () => brain,
             getLadder: () => ladder, getFlywheelLog: () => flywheelLog.slice() };
  }

  const API = { createSession, toRow };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.SELFHEAL_SHELL = API;
})(typeof window !== 'undefined' ? window : globalThis);
