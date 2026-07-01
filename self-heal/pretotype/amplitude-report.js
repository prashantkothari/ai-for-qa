/* self-heal/pretotype/amplitude-report.js — run the proto's PRE-EXECUTION + EXECUTE report against a
 * REAL app DOM (captured into window.name). REAL: selfheal-core + pipeline. MOCKED: test-gen (canned,
 * grounded to the real DOM), executor (drift-simulated; no live clicks — no runtime yet, S7).
 *
 * Layout-less DOMParser doc -> matchStep runs with {gate:false, scopeVisible:false} (the gong/amplitude
 * harness pattern). So STATE_ISSUE/overlay gating is NOT exercised here (no layout) — flagged honestly.
 */
(function (root) {
  const S = root.SELFHEAL, DG = root.SELFHEAL_DIAGNOSIS;
  const norm = s => (s || '').replace(/\s+/g, ' ').trim();

  // intent -> matcher over an extracted ex (keyword/type heuristics; brittle on purpose — see dev take)
  const INTENTS = {
    email:    ex => ex.type === 'email' || /e-?mail/i.test(ex.name || ex.nameAttr || ''),
    password: ex => ex.type === 'password' || /password/i.test(ex.name || ex.nameAttr || ''),
    submit:   ex => /\b(continue|log ?in|sign ?in|next|submit)\b/i.test(ex.name || ''),
    sso:      ex => /google|sso|single ?sign|saml|okta|continue with/i.test(ex.name || ''),
    forgot:   ex => /forgot|reset/i.test(ex.name || ''),
    signup:   ex => /sign ?up|create account|get started|register/i.test(ex.name || '')
  };

  const TESTS = [
    { id: 'T1', name: 'Login — valid credentials', kind: 'positive', steps: ['email', 'password', 'submit'] },
    { id: 'T2', name: 'Login — wrong password (negative)', kind: 'negative', steps: ['email', 'password', 'submit'] },
    { id: 'T3', name: 'Sign in with Google / SSO', kind: 'positive', steps: ['sso'] },
    { id: 'T4', name: 'Forgot password', kind: 'positive', steps: ['forgot'] },
    { id: 'T5', name: 'Sign up — new account', kind: 'positive', steps: ['signup'] }
  ];

  function hash(s){ let h=0; for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0; return 'x'+h.toString(16)+'z'; }
  function restyle(doc){ doc.querySelectorAll('*').forEach(el=>{ if(el.getAttribute('class')) el.setAttribute('class',hash(el.getAttribute('class'))); if(el.id) el.id=hash(el.id); }); }
  function localize(doc){ const rev=s=>(s||'').split('').reverse().join('');
    const w=doc.createTreeWalker(doc.body||doc.documentElement, NodeFilter.SHOW_TEXT, null); const t=[]; let n; while((n=w.nextNode())) t.push(n);
    t.forEach(x=>{ if(x.nodeValue.trim()) x.nodeValue=rev(x.nodeValue); });
    (doc.querySelectorAll('[aria-label],[placeholder]')||[]).forEach(el=>{ if(el.getAttribute('aria-label')) el.setAttribute('aria-label',rev(el.getAttribute('aria-label'))); if(el.getAttribute('placeholder')) el.setAttribute('placeholder',rev(el.getAttribute('placeholder'))); }); }

  function run(html) {
    const baseDoc = new DOMParser().parseFromString(html, 'text/html');
    const cands = S.WEB.candidates(baseDoc);
    // tag every candidate with a ground-truth oracle that survives serialization + drift
    cands.forEach((el, i) => el.setAttribute('data-oracle', 'o' + i));
    const elements = cands.map((el, i) => {
      const ex = S.WEB.extract(el, baseDoc); const loc = S.bestLocator(ex);
      const step = S.captureStep(el, baseDoc, { stepId: 'o' + i });
      return { oracle: 'o' + i, role: ex.role, name: norm(ex.name) || null, tag: ex.tag,
               testid: ex.testid || null, tier: loc.tier, flag: step.flag, predicted: step.target.confidence, step };
    });

    // ---- PRE-EXECUTION: ground each authored step to a real element ----
    const findFor = key => elements.find(e => { try { return INTENTS[key](e.step && S.descFromStep ? exOf(e) : e); } catch (x) { return false; } });
    const exOf = e => ({ name: e.name, nameAttr: null, type: null, role: e.role }); // light ex for INTENTS
    function ground(key) {
      // prefer testid/strong anchor among matches
      const ms = elements.filter(e => { try { return INTENTS[key]({ name: e.name, nameAttr: e.testid, type: typeHint(e), role: e.role }); } catch (x) { return false; } });
      ms.sort((a, b) => tierRank(b.tier) - tierRank(a.tier));
      return ms[0] || null;
    }
    const typeHint = e => (e.role === 'textbox' && /e-?mail/i.test(e.name || '')) ? 'email' : (/password/i.test(e.name || '') ? 'password' : null);
    const tierRank = t => ({ testid: 5, 'stable-id': 4, 'id-fragment': 3, 'form-name': 2, 'role+name': 1, none: 0 }[t] || 0);

    const matches = [];
    TESTS.forEach(t => t.steps.forEach(intent => {
      const m = ground(intent);
      matches.push({ test: t.id, intent, grounded: !!m, oracle: m && m.oracle, matchedName: m && m.name, tier: m && m.tier, predicted: m && m.predicted });
    }));

    // ---- dev take (honest self-critique of 1/2/3) ----
    const nNameless = elements.filter(e => !e.name).length;
    const nWeak = elements.filter(e => e.tier === 'role+name' || e.tier === 'none').length;
    const nTestid = elements.filter(e => e.testid).length;
    const ungrounded = matches.filter(m => !m.grounded);
    const devTake = [
      `${elements.length} interactive elements found; ${nTestid} have a test-id (${pct(nTestid, elements.length)}), ${nWeak} have only a weak/no anchor (${pct(nWeak, elements.length)}) — anchor coverage is the heal-rate ceiling.`,
      `${nNameless} elements are nameless (icon-only) → not locatable by name; would need a caption/testid (HITL) or vision.`,
      `Test-gen is grounded by NAME/TYPE keyword heuristics — brittle: a relabel ("Continue"→"Proceed") or i18n breaks grounding; an LLM author would be more robust but needs a quality gate.`,
      ungrounded.length ? `${ungrounded.length} authored step(s) have NO element on this screen: ${ungrounded.map(u => u.test + ':' + u.intent).join(', ')} — likely a MULTI-SCREEN flow (e.g. email-first, password on step 2) or a different label. Authoring assumed a single-screen form.` : `All authored steps grounded.`,
      `Executor is drift-SIMULATED (no live click/verify) — pass/heal here = locator resilience, NOT a real end-to-end pass. Live execution is S7.`
    ];

    // ---- EXECUTE: re-locate each grounded step under restyle + localize drift ----
    const restyleDoc = new DOMParser().parseFromString(baseDoc.documentElement.outerHTML, 'text/html'); restyle(restyleDoc);
    const localizeDoc = new DOMParser().parseFromString(baseDoc.documentElement.outerHTML, 'text/html'); localize(localizeDoc);
    const opts = { gate: false, scopeVisible: false };
    const results = []; let healEligible = 0, healed = 0;

    TESTS.forEach(t => {
      // a test is only as runnable as its weakest grounded step; report per (test, drift)
      const stepEls = t.steps.map(intent => ({ intent, m: ground(intent) }));
      const ungroundedStep = stepEls.find(s => !s.m);
      if (ungroundedStep) {
        results.push(row(t, '—', 'FAILED', 'AUTHORING', `no element for intent "${ungroundedStep.intent}" on this screen (multi-screen or relabeled)`, 'Re-author: split into the real multi-screen flow, or fix the intent label', false, null));
        return;
      }
      ['restyle', 'localize'].forEach(drift => {
        const doc = drift === 'restyle' ? restyleDoc : localizeDoc;
        let worst = null;
        for (const s of stepEls) {
          const r = S.matchStep(doc, s.m.step, opts);
          const correct = r.verdict === 'heal' && r.best && r.best.el.getAttribute('data-oracle') === s.m.oracle;
          if (r.verdict === 'heal') { healEligible++; if (correct) healed++; }
          if (r.verdict !== 'heal' || !correct) { worst = { s, r, correct }; break; }
        }
        if (!worst) { results.push(row(t, drift, 'PASS_HEALED', 'ELEMENT', 'all steps re-located under drift', 'none — self-healed', true, 'descriptor')); return; }
        const { s, r, correct } = worst;
        if (r.verdict === 'heal' && !correct) { healEligible++; results.push(row(t, drift, 'FAILED', 'ELEMENT', `FALSE-HEAL on "${s.intent}" → wrong element`, 'block: tighten anchor', false, null, true)); return; }
        const d = DG.diagnoseFailure(r);
        const bucket = d.category === 'AMBIGUITY' ? 'ELEMENT' : (d.category === 'STATE_ISSUE' ? 'OTHER' : 'ELEMENT');
        const presc = d.category === 'AMBIGUITY' ? 'add container/row hint (Clue-2) or a test-id' : 'add a stable test-id, or caption if nameless';
        results.push(row(t, drift, 'ABSTAIN', bucket, `step "${s.intent}" (${d.category}): ${d.reason}`, presc, false, null));
      });
    });

    const passed = results.filter(r => r.status.startsWith('PASS')).length;
    const failed = results.filter(r => r.status === 'FAILED').length;
    const abstain = results.filter(r => r.status === 'ABSTAIN').length;
    const split = { AUTHORING: 0, ELEMENT: 0, OTHER: 0 };
    results.filter(r => r.status !== 'PASS_HEALED').forEach(r => { split[r.bucket] = (split[r.bucket] || 0) + 1; });
    const falseHeal = results.filter(r => r.falseHeal).length;

    return {
      screen: 'captured app DOM', bytes: html.length,
      preExec: { authoredTests: TESTS.map(t => ({ id: t.id, name: t.name, steps: t.steps })),
                 elementsIdentified: elements.map(({ step, ...e }) => e), elementCount: elements.length,
                 matches, devTake },
      execute: { results, summary: { passed, failed, abstain, falseHeal,
                 selfHealPct: healEligible ? Math.round(100 * healed / healEligible) : 0, healed, healEligible,
                 rootCauseSplit: split } }
    };
  }
  function row(t, drift, status, bucket, reason, prescription, healed, via, falseHeal) {
    return { test: t.id, name: t.name, drift, status, bucket, reason, prescription, healed: !!healed, via: via || null, falseHeal: !!falseHeal };
  }
  function pct(a, b) { return b ? Math.round(100 * a / b) + '%' : '0%'; }

  root.__AMP = { run };
})(typeof window !== 'undefined' ? window : globalThis);
