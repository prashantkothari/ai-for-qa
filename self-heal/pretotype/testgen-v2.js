/* self-heal/pretotype/testgen-v2.js — AUTHORING ported to the coverage-model shape (self-heal/schemas/
 * coverage-model.schema.js), run side-by-side against testgen.js (v1) on the SAME LOGIN_DOM fixture.
 * New file, not an edit — v1 keeps shipping unchanged; see self-heal/pretotype/testgen-compare.html
 * for the head-to-head this enables (self-heal/docs/AUTHORING-MOCK-EXPERIMENT.md §7).
 *
 * What changes vs v1, concretely (not abstractly):
 *   - `expected` (NL prose) -> `expectation` (a symbolic condition string over registry symbols).
 *     v1 says "Visible text containing 'Dashboard' appears" (a human has to judge that at review
 *     time); v2 says `presence(dashboard_heading)` — a named symbol, checkable, not an opinion.
 *   - Free-form `openQuestions[]` -> named REFUSAL objects (reason from the closed taxonomy).
 *   - The icon-only eye-toggle button: v1 has NO matcher for it at all — it is silently invisible
 *     to authoring (no test, no question, nothing). v2 finds it (MATCH.iconOnly), registers it,
 *     and REFUSES it by name (`oracle-underdetermined`) instead of silently skipping it.
 *   - SSO: v1 ships one "positive" test asserting an unfalsifiable NL claim ("the SSO/provider flow
 *     begins"). v2 splits this: T-S1 tests only what's actually verifiable (the button is reachable),
 *     and a REFUSAL (`externally-gated`) names why OAuth completion isn't tested here.
 *
 * CELLS vs REFUSALS — the division of labor: a CELL's gap_type says "we could test this slice with
 * more effort" (missing-locale, missing-boundary, ...). A REFUSAL says "we structurally can't/won't,
 * and here's the named reason" (externally-gated, oracle-underdetermined, ...). A statement can have
 * both; the SSO outcome and the eye-toggle are refusals ONLY — inventing a gap_type for them would
 * misrepresent "we chose not to" as "we haven't gotten to it yet".
 *
 * dashboard_heading / error_banner / validation_message are FORWARD-DECLARED registry entries: they
 * live on screens (DASHBOARD_DOM / ERROR_DOM, per fixtures.js) this function never sees, since it
 * only receives the login screen's doc. Declared with match:null to mark them as not-live-captured —
 * same honesty rule as tagging a number `asserted` instead of `measured`.
 */
