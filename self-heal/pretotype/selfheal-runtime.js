/* self-heal/pretotype/selfheal-runtime.js — S7 LIVE executor (prototype of the real selfheal-runtime).
 *
 * The missing keystone: snapshot -> resolve(+heal) -> ACT (real DOM events) -> observe -> verify-by-effect.
 * Turns S6's MOCK "asserted" into a REAL verified outcome, so verify_confidence is genuinely HIGH/MEDIUM
 * and the 3-way rule (outcome-verification.decide) applies — and HIGH outcomes become eligible to learn
 * from (learning-loop OV#4 gate), which simulated runs never were.
 *
 * SCOPE (pretotype): synthetic events on an INTERACTIVE in-page fixture. Real-app live execution needs
 * trusted events (chrome.debugger/CDP) + test-data/state safety -> the real MV3 extension, NOT here.
 */
(function (root) {
  const S = root.SELFHEAL, V = root.SELFHEAL_VERIFY;
  let _h = 0; const hash = s => { _h = 0; for (let i = 0; i < s.length; i++) _h = (_h * 31 + s.charCodeAt(i)) >>> 0; return _h; };

  // snapshot the observable state of a scope (+ whether a specific anchor element is still present)
  function snapshot(scopeEl, anchorStep) {
    let has = null;
    if (anchorStep) { try { const r = S.matchStep(scopeEl.ownerDocument, anchorStep, { gate: false }); has = r.verdict === 'heal'; } catch (e) {} }
    return { url: location.href, domHash: hash(scopeEl.innerHTML), text: (scopeEl.textContent || '').replace(/\s+/g, ' ').trim(), has };
  }

  // perform a real action on a located element (synthetic events — fine for our fixture's handlers)
  function act(el, action, value) {
    if (action === 'fill') {
      el.focus(); el.value = value == null ? '' : value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    if (action === 'click') { el.click(); return true; }   // real click → fires the page's handlers
    return false;
  }

  // resolve an OpenTest.ai step's NL target via its captured _anchor (heal-aware), then act
  function locateAndAct(scopeEl, step) {
    if (!step._anchor) return { located: false, acted: false, reason: 'no anchor' };
    const r = S.matchStep(scopeEl.ownerDocument, step._anchor, { gate: true });
    if (r.verdict !== 'heal' || !r.best) return { located: false, acted: false, verdict: r.verdict, result: r };
    const ok = act(r.best.el, step.action, step.value);
    return { located: true, acted: ok, el: r.best.el };
  }

  // confidence of the effect we can verify (mirrors outcome-verification.CONFIDENCE)
  function pickExpect(test, navigatedAway, dashboardText) {
    // positive flows that unmount the recorded field → elementGone (HIGH). else text presence (MEDIUM).
    if (test.kind !== 'negative' && navigatedAway) return { type: 'elementGone' };
    return { type: 'textPresent', value: dashboardText };
  }

  // execute a whole OpenTest.ai test LIVE against a scope element; return the verified 3-way outcome
  function executeLive(scopeEl, test) {
    const steps = []; let blocked = null;
    // sentinel anchor = the test's first fill target (the field that should disappear on success)
    const sentinel = (test.steps.find(s => s.action === 'fill') || {})._anchor || null;
    const before = snapshot(scopeEl, sentinel);

    for (const st of test.steps) {
      const row = { action: st.action, target: st.target, value: st.value || null, located: null, acted: false };
      if (st.action === 'navigate') { row.acted = true; steps.push(row); continue; }
      if (st.action === 'assert') { steps.push(row); continue; }     // assert handled by verify below
      const a = locateAndAct(scopeEl, st);
      row.located = a.located; row.acted = a.acted;
      steps.push(row);
      if (!a.located) { blocked = { st, r: a.result }; break; }
    }

    if (blocked) {
      const d = root.SELFHEAL_DIAGNOSIS.diagnoseFailure(blocked.r);
      return { id: test.id, title: test.title, kind: test.kind, goal: test.goal, steps,
               located: false, outcome: blocked.r.verdict === 'abstain' ? 'ABSTAIN' : 'FAILED',
               category: d.category, confidence: 'NONE', verified: false,
               verify_confidence: 'NONE', prescription: 'add a stable test-id / container hint' };
    }

    // observe + verify-by-effect (REAL state change)
    const after = snapshot(scopeEl, sentinel);
    const navigatedAway = before.has === true && after.has === false;     // recorded field gone → real nav
    const assertStep = test.steps.find(s => s.action === 'assert');
    const dashKw = assertStep ? assertStep.target : null;

    let verified, confidence, outcome, category;
    if (test.kind === 'negative') {
      // negative passes when the error condition appears AND we did NOT navigate to success
      const errPresent = assertStep ? new RegExp(dashKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(after.text) : false;
      verified = errPresent && !/dashboard/i.test(after.text);
      confidence = 'MEDIUM'; category = verified ? 'NEG_OK' : 'APP_BUG';
      outcome = verified ? 'PASS' : 'FAILED';
    } else if (!assertStep) {
      // smoke: acted, but no business effect declared → unverifiable → PASS_WARNING (queue human, OV#4)
      verified = null; confidence = 'NONE'; category = 'SMOKE';
      const decSmoke = V.decide(true, { passed: false, confidence: 'NONE' });
      outcome = decSmoke.outcome === 'PASSED_WARNING' ? 'PASS_WARNING' : decSmoke.outcome;   // same translation as below — one outcome vocabulary
    } else {
      const expect = pickExpect(test, navigatedAway, dashKw);
      // build before/after for core verifyEffect (elementGone uses .has; textPresent uses .text)
      verified = S.verifyEffect(before, after, expect);
      confidence = expect.type === 'elementGone' ? 'HIGH' : 'MEDIUM';
      const dec = V.decide(true, { passed: verified, confidence });
      outcome = dec.outcome === 'PASSED' ? 'PASS' : (dec.outcome === 'PASSED_WARNING' ? 'PASS_WARNING' : 'FAILED');
      category = verified ? 'VERIFIED' : 'APP_BUG';
    }

    return { id: test.id, title: test.title, kind: test.kind, goal: test.goal, steps,
             located: true, navigatedAway, outcome, category, verified,
             confidence, verify_confidence: confidence,
             prescription: outcome === 'FAILED' ? 'App defect — assertion failed after a REAL action; file a bug' :
                           outcome === 'PASS_WARNING' ? 'unverifiable (no effect declared) — queue for human review' : '—' };
  }

  root.__RUNTIME = { snapshot, act, locateAndAct, executeLive };
})(typeof window !== 'undefined' ? window : globalThis);
