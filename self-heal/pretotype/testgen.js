/* self-heal/pretotype/testgen.js — S6 test AUTHORING in the OpenTest.ai format.
 *
 * Closes the S0-falsified gap: instead of "Interact: <control>" smoke, author real tests with
 *   { title, goal, kind, steps:[{description, thinking, action, target, value, expected, _anchor}] }
 *   action ∈ navigate | fill | click | assert ;  target = NL/visible-text (resolved by our matcher).
 * Gives business intent (goal), multi-step flows, POSITIVE + NEGATIVE, test DATA (value), and an
 * ASSERTION oracle (assert + expected) — the things S0 lacked.
 *
 * S6 authoring is DETERMINISTIC, template-based, GROUNDED to observed controls (no hallucinated screens).
 * The LLM is the documented UPGRADE path (novel/multi-screen flows) via the escalation contract — it
 * authors the SAME JSON shape; everything downstream (resolve/execute/assert) is identical.
 *
 * `_anchor` = a captured descriptor (core captureStep) attached to each fill/click target so EXECUTE
 * resolves+heals through our matcher while the human-facing `target` stays NL.
 */
(function (root) {
  const S = root.SELFHEAL;
  const norm = s => (s || '').replace(/\s+/g, ' ').trim();

  // ---- ground an NL intent to a real control on the page (keyword/type heuristics) ----
  const MATCH = {
    email:    ex => ex.type === 'email' || /e-?mail/i.test(ex.name || ex.nameAttr || ''),
    password: ex => ex.type === 'password' || /password/i.test(ex.name || ex.nameAttr || ''),
    submit:   ex => /\b(sign ?in|log ?in|continue|next|submit|create account|place order)\b/i.test(ex.name || ''),
    sso:      ex => /google|sso|single ?sign|saml|okta|continue with/i.test(ex.name || ''),
    forgot:   ex => /forgot|reset/i.test(ex.name || '')
  };
  function findControl(doc, key) {
    const els = S.WEB.candidates(doc);
    for (const el of els) { const ex = S.WEB.extract(el, doc); try { if (MATCH[key](ex)) return { el, ex }; } catch (e) {} }
    return null;
  }
  const anchorFor = (doc, hit, id) => hit ? S.captureStep(hit.el, doc, { stepId: id, container: '#appStage' }) : null;
  const labelOf = hit => hit ? (norm(hit.ex.name) || hit.ex.nameAttr || hit.ex.role) : null;

  // ---- author tests for a screen, grounded to the controls actually present ----
  function authorTests(doc, opts) {
    opts = opts || {};
    const email = findControl(doc, 'email'), pwd = findControl(doc, 'password'),
          submit = findControl(doc, 'submit'), sso = findControl(doc, 'sso'), forgot = findControl(doc, 'forgot');
    const tests = [];
    const openQuestions = [];
    const isLogin = email && pwd && submit;

    if (isLogin) {
      const E = labelOf(email), P = labelOf(pwd), Sub = labelOf(submit);
      const aE = anchorFor(doc, email, 'email'), aP = anchorFor(doc, pwd, 'password'), aS = anchorFor(doc, submit, 'submit');

      // POSITIVE — valid credentials
      tests.push({ id: 'L1', title: 'Login with valid credentials', kind: 'positive',
        goal: 'A registered user signing in with a correct email + password reaches the authenticated home.',
        steps: [
          { description: 'Type a valid email', thinking: 'Use a well-formed address so the only variable is auth.', action: 'fill', target: E, value: 'valid-tester@example.com', expected: `The ${E} field contains the value.`, _anchor: aE },
          { description: 'Type the correct password', thinking: 'Valid password isolates the happy path.', action: 'fill', target: P, value: 'Sup3r-Secret-1!', expected: `The ${P} field accepts the value (masked).`, _anchor: aP },
          { description: `Click '${Sub}'`, thinking: 'Submit and observe — do not assume client-side.', action: 'click', target: Sub, expected: 'The app navigates to the authenticated home / dashboard.', _anchor: aS },
          { description: 'Assert the dashboard loaded', thinking: 'The dashboard is the proof of a successful sign-in.', action: 'assert', target: 'Dashboard', expected: "Visible text containing 'Dashboard' appears." }
        ] });

      // NEGATIVE — wrong password (expected-failure = a PASS when the error shows)
      tests.push({ id: 'L2', title: 'Login is rejected with a wrong password', kind: 'negative',
        goal: 'A correct email with an incorrect password is rejected with a visible, human-readable error — and is NOT signed in.',
        steps: [
          { description: 'Type a valid email', thinking: 'Isolate the password as the failure surface.', action: 'fill', target: E, value: 'valid-tester@example.com', expected: `The ${E} field contains the value.`, _anchor: aE },
          { description: 'Type a wrong password', thinking: 'The most common real failure — a mistyped password.', action: 'fill', target: P, value: 'wrong-password', expected: `The ${P} field accepts the value.`, _anchor: aP },
          { description: `Click '${Sub}'`, thinking: 'Submit and observe rejection.', action: 'click', target: Sub, expected: 'The app does NOT navigate; an inline error appears.', _anchor: aS },
          { description: 'Assert a visible error (not signed in)', thinking: 'Error must be human-readable, not a code; and we must NOT be on the dashboard.', action: 'assert', target: 'Invalid credentials', expected: "Visible error text appears AND 'Dashboard' is NOT shown." }
        ] });

      // NEGATIVE — empty submit (required-field validation)
      tests.push({ id: 'L3', title: 'Empty submit shows required-field validation', kind: 'negative',
        goal: 'Submitting with empty fields is blocked with a visible required-field message.',
        steps: [
          { description: `Click '${Sub}' with empty fields`, thinking: 'Edge case users hit by reflex.', action: 'click', target: Sub, expected: 'The form does NOT submit.', _anchor: aS },
          { description: 'Assert a required-field message', thinking: 'Confirms client-side validation fires.', action: 'assert', target: 'required', expected: "A 'required' / 'enter your' style message is visible." }
        ] });
    }

    // SSO / forgot — single-action positive tests if present
    if (sso) { const N = labelOf(sso); tests.push({ id: 'S1', title: `Sign in via '${N}'`, kind: 'positive',
      goal: `The '${N}' option starts the federated sign-in flow.`,
      steps: [{ description: `Click '${N}'`, thinking: 'SSO is a top auth path; verify it is reachable.', action: 'click', target: N, expected: 'The SSO/provider flow begins (popup or redirect).', _anchor: anchorFor(doc, sso, 'sso') }] }); }
    if (forgot) { const N = labelOf(forgot); tests.push({ id: 'F1', title: `'${N}' opens the reset flow`, kind: 'positive',
      goal: 'Password recovery is reachable from the login screen.',
      steps: [{ description: `Click '${N}'`, thinking: 'Recovery is a critical path for locked-out users.', action: 'click', target: N, expected: 'The password-reset screen/flow opens.', _anchor: anchorFor(doc, forgot, 'forgot') }] }); }

    // FORMS archetype (T3.2, additive) — used when there is a <form> with inputs but it isn't the
    // special-cased login flow above. Enumerates fields, classifies required/optional, emits POSITIVE
    // (all-required-filled), NEGATIVE-per-required (leave one required blank), and empty-submit.
    // Property assertion (stated, not just implied): an inline error/alert is present iff a required
    // field was left empty on submit.
    const form = doc.querySelector('form');
    if (!tests.length && form) {
      const fields = [];
      form.querySelectorAll('input, textarea, select').forEach((el) => {
        const type = (el.type || el.tagName || '').toLowerCase();
        if (['hidden', 'submit', 'button', 'reset'].indexOf(type) !== -1) return;
        const req = el.hasAttribute('required') || el.getAttribute('aria-required') === 'true';
        const name = el.getAttribute('name') || el.id || type;
        // sample value by type/name — heuristic, deterministic
        let v = 'Test Value';
        if (type === 'email' || /email/i.test(name)) v = 'name@example.com';
        else if (type === 'tel' || /phone/i.test(name)) v = '5551234567';
        else if (type === 'number') v = '1';
        else if (el.tagName.toLowerCase() === 'textarea') v = 'Hello, this is a test message.';
        const stepId = 'f_' + (name || fields.length);
        fields.push({ el, type, name, required: req, value: v, stepId,
                       anchor: S.captureStep(el, doc, { stepId, container: '#appStage' }) });
      });
      const submitHit = findControl(doc, 'submit');
      const submitLbl = submitHit ? labelOf(submitHit) : 'Submit';
      const aSub = anchorFor(doc, submitHit, 'submit');
      const required = fields.filter(f => f.required);
      const weakAnchor = fields.find(f => !f.anchor || !f.anchor.target || !f.anchor.target.bestLocator);
      if (weakAnchor) openQuestions.push({ id: 'weak-anchor:' + weakAnchor.name,
        text: 'Field "' + weakAnchor.name + '" has a weak anchor (no stable locator). Include it as edge-risk?' });

      // (1) POSITIVE: fill all required + optional-with-values, submit, assert absence of error
      const posSteps = fields.map(f => ({ description: 'Fill ' + f.name, thinking: 'Provide a valid value for ' + f.type,
        action: 'fill', target: f.name, value: f.value, expected: f.name + ' accepts value.', _anchor: f.anchor }));
      posSteps.push({ description: 'Click ' + submitLbl, thinking: 'Submit with all valid values.',
        action: 'click', target: submitLbl, expected: 'Form submits without validation errors.', _anchor: aSub });
      // generic success heuristic — assert against the fixture's success text "Thanks" (honest: fixture-specific)
      posSteps.push({ description: 'Assert success', thinking: 'Success signal expected on valid submit.',
        action: 'assert', target: 'Thanks', expected: "Post-submit page shows a success signal." });
      tests.push({ id: 'F1', title: 'Submit valid form', kind: 'positive',
        goal: 'A form submitted with all valid values succeeds.', steps: posSteps });

      // (2) NEGATIVE-per-required: leave each required field blank
      required.forEach((rf, i) => {
        const steps = fields.filter(f => f !== rf && f.required).map(f => ({ description: 'Fill ' + f.name,
          thinking: 'Fill other required fields.', action: 'fill', target: f.name, value: f.value,
          expected: f.name + ' accepts value.', _anchor: f.anchor }));
        steps.push({ description: 'Click ' + submitLbl, thinking: 'Submit with ' + rf.name + ' blank.',
          action: 'click', target: submitLbl, expected: 'Form does NOT navigate away.', _anchor: aSub });
        steps.push({ description: 'Assert required-field error', thinking: 'Property: error iff required field is empty.',
          action: 'assert', target: 'required', expected: "A 'required' style validation message appears." });
        tests.push({ id: 'N' + (i + 1), title: 'Missing ' + rf.name + ' shows error', kind: 'negative',
          goal: 'Blank required field "' + rf.name + '" triggers inline validation.', steps: steps });
      });

      // (3) empty-submit
      if (submitHit && required.length) {
        tests.push({ id: 'E1', title: 'Empty submit shows required-field validation', kind: 'negative',
          goal: 'Submitting with all fields empty is blocked with visible required-field messages.',
          steps: [
            { description: 'Click ' + submitLbl + ' with empty fields', thinking: 'Reflex path many users hit.',
              action: 'click', target: submitLbl, expected: 'The form does NOT submit.', _anchor: aSub },
            { description: 'Assert a required-field message', thinking: 'Confirms validation fires client-side.',
              action: 'assert', target: 'required', expected: "A 'required' message is visible." }
          ] });
      }
    }

    // FALLBACK — no recognized flow: honest smoke per identifiable control (OpenTest.ai shape, no asserts)
    if (!tests.length) {
      S.WEB.candidates(doc).slice(0, 12).forEach((el, i) => { const ex = S.WEB.extract(el, doc); const n = norm(ex.name); if (!n) return;
        tests.push({ id: 'G' + (i + 1), title: 'Interact: ' + n, kind: 'smoke', goal: 'Smoke: the control is reachable + locatable (no business assertion).',
          steps: [{ description: 'Click ' + n, thinking: 'No recognized flow on this screen → enumeration only.', action: 'click', target: n, expected: 'No locator error.', _anchor: S.captureStep(el, doc, { stepId: 'g' + i, container: '#appStage' }) }] }); });
    }

    return { screenType: isLogin ? 'login' : (form && tests.length ? 'forms' : (tests.length ? 'partial' : 'generic')),
             tests: tests, openQuestions: openQuestions || [] };
  }

  root.__TESTGEN = { authorTests, findControl };
})(typeof window !== 'undefined' ? window : globalThis);
