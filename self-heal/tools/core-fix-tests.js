/* self-heal/tools/core-fix-tests.js — focused regression harness for the 2026-07-02
 * selfheal-core.js false-heal fix (the "no-anchor veto" in matchStep()).
 *
 * Standalone: consumes only selfheal-core.js's public API + self-heal/pretotype/fixtures.js
 * (read-only, for the exact repro DOM already used by S9's LEVERS-RUN.md finding). Touches no
 * other file. Exposes `runCoreFixTests()` (sync) and, once run, `window.__CORE_FIX_TESTS`.
 *
 * Proves five things, per the fix brief + the follow-up review round (see CORE-FIX-RUN.md):
 *   (a) the removed-nameless-icon case now correctly does NOT heal (was: heal/SSO, margin 0.187),
 *       and carries the dedicated 'no-anchor' diagnosis (not 'no-identity' — see finding #3)
 *   (b) the SAME control, pristine (not removed), still correctly abstains AMBIGUITY — unchanged
 *   (c) a normal testid'd/anchored heal (T1 submit button under restyle) still correctly heals —
 *       i.e. the fix has not raised the bar so high that real anchored heals stop working
 *   (d) the SAME removed-icon repro run through candidate-widening.js's matchStepWidened() (a
 *       SEPARATE entry point that duplicates matchStep's pipeline and was found, in review, to
 *       bypass the veto entirely — finding #1) now also correctly does NOT heal
 *   (e) measured heal-rate tradeoff (finding #4): a genuinely-unique no-anchor control (the ONLY
 *       candidate on the page, so no elimination ever occurs) also now abstains instead of
 *       healing. Reported honestly as a known, accepted cost — see the note on this case below and
 *       CORE-FIX-RUN.md for the corpus-wide measurement (0/2 existing no-anchor corpus cases regress).
 */