(function (root) {
  const S = root.SELFHEAL;
  const norm = s => (s || '').replace(/\s+/g, ' ').trim();

  const MATCH = {
    email:    ex => ex.type === 'email' || /e-?mail/i.test(ex.name || ex.nameAttr || ''),
    password: ex => ex.type === 'password' || /password/i.test(ex.name || ex.nameAttr || ''),
    submit:   ex => ex.type === 'submit' || /\b(sign ?in|log ?in|continue|next|submit|send( message)?|create account|place order)\b/i.test(ex.name || ''),
    sso:      ex => /google|sso|single ?sign|saml|okta|continue with/i.test(ex.name || ''),
    forgot:   ex => /forgot|reset/i.test(ex.name || ''),
    // no keyword to match against — an accessible NAME of '' is the signal itself (icon-only control)
    iconOnly: ex => ex.role === 'button' && !norm(ex.name)
  };
  function findControl(doc, key) {
    const els = S.WEB.candidates(doc);
    for (const el of els) { const ex = S.WEB.extract(el, doc); try { if (MATCH[key](ex)) return { el, ex }; } catch (e) {} }
    return null;
  }
  const anchorFor = (doc, hit, id) => hit ? S.captureStep(hit.el, doc, { stepId: id, container: '#appStage' }) : null;

  function authorCoverage(doc, opts) {
    opts = opts || {};
    const email = findControl(doc, 'email'), pwd = findControl(doc, 'password'), submit = findControl(doc, 'submit'),
          sso = findControl(doc, 'sso'), forgot = findControl(doc, 'forgot'), eye = findControl(doc, 'iconOnly');
    const isLogin = email && pwd && submit;
    if (!isLogin) {
      return { screen: null, elementRegistry: null, statements: [], tests: [], refusals: [], cells: [], testGoals: [],
        note: 'authorCoverage (v2) ports the login archetype only — same scope as v1\'s isLogin branch.' };
    }

    const screen = 'login_screen';
    const regEntries = [];
    function reg(symbol, hit, type) {
      if (!hit) return null;
      regEntries.push({ symbol, type, role: hit.ex.role || null, name_hint: norm(hit.ex.name) || null, match: null, hidden: null });
      return symbol;
    }
    const emailSym = reg('email_field', email, 'input');
    const pwdSym = reg('password_field', pwd, 'input');
    const submitSym = reg('submit_button', submit, 'button');
    const ssoSym = sso ? reg('sso_button', sso, 'button') : null;
    const forgotSym = forgot ? reg('forgot_link', forgot, 'link') : null;
    const eyeSym = eye ? reg('eye_toggle', eye, 'icon-only') : null;
    // forward-declared — see file header
    regEntries.push({ symbol: 'dashboard_heading', type: 'text', role: null, name_hint: 'Dashboard', match: null, hidden: null });
    regEntries.push({ symbol: 'error_banner', type: 'text', role: 'alert', name_hint: null, match: null, hidden: null });
    regEntries.push({ symbol: 'validation_message', type: 'text', role: null, name_hint: null, match: null, hidden: null });
    const elementRegistry = { screen, elements: regEntries };

    const anchors = {
      email: anchorFor(doc, email, 'email'), password: anchorFor(doc, pwd, 'password'),
      submit: anchorFor(doc, submit, 'submit'), sso: sso ? anchorFor(doc, sso, 'sso') : null,
      forgot: forgot ? anchorFor(doc, forgot, 'forgot') : null, eye: eye ? anchorFor(doc, eye, 'eye') : null
    };

    const SRC = 'login_screen DOM — inferred, no BRD supplied (asserted)';
    const statements = [
      { id: 'ST-1', text: 'A registered user can sign in with a correct email and password.', source: SRC, screens: ['login_screen', 'dashboard_screen'], criticality: 'critical' },
      { id: 'ST-2', text: 'An incorrect password is rejected with a visible error and the user is NOT signed in.', source: SRC, screens: ['login_screen'], criticality: 'critical' },
      { id: 'ST-3', text: 'Submitting with required fields empty is blocked with a visible validation message.', source: SRC, screens: ['login_screen'], criticality: 'supporting' },
      { id: 'ST-4', text: 'A federated sign-in option (SSO) is reachable from the login screen.', source: SRC, screens: ['login_screen'], criticality: 'supporting' },
      { id: 'ST-5', text: 'A password-recovery link is reachable from the login screen.', source: SRC, screens: ['login_screen'], criticality: 'supporting' },
      { id: 'ST-6', text: 'The password field visibility can be toggled.', source: SRC, screens: ['login_screen'], criticality: 'unknown' }
    ];

    const tests = [
      {
        id: 'T-L1', goal: 'Correct email + password reaches the authenticated dashboard.', statement: 'ST-1',
        cells_covered: ['ST-1/valid/web-desktop'], screens: ['login_screen', 'dashboard_screen'],
        steps: [
          { id: 'T-L1-01', condition: null, action: 'fill', target: emailSym, value: 'valid-tester@example.com', value_class: 'valid', produces: null, consumes: null, expectation: `equals(${emailSym}.value, "valid-tester@example.com")`, note: null },
          { id: 'T-L1-02', condition: null, action: 'fill', target: pwdSym, value: 'Sup3r-Secret-1!', value_class: 'valid', produces: null, consumes: null, expectation: `changed(${pwdSym}.value)`, note: null },
          { id: 'T-L1-03', condition: null, action: 'click', target: submitSym, value: null, value_class: null, produces: null, consumes: null, expectation: 'presence(dashboard_heading)', note: null },
          { id: 'T-L1-04', condition: null, action: 'assert-matches', target: 'dashboard_heading', value: null, value_class: null, produces: null, consumes: null, expectation: 'matches(dashboard_heading.text, /Dashboard/)', note: null }
        ],
        traceability: { spec_line: SRC, statement: 'ST-1', evidence_bundle: 'E-TL1' }
      },
      {
        id: 'T-L2', goal: 'A correct email with a wrong password is rejected; user is NOT signed in.', statement: 'ST-2',
        cells_covered: ['ST-2/negative/web-desktop'], screens: ['login_screen'],
        steps: [
          { id: 'T-L2-01', condition: null, action: 'fill', target: emailSym, value: 'valid-tester@example.com', value_class: 'valid', produces: null, consumes: null, expectation: `equals(${emailSym}.value, "valid-tester@example.com")`, note: null },
          { id: 'T-L2-02', condition: null, action: 'fill', target: pwdSym, value: 'wrong-password', value_class: 'adversarial', produces: null, consumes: null, expectation: `changed(${pwdSym}.value)`, note: null },
          { id: 'T-L2-03', condition: null, action: 'click', target: submitSym, value: null, value_class: null, produces: null, consumes: null, expectation: 'absence(dashboard_heading) AND presence(error_banner)', note: null },
          { id: 'T-L2-04', condition: null, action: 'assert-matches', target: 'error_banner', value: null, value_class: null, produces: null, consumes: null, expectation: 'matches(error_banner.text, /Invalid credentials/i)', note: null }
        ],
        traceability: { spec_line: SRC, statement: 'ST-2', evidence_bundle: 'E-TL2' }
      },
      {
        id: 'T-L3', goal: 'Submitting with required fields empty is blocked with a visible validation message.', statement: 'ST-3',
        cells_covered: ['ST-3/empty/web-desktop'], screens: ['login_screen'],
        steps: [
          { id: 'T-L3-01', condition: null, action: 'click', target: submitSym, value: null, value_class: 'empty', produces: null, consumes: null, expectation: 'absence(dashboard_heading) AND presence(validation_message)', note: 'Both fields left empty.' },
          { id: 'T-L3-02', condition: null, action: 'assert-matches', target: 'validation_message', value: null, value_class: null, produces: null, consumes: null, expectation: 'matches(validation_message.text, /required|enter your/i)', note: null }
        ],
        traceability: { spec_line: SRC, statement: 'ST-3', evidence_bundle: 'E-TL3' }
      }
    ];

    if (ssoSym) tests.push({
      id: 'T-S1', goal: 'The federated sign-in (SSO) option is reachable; completion is out of scope (see refusal R-2).', statement: 'ST-4',
      cells_covered: ['ST-4/happy/web-desktop'], screens: ['login_screen'],
      steps: [
        { id: 'T-S1-01', condition: null, action: 'assert-visible', target: ssoSym, value: null, value_class: null, produces: null, consumes: null, expectation: `presence(${ssoSym})`, note: null },
        { id: 'T-S1-02', condition: null, action: 'click', target: ssoSym, value: null, value_class: null, produces: null, consumes: null, expectation: `presence(${ssoSym})`, note: 'Click starts the federated flow; OUTCOME is externally-gated — see refusal R-2.' }
      ],
      traceability: { spec_line: SRC, statement: 'ST-4', evidence_bundle: 'E-TS1' }
    });

    if (forgotSym) tests.push({
      id: 'T-F1', goal: 'A password-recovery link is present and points at the reset flow.', statement: 'ST-5',
      cells_covered: ['ST-5/happy/web-desktop'], screens: ['login_screen'],
      steps: [
        { id: 'T-F1-01', condition: null, action: 'read', target: forgotSym, value: null, value_class: null, produces: 'forgot_href', consumes: null, expectation: null, note: null },
        { id: 'T-F1-02', condition: null, action: 'assert-equals', target: forgotSym, value: null, value_class: null, produces: null, consumes: ['forgot_href'], expectation: 'equals(forgot_href, "/forgot")', note: 'Full post-navigation verification needs live execution — out of scope for authoring-time schema.' }
      ],
      traceability: { spec_line: SRC, statement: 'ST-5', evidence_bundle: 'E-TF1' }
    });

    const refusals = [];
    if (eyeSym) refusals.push({ id: 'R-1', reason: 'oracle-underdetermined', statement_id: 'ST-6',
      note: 'Icon-only control (no accessible name/aria-label). No business-meaningful assertion beyond a CSS/type flip is knowable without a spec or aria-label — refusing to author a test until one exists.' });
    if (ssoSym) refusals.push({ id: 'R-2', reason: 'externally-gated', statement_id: 'ST-4',
      note: 'Google OAuth completion cannot be deterministically simulated in this runtime/fixture; only reachability (T-S1) is tested, not the federated flow\'s outcome.' });

    // the coverage grid — every row traces to a real test id (covered) or a named gap_type (not yet)
    const cells = [
      { statement_id: 'ST-1', platform: 'web-desktop', locale: 'en-US', network: null, authState: null, data_class: 'valid', screen_state: null, covered: true, gap_type: null },
      { statement_id: 'ST-1', platform: 'web-mobile', locale: 'en-US', network: null, authState: null, data_class: 'valid', screen_state: null, covered: false, gap_type: 'missing-cell' },
      { statement_id: 'ST-1', platform: 'web-desktop', locale: 'ja-JP', network: null, authState: null, data_class: 'unicode-name', screen_state: null, covered: false, gap_type: 'missing-locale' },
      { statement_id: 'ST-2', platform: 'web-desktop', locale: 'en-US', network: null, authState: null, data_class: 'adversarial', screen_state: null, covered: true, gap_type: null },
      { statement_id: 'ST-2', platform: 'web-desktop', locale: 'en-US', network: null, authState: null, data_class: 'boundary-high', screen_state: null, covered: false, gap_type: 'missing-boundary' },
      { statement_id: 'ST-3', platform: 'web-desktop', locale: 'en-US', network: null, authState: null, data_class: 'empty', screen_state: null, covered: true, gap_type: null },
      { statement_id: 'ST-4', platform: 'web-desktop', locale: 'en-US', network: null, authState: null, data_class: null, screen_state: null, covered: true, gap_type: null },
      { statement_id: 'ST-5', platform: 'web-desktop', locale: 'en-US', network: null, authState: null, data_class: null, screen_state: null, covered: true, gap_type: null }
    ];

    const testGoals = [
      { id: 'G-1', focus: 'Password field boundary values and SSO reachability under a degraded network, mobile viewport.',
        target_cells: ['ST-1/valid/web-mobile', 'ST-2/boundary-high/web-desktop'], duration_minutes: 30,
        capture: ['dom', 'screenshot'] }
    ];

    return { screen, elementRegistry, statements, tests, refusals, cells, testGoals, anchors };
  }

  root.__TESTGEN_V2 = { authorCoverage, findControl };
})(typeof window !== 'undefined' ? window : globalThis);
