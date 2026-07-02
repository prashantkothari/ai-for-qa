/* self-heal/pretotype/generic-report.js — SCREEN-AGNOSTIC report on ANY captured app DOM (window.name).
 *
 * Unlike amplitude-report.js (login-specific intents), this AUTO-GENERATES a smoke test per real control
 * (Momentic-`explore` style), then measures: anchor quality, predicted robustness, and drift-resilience
 * (restyle + localize) with false-heal as the gate. REAL: selfheal-core + pipeline. Executor = drift-
 * simulated (no live click — S7); gate off (layout-less DOMParser doc). Use on Testsigma / Amplitude / any app.
 */
(function (root) {
  const S = root.SELFHEAL, DG = root.SELFHEAL_DIAGNOSIS;
  const CG = root.SELFHEAL_CANDGEN;
  const norm = s => (s || '').replace(/\s+/g, ' ').trim();
  const CAP = 30; // cap auto-generated tests for readability (report what was dropped)

  function hash(s){ let h=0; for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0; return 'x'+h.toString(16)+'z'; }
  function restyle(doc){ doc.querySelectorAll('*').forEach(el=>{ if(el.getAttribute('class')) el.setAttribute('class',hash(el.getAttribute('class'))); if(el.id) el.id=hash(el.id); }); }
  function localize(doc){ const rev=s=>(s||'').split('').reverse().join('');
    const w=doc.createTreeWalker(doc.body||doc.documentElement, NodeFilter.SHOW_TEXT, null); const t=[]; let n; while((n=w.nextNode())) t.push(n);
    t.forEach(x=>{ if(x.nodeValue.trim()) x.nodeValue=rev(x.nodeValue); });
    (doc.querySelectorAll('[aria-label],[placeholder]')||[]).forEach(el=>{ if(el.getAttribute('aria-label')) el.setAttribute('aria-label',rev(el.getAttribute('aria-label'))); if(el.getAttribute('placeholder')) el.setAttribute('placeholder',rev(el.getAttribute('placeholder'))); }); }
  const tierRank = t => ({ testid:5,'stable-id':4,'id-fragment':3,'form-name':2,'role+name':1,none:0 }[t]||0);

  function run(html) {
    const baseDoc = new DOMParser().parseFromString(html, 'text/html');
    const cands = S.WEB.candidates(baseDoc);
    cands.forEach((el, i) => el.setAttribute('data-oracle', 'o' + i));
    const elements = cands.map((el, i) => {
      const exx = S.WEB.extract(el, baseDoc); const loc = S.bestLocator(exx);
      const step = S.captureStep(el, baseDoc, { stepId: 'o' + i });
      try { step.context = CG.captureContext(el); } catch (e) {}
      return { oracle:'o'+i, role:exx.role, name:norm(exx.name)||null, tag:exx.tag, testid:exx.testid||null,
               tier:loc.tier, flag:step.flag, predicted:step.target.confidence, step };
    });

    // ---- AUTO-GENERATE tests: one smoke test per IDENTIFIABLE control (named or test-id'd) ----
    const named = elements.filter(e => e.name || e.testid);
    const nameless = elements.filter(e => !e.name && !e.testid);
    named.sort((a, b) => tierRank(b.tier) - tierRank(a.tier));   // strongest anchors first
    const chosen = named.slice(0, CAP);
    const droppedNamed = Math.max(0, named.length - CAP);
    const tests = chosen.map((e, i) => ({ id: 'A' + (i + 1), name: 'Interact: ' + (e.name || ('[' + e.testid + ']')),
                                          oracle: e.oracle, role: e.role, tier: e.tier, predicted: e.predicted }));

    const nTestid = elements.filter(e => e.testid).length;
    const nWeak = elements.filter(e => e.tier === 'role+name' || e.tier === 'none').length;
    const devTake = [
      `${elements.length} interactive controls found → ${named.length} are identifiable (named/test-id), ${nameless.length} are nameless (icon-only).`,
      `Anchor quality: ${nTestid} test-id (${pct(nTestid, elements.length)}), ${nWeak} weak/no-anchor (${pct(nWeak, elements.length)}). Anchor coverage is the heal-rate ceiling.`,
      `Auto-gen is SMOKE-level (one interaction per control) — it does NOT know business intent (which control matters, what should follow). An LLM author adds intent but needs a quality gate (false-test guard).`,
      nameless.length ? `${nameless.length} nameless controls are not name-locatable → caption/test-id (HITL) or vision; excluded from auto-tests.` : `No nameless controls.`,
      droppedNamed ? `Capped at ${CAP} tests; ${droppedNamed} more identifiable controls NOT covered this run (no silent truncation).` : `All identifiable controls covered.`,
      `Executor is drift-SIMULATED (no live click/verify) — pass/heal = locator resilience, NOT a real end-to-end pass (live = S7).`
    ];

    // ---- EXECUTE: drift each control's locator (restyle + localize), re-locate, gate on false-heal ----
    const restyleDoc = new DOMParser().parseFromString(baseDoc.documentElement.outerHTML, 'text/html'); restyle(restyleDoc);
    const localizeDoc = new DOMParser().parseFromString(baseDoc.documentElement.outerHTML, 'text/html'); localize(localizeDoc);
    const opts = { gate: false, scopeVisible: false };
    const results = []; let healEligible = 0, healed = 0;
    const split = { authoring: 0, element: 0, other: 0 };

    chosen.forEach((e, i) => {
      ['restyle', 'localize'].forEach(drift => {
        const doc = drift === 'restyle' ? restyleDoc : localizeDoc;
        let r = S.matchStep(doc, e.step, opts);
        if (r.verdict !== 'heal' && e.step.context) { try { const r2 = CG.disambiguateByContext(doc, e.step, opts); if (r2 && r2.verdict === 'heal') r = r2; } catch (x) {} }
        const correct = r.verdict === 'heal' && r.best && r.best.el.getAttribute('data-oracle') === e.oracle;
        if (r.verdict === 'heal') {
          healEligible++;
          if (correct) { healed++; results.push(rrow('A'+(i+1), e.name, drift, 'PASS_HEALED', 'element', 'self-healed'+(r.via?(' via '+r.via):' via descriptor'), 'none — self-healed', true)); }
          else { split.element++; results.push(rrow('A'+(i+1), e.name, drift, 'FALSE_HEAL', 'element', 'healed to WRONG element', 'BLOCK: tighten anchor', false, true)); }
        } else {
          const d = DG.diagnoseFailure(r);
          split.element++;
          const presc = d.category === 'AMBIGUITY' ? 'add container/row hint (Clue-2) or a test-id' : 'add a stable test-id / caption (HITL)';
          results.push(rrow('A'+(i+1), e.name, drift, 'ABSTAIN', 'element', d.category + ': ' + d.reason, presc, false));
        }
      });
    });

    const passed = results.filter(r => r.status === 'PASS_HEALED').length;
    const abstain = results.filter(r => r.status === 'ABSTAIN').length;
    const falseHeal = results.filter(r => r.falseHeal).length;
    return {
      bytes: html.length, elementCount: elements.length,
      preExec: { autoTests: tests, testCount: tests.length, elementsIdentified: elements.map(({step, ...e}) => e), devTake,
                 coverage: { identifiable: named.length, nameless: nameless.length, capped: droppedNamed } },
      execute: { results, summary: { tests: tests.length, driftRuns: results.length, passed, abstain, falseHeal,
                 selfHealPct: healEligible ? Math.round(100 * healed / healEligible) : 0, healed, healEligible, rootCauseSplit: split } }
    };
  }
  function rrow(test, name, drift, status, bucket, reason, prescription, healed, falseHeal) {
    return { test, name, drift, status, bucket, reason, prescription, healed: !!healed, falseHeal: !!falseHeal };
  }
  function pct(a, b) { return b ? Math.round(100 * a / b) + '%' : '0%'; }
  root.__GEN = { run };
})(typeof window !== 'undefined' ? window : globalThis);