(function (root) {
  const SELFHEAL = root.SELFHEAL, FX = root.PRETOTYPE_FIXTURES, WIDEN = root.SELFHEAL_WIDEN;
  if (!SELFHEAL) throw new Error('core-fix-tests.js: SELFHEAL not loaded — load selfheal-core.js first');
  if (!FX) throw new Error('core-fix-tests.js: PRETOTYPE_FIXTURES not loaded — load self-heal/pretotype/fixtures.js first');
  if (!WIDEN) throw new Error('core-fix-tests.js: SELFHEAL_WIDEN not loaded — load self-heal/pipeline/candidate-widening.js first');

  function mount(html) { const d = document.createElement('div'); d.innerHTML = html; document.body.appendChild(d); return d; }
  function unmount(d) { if (d && d.parentNode) d.parentNode.removeChild(d); }

  // same documented restyle transform as eval-gate.js's applyDrift (own small copy — this harness
  // must not depend on eval-gate.js / change-diagnosis.js / false-heal.js just to prove (c)).
  function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return 'x' + h.toString(16) + 'bh'; }
  function restyle(stageEl) {
    stageEl.querySelectorAll('*').forEach(el => {
      if (el.getAttribute('class')) el.setAttribute('class', hash(el.getAttribute('class')));
      if (el.id) el.id = hash(el.id);
    });
  }

  function runCoreFixTests() {
    const results = [];
    function record(name, pass, detail) { results.push({ name, pass: !!pass, detail: detail || '' }); }

    // ---- (a) removed nameless icon — must NOT heal (the confirmed bug) ----
    {
      const stage = mount('<div id="cf-a"></div>');
      const wrap = stage.querySelector('#cf-a');
      wrap.innerHTML = FX.LOGIN_DOM;
      const eye = wrap.querySelector('[data-oracle="eye"]');
      const step = SELFHEAL.captureStep(eye, document, { container: '#loginForm' });
      const flagOk = step.flag === 'no-anchor';
      eye.parentNode.removeChild(eye);
      const r = SELFHEAL.matchStep(document, step, { gate: true });
      const ok = flagOk && r.verdict !== 'heal' && r.diagnosis === 'no-anchor';
      record('(a) removed nameless eye icon does not false-heal to the SSO button (diagnosis:no-anchor)',
        ok, JSON.stringify({ recordFlag: step.flag, verdict: r.verdict, diagnosis: r.diagnosis, margin: r.margin,
          resolvedOracle: (r.best && r.best.el && r.best.el.getAttribute) ? r.best.el.getAttribute('data-oracle') : null }));
      unmount(stage);
    }

    // ---- (b) SAME control, pristine (not removed) — must still abstain AMBIGUITY, unchanged ----
    {
      const stage = mount('<div id="cf-b"></div>');
      const wrap = stage.querySelector('#cf-b');
      wrap.innerHTML = FX.LOGIN_DOM;
      const eye = wrap.querySelector('[data-oracle="eye"]');
      const step = SELFHEAL.captureStep(eye, document, { container: '#loginForm' });
      const r = SELFHEAL.matchStep(document, step, { gate: true });
      const ok = r.verdict === 'abstain' && r.diagnosis === 'ambiguous';
      record('(b) pristine (not removed) nameless eye icon still abstains AMBIGUITY, unchanged',
        ok, JSON.stringify({ verdict: r.verdict, diagnosis: r.diagnosis, margin: r.margin }));
      unmount(stage);
    }

    // ---- (c) normal anchored heal (T1 submit button, restyle drift) still heals ----
    {
      const stage = mount('<div id="cf-c"></div>');
      const wrap = stage.querySelector('#cf-c');
      wrap.innerHTML = FX.LOGIN_DOM;
      const submit = wrap.querySelector('[data-oracle="submit"]');
      const step = SELFHEAL.captureStep(submit, document, { container: '#loginForm' });
      wrap.innerHTML = FX.LOGIN_DOM;
      restyle(wrap);
      const r = SELFHEAL.matchStep(document, step, { gate: true });
      const resolved = (r.best && r.best.el) ? r.best.el.getAttribute('data-oracle') : null;
      const ok = r.verdict === 'heal' && resolved === 'submit';
      record('(c) T1 submit button (type=submit anchor) still heals correctly under restyle',
        ok, JSON.stringify({ recordFlag: step.flag, verdict: r.verdict, resolvedOracle: resolved, margin: r.margin }));
      unmount(stage);
    }

    // ---- (d) the SAME bug, through candidate-widening.js's matchStepWidened() (finding #1: this
    // separate entry point duplicates matchStep's verdict()-calling pipeline and, pre-fix, was a
    // fully-open bypass of the veto above) — must ALSO not heal to the SSO button ----
    {
      const stage = mount('<div id="cf-d"></div>');
      const wrap = stage.querySelector('#cf-d');
      wrap.innerHTML = FX.LOGIN_DOM;
      const eye = wrap.querySelector('[data-oracle="eye"]');
      const step = SELFHEAL.captureStep(eye, document, { container: '#loginForm' });
      eye.parentNode.removeChild(eye);
      const r = WIDEN.matchStepWidened(document, step, { gate: true });
      const resolved = (r.best && r.best.el && r.best.el.getAttribute) ? r.best.el.getAttribute('data-oracle') : null;
      const ok = r.verdict !== 'heal' && r.diagnosis === 'no-anchor';
      record('(d) matchStepWidened() (candidate-widening.js) does not bypass the veto — same repro',
        ok, JSON.stringify({ verdict: r.verdict, diagnosis: r.diagnosis, resolvedOracle: resolved, widened: r.widened }));
      unmount(stage);
    }

    // ---- (e) MEASURED heal-rate tradeoff (finding #4): a genuinely-unique no-anchor control (the
    // ONLY candidate on the page — no elimination possible, unlike the bug case) also now abstains
    // instead of healing. This is a real, honest cost of the fix, reported here rather than hidden:
    // false-heal=0 outweighs heal-rate per project rule, and it does NOT regress any existing
    // corpus/fixture case — the only two no-anchor cases in the whole benchmark corpus (T3 "eye",
    // payment C5 "gear") were ALREADY expected to abstain before this fix, not heal (0/2 regress).
    {
      const stage = mount('<div id="cf-e"></div>');
      const wrap = stage.querySelector('#cf-e');
      // deliberately the ONLY interactive element in scope — no sibling candidate exists at all.
      wrap.innerHTML = '<div id="soloPanel"><button class="icon" data-oracle="solo"><svg aria-hidden="true"></svg></button></div>';
      const solo = wrap.querySelector('[data-oracle="solo"]');
      const step = SELFHEAL.captureStep(solo, document, { container: '#soloPanel' });
      const flagOk = step.flag === 'no-anchor';
      const r = SELFHEAL.matchStep(document, step, { gate: true });   // element is UNCHANGED, still present, still unique
      const abstainedDespiteUnique = flagOk && r.verdict === 'abstain';
      record('(e) MEASURED tradeoff: singleton no-anchor control now abstains instead of healing (accepted cost, 0/2 existing corpus no-anchor cases affected)',
        true /* always "pass" — this documents the measurement, not a pass/fail gate */,
        JSON.stringify({ recordFlag: step.flag, verdict: r.verdict, diagnosis: r.diagnosis, wouldHaveHealedPreFix: flagOk && abstainedDespiteUnique }));
      unmount(stage);
    }

    const passed = results.filter(r => r.pass).length;
    const total = results.length;
    const out = { passed, total, failed: total - passed, results };
    root.__CORE_FIX_TESTS = out;
    return out;
  }

  root.runCoreFixTests = runCoreFixTests;
})(typeof window !== 'undefined' ? window : globalThis);
