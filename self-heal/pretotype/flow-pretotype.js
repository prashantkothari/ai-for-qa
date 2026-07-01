/* self-heal/pretotype/flow-pretotype.js — S0 Wizard-of-Oz runner for the whole product flow.
 *
 * REAL: selfheal-core (capture/match/heal/verify) · pipeline (diagnose/report) · hitl-overlay.
 * MOCKED: plugin shell · test generator (canned set) · executor (no live clicks) · brain · flywheel.
 *
 * Walks the four flows (plan §6), produces the run-report CONTRACT, then diffs the actual report +
 * HITL-fires + brain-after against the PRE-REGISTERED fixtures -> GO / REFINE / PIVOT. Deterministic.
 */
(function (root) {
  const S  = root.SELFHEAL;
  const DG = root.SELFHEAL_DIAGNOSIS;
  const RP = root.SELFHEAL_REPORTER;
  const F  = root.PRETOTYPE_FIXTURES;
  const MANUAL = /[?&]manual=1/.test(root.location ? root.location.search : '');

  const stage = () => document.getElementById('appStage');
  const $log = [];
  const log = m => { $log.push(m); };

  // ---------- mount + deterministic drift (operate on the live #appStage) ----------
  function mount(domString) { stage().innerHTML = domString; }
  function hash(s){ let h=0; for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0; return 'x'+h.toString(16)+'a1'; }
  function applyDrift(kind) {
    if (kind === 'pristine') return;
    const root = stage();
    if (kind === 'restyle') {                    // hash class + id (break cls/id signals); keep testid/name/text/structure
      root.querySelectorAll('*').forEach(el => {
        if (el.getAttribute('class')) el.setAttribute('class', hash(el.getAttribute('class')));
        if (el.id) el.id = hash(el.id);
      });
    } else if (kind === 'localize') {            // reverse visible text/aria-label/placeholder; keep testid/name/type/id
      const rev = s => (s||'').split('').reverse().join('');
      const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      const texts = []; let n; while ((n = walk.nextNode())) texts.push(n);
      texts.forEach(t => { if (t.nodeValue.trim()) t.nodeValue = rev(t.nodeValue); });
      root.querySelectorAll('[aria-label],[placeholder]').forEach(el => {
        if (el.getAttribute('aria-label')) el.setAttribute('aria-label', rev(el.getAttribute('aria-label')));
        if (el.getAttribute('placeholder')) el.setAttribute('placeholder', rev(el.getAttribute('placeholder')));
      });
    }
  }

  // ---------- mock brain (compounding store, keyed by AUTHORED TEST IDENTITY — plan GA-e) ----------
  const brain = { data:{}, flywheel:[] };
  const bkey = (testId, oracle) => testId + ':' + oracle;
  function brainGet(testId, oracle) {
    const e = brain.data[bkey(testId, oracle)]; if (!e) return null;
    try { const hit = stage().querySelectorAll(e.sel); if (hit.length === 1) return hit[0]; } catch (x) {}
    return null;                                   // key-miss / no-longer-unique -> cold start (never wrong reuse)
  }
  function brainPut(testId, oracle, el, step) {
    // cache ONLY a real CSS anchor (testid / stable-id / id-fragment / form-name). role+name and
    // no-anchor controls are NEVER cached -> they re-run the matcher every time (honest: anchored
    // majority caches; weak controls re-match and may need HITL). plan GA-e / brain = cache.
    const sel = step.target.bestLocator;
    if (!sel || !/^[\[#]/.test(sel)) return;
    brain.data[bkey(testId, oracle)] = { sel, oracle };
  }
  const fly = ev => brain.flywheel.push(ev);       // every labeled outcome -> the flywheel (F1)

  // ---------- HITL wrapper: record every fire; auto-resolve for the kill-gate (or show in ?manual=1) ----------
  const hitlFires = [];
  async function hitl(card, canned) {
    hitlFires.push({ when: card.kind, step: card.step || null, test: card.test || null,
                     flag: card.flag || null, category: card.category || null });
    if (MANUAL && root.__hitl) { try { return await root.__hitl.show(card); } catch (e) {} }
    return canned || { action: 'skip' };
  }

  // ---------- capture a recorded step from a live control (REAL captureStep) ----------
  function captureFor(oracle) {
    const el = stage().querySelector("[data-oracle='" + oracle + "']");
    return S.captureStep(el, document, { stepId: oracle, intent: oracle, container: '#appStage' });
  }

  // ---------- resolve one step on the current (possibly drifted) stage ----------
  function resolveStep(testId, step, oracle) {
    const cached = brainGet(testId, oracle);
    if (cached) return { resolution: 'cached', el: cached, correct: cached.getAttribute('data-oracle') === oracle, result: null };
    const r = S.matchStep(document, step, { gate: true });
    const healed = (r.verdict === 'heal');
    const el = r.best && r.best.el;
    const correct = healed && el ? el.getAttribute('data-oracle') === oracle : null;
    if (healed && correct) { brainPut(testId, oracle, el, step); fly({ testId, oracle, outcome: 'heal', verified: true }); }
    return { resolution: r.verdict, el, correct, result: r };
  }

  // ---------- run one test under one drift; return a report row ----------
  async function runTest(test, drift, recorded, scenario) {
    mount(F.LOGIN_DOM); applyDrift(drift);
    const stepRes = []; let failingStep = null, falseHeal = false, anyHeal = false, primed = 0;
    for (const oracle of test.steps) {
      const r = resolveStep(test.id, recorded[oracle], oracle);
      stepRes.push(r.resolution);
      if (r.resolution === 'cached') primed++;
      if (r.resolution === 'heal') { anyHeal = true; if (r.correct === false) falseHeal = true; } // healed to WRONG element
      if (r.resolution === 'abstain' || r.resolution === 'fail') { failingStep = { oracle, r: r.result }; break; }
    }
    const blocked = failingStep && (failingStep.r.verdict === 'abstain' || failingStep.r.verdict === 'fail');
    const resolution = blocked ? failingStep.r.verdict : (anyHeal ? 'heal' : 'cached');

    // locator could not resolve -> intelligent failure (NO action, NO assertion). diagnose + maybe HITL.
    if (blocked) {
      const diag = DG.diagnoseFailure(failingStep.r);
      const rep = RP.report(diag, recorded[failingStep.oracle]);
      await hitl({ kind: 'execute', test: test.id, category: diag.category, headline: rep.headline, reason: rep.detail }, { action: 'skip' });
      fly({ testId: test.id, oracle: failingStep.oracle, outcome: resolution, category: diag.category });
      return row(test, drift, resolution, diag.category, 'na', falseHeal, primed, rep.detail);
    }

    // located -> mock executor performs the action + swaps the post-action screen the scenario dictates
    const before = { text: stage().textContent };
    if (scenario === 'happy')   mount(F.DASHBOARD_DOM);
    else if (scenario === 'neg') mount(F.ERROR_DOM);
    else if (scenario === 'appbug') mount(F.STUCK_DOM);            // app defect: nothing navigates
    const after = { text: stage().textContent };

    // assertion oracle — the QA-defining check: "executed" != "passed"
    if (!test.assert || !test.assert.type) return row(test, drift, resolution, 'OK', 'na', false, primed, '—');
    const assertPass = S.verifyEffect(before, after, test.assert);
    if (assertPass) {
      const healedUnderDrift = (anyHeal && drift !== 'pristine');
      return row(test, drift, resolution, 'DRIFT', 'pass', falseHeal, primed, '—', healedUnderDrift ? 'PASS_HEALED' : 'PASS');
    }
    // assertion FAILED after a successful click -> APP BUG, NOT a heal (false-PASS guard, I25)
    return row(test, drift, resolution, 'APP_BUG', 'fail', falseHeal, primed,
               'assertion failed after a real action — app defect, not a locator problem', 'FAILED');
  }

  // ---------- report row (the CONTRACT S3/S6/S7 must emit) ----------
  const REMED = {
    AMBIGUITY: 'Add data-testid / aria-label to disambiguate',
    REMOVAL:   'Element not found — review or remove the step',
    APP_BUG:   'App defect — file a bug; do NOT heal',
    DRIFT:     'Healed automatically; add a testid to stabilize',
    OK: '—'
  };
  function row(test, drift, resolution, category, assertion, falseHeal, primed, detail, override) {
    const final = override || (resolution === 'abstain' ? 'ABSTAIN' : resolution === 'fail' ? 'FAILED' : 'PASS');
    const remediation = final === 'PASS_HEALED' ? REMED.DRIFT : (REMED[category] || '—');
    return { test: test.id, name: test.name, drift, resolution, primed,
             assertion, final, category, falseHeal, flaky: false, remediation, detail };
  }

  // ---------- the four flows ----------
  async function run() {
    if (!stage()) throw new Error('no #appStage');
    const rows = []; const review = {};

    // FLOW 1 — suggest + review (the wow + correction UX)
    mount(F.LOGIN_DOM);
    review.suggested = F.TESTS.map(t => t.id);
    review.approved = F.REVIEW.approve; review.edited = F.REVIEW.edited; review.skipped = F.REVIEW.skipped;
    review.pointedAt = F.REVIEW.pointedAt; review.screenshotOn = F.REVIEW.screenshotOn;
    const recorded = {};
    const approvedTests = F.TESTS.filter(t => review.approved.includes(t.id));
    for (const t of approvedTests) for (const oracle of t.steps) {
      if (recorded[oracle]) continue;
      const step = captureFor(oracle); recorded[oracle] = step;
      if (step.flag) await hitl({ kind: 'record', step: oracle, flag: step.flag,
        descriptor: step.target.descriptor, suggestedAnchor: step.target.bestLocator }, { action: 'skip' });
    }
    // the user "points to" a nameless control + "drops a screenshot" (correction UX)
    await hitl({ kind: 'record', step: review.pointedAt, flag: 'pointed-by-user',
                 title: 'User pointed to element + attached screenshot' }, { action: 'caption-icon', value: 'show password' });

    // FLOW 2 — happy path (+ brain priming on run-2)
    rows.push(await runTest(byId('T1'), 'pristine', recorded, 'happy'));
    rows.push({ ...(await runTest(byId('T1'), 'pristine', recorded, 'happy')), drift: 'pristine(run2)' }); // brain-primed

    // FLOW 3 — drift + abstain
    rows.push(await runTest(byId('T1'), 'restyle',  recorded, 'happy'));
    rows.push(await runTest(byId('T1'), 'localize', recorded, 'happy'));
    rows.push(await runTest(byId('T3'), 'pristine', recorded, 'happy'));   // nameless icon -> ABSTAIN + HITL

    // FLOW 4 — negative (expected-fail = pass) + app-bug (false-PASS guard)
    rows.push(await runTest(byId('T2'), 'pristine', recorded, 'neg'));
    rows.push(await runTest(byId('T4'), 'pristine', recorded, 'happy'));
    rows.push(await runTest(byId('T5'), 'pristine', recorded, 'happy'));
    rows.push({ ...(await runTest(byId('T1'), 'pristine', recorded, 'appbug')), drift: 'appbug' });

    const report = buildReport(rows, review);
    const verdict = killGate(report, rows);
    return { rows, review, report, hitlFires, brain: brain.data, flywheel: brain.flywheel, verdict, log: $log };
  }
  const byId = id => F.TESTS.find(t => t.id === id);

  function buildReport(rows, review) {
    const exec = { PASS:0, PASS_HEALED:0, FAILED:0, ABSTAIN:0 };
    rows.forEach(r => { exec[r.final] = (exec[r.final]||0) + 1; });
    return {
      screensCovered: ['login', 'dashboard'],
      testsGenerated: F.TESTS.length, testsApproved: review.approved.length,
      execStatus: exec,
      healed: rows.filter(r => r.final === 'PASS_HEALED').length,
      falseHealTotal: rows.filter(r => r.falseHeal).length,
      appBugsFound: rows.filter(r => r.category === 'APP_BUG').length
    };
  }

  // ---------- the kill-gate: diff actual vs PRE-REGISTERED expectations -> GO / REFINE / PIVOT ----------
  function killGate(report, rows) {
    const E = F.EXPECTED, div = [];
    const keyOf = r => r.test + '|' + (r.drift.startsWith('pristine') && r.drift !== 'pristine' ? 'pristine' : r.drift);
    // final outcomes
    for (const k in E.report.finals) {
      const r = rows.find(x => (x.test + '|' + x.drift) === k);
      if (!r) { div.push('missing run: ' + k); continue; }
      if (r.final !== E.report.finals[k]) div.push('final ' + k + ': expected ' + E.report.finals[k] + ' got ' + r.final);
    }
    for (const k in E.report.categories) {
      const r = rows.find(x => (x.test + '|' + x.drift) === k);
      if (r && r.category !== E.report.categories[k]) div.push('category ' + k + ': expected ' + E.report.categories[k] + ' got ' + r.category);
    }
    if (report.falseHealTotal !== E.report.falseHealTotal) div.push('falseHealTotal: expected ' + E.report.falseHealTotal + ' got ' + report.falseHealTotal);
    if (report.testsGenerated !== E.report.testsGenerated) div.push('testsGenerated mismatch');
    // HITL fires (expected must be a subset of actual)
    E.hitl.fires.forEach(f => {
      const hit = hitlFires.some(a => a.when === f.when && (f.step ? a.step === f.step : true) &&
        (f.flag ? a.flag === f.flag : true) && (f.test ? a.test === f.test : true) && (f.category ? a.category === f.category : true));
      if (!hit) div.push('missing HITL fire: ' + JSON.stringify(f));
    });
    // brain
    E.brain.cachedKeys.forEach(k => { if (!brain.data[k]) div.push('brain missing cached key: ' + k); });
    const run2 = rows.find(x => x.drift === 'pristine(run2)');
    if (E.brain.run2Primed && !(run2 && run2.resolution === 'cached')) div.push('run-2 not brain-primed (resolution=' + (run2 && run2.resolution) + ')');

    const falseHealOK = report.falseHealTotal === 0;
    let decision;
    if (!falseHealOK) decision = 'PIVOT';                      // the gating metric broke — stop
    else if (div.length === 0) decision = 'GO';
    else decision = 'REFINE';
    return { decision, falseHealOK, divergences: div };
  }

  root.__PRETOTYPE = { run };
})(typeof window !== 'undefined' ? window : globalThis);
