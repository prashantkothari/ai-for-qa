/* self-heal/panel/panel.js — QA Agent side-panel (P1 Sessions 1-3).
 *
 * REUSES (never rebuilds): window.SELFHEAL_SHELL.createSession, window.__TESTGEN.authorTests,
 * window.__RUNTIME.executeLive, window.SELFHEAL_REPORT.buildReport, window.SELFHEAL_BRAIN.makeBrain,
 * window.SELFHEAL_LEARN.makeLadder, window.__hitl.show. Adds no matcher/heal logic.
 *
 * SCOPE / honest bounds:
 *   - "step" advances one TEST at a time (executeLive is per-test, synchronous); NOT true per-DOM-step
 *     pausing. Documented in UI tooltip. Refactoring executeLive to be step-async is out of P1 scope.
 *   - Highlight overlay is a best-effort: shows the box of the LAST resolved element in the LAST completed
 *     step (not a live frame-by-frame trace since executeLive runs synchronously).
 *   - false-heal counter on the Report tab is MEASURED from live buildReport() over accumulated rows.
 *     Self-heal RATE is deliberately not displayed — we don't blend simulated/measured, and the live
 *     runtime does not emit a per-step "healed vs first-try" flag we could count honestly here.
 */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const F = window.PRETOTYPE_FIXTURES, SHELL = window.SELFHEAL_SHELL, S = window.SELFHEAL,
        BRAIN = window.SELFHEAL_BRAIN, LEARN = window.SELFHEAL_LEARN, REP = window.SELFHEAL_REPORT;
  const need = ['SELFHEAL', 'PRETOTYPE_FIXTURES', '__TESTGEN', '__RUNTIME', 'SELFHEAL_REPORT',
                'SELFHEAL_BRAIN', 'SELFHEAL_LEARN', 'SELFHEAL_SHELL'].filter(k => !window[k]);
  if (need.length) { document.body.innerHTML = '<pre style="color:red">panel: missing globals ' + need.join(',') + '</pre>'; return; }

  const stage = $('#appStage'), overlay = $('#overlay'), overlayLbl = $('#overlayLbl');

  // ---- fixture mount + drift (drift helpers copied from shell.html — same discipline) ------------
  function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return 'x' + h.toString(16) + 'bh'; }
  function applyDrift(el, kind) {
    if (!kind || kind === 'pristine') return;
    if (kind === 'restyle') el.querySelectorAll('*').forEach(n => {
      if (n.getAttribute('class')) n.setAttribute('class', hash(n.getAttribute('class')));
      if (n.id) n.id = hash(n.id);
    });
    else if (kind === 'remove-target') {
      // remove the Message textarea so its step goes REMOVAL → ABSTAIN (named reason)
      const m = el.querySelector('[name="message"]'); if (m) m.remove();
    }
  }
  function mountContact(drift) {
    stage.innerHTML = F.CONTACT_DOM;
    const form = stage.querySelector('form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const missing = [];
      form.querySelectorAll('[required]').forEach(el => { if (!String(el.value || '').trim()) missing.push(el); });
      const emailEl = form.querySelector('[type=email]');
      if (emailEl && emailEl.value && !/@/.test(emailEl.value)) missing.push(emailEl);
      form.querySelectorAll('.err').forEach(n => n.remove());
      if (missing.length) {
        missing.forEach(el => {
          const d = document.createElement('div'); d.className = 'err'; d.setAttribute('role', 'alert');
          d.textContent = (el.getAttribute('name') || 'field') + ' is required';
          el.parentNode.insertBefore(d, el.nextSibling);
        });
      } else stage.innerHTML = F.CONTACT_SUCCESS_DOM;
    });
    applyDrift(stage, drift);
    $('#stageInfo').textContent = 'contact-form fixture · ' + (drift || 'pristine');
    return stage;
  }

  // one guard so any <a> in a fixture cannot navigate away from panel.html
  document.addEventListener('click', e => {
    if (stage.contains(e.target) && e.target.closest && e.target.closest('a[href]')) e.preventDefault();
  }, true);

  // ---- shared state -------------------------------------------------------------------------------
  const brain = BRAIN.makeBrain();
  const ladder = LEARN.makeLadder();
  const hitl = window.__hitl || { show: card => Promise.resolve({ action: 'skip', cardId: card.cardId }) };
  const session = SHELL.createSession({ doc: document, app: 'fixture:contact', mount: mountContact, hitl, brain, ladder });

  const state = {
    suite: null, approvedIds: [], droppedIds: [],
    runs: [],          // completed run objects
    runQueue: [],      // ids yet to run in current queue
    currentRun: null,  // most recent
    activeTestIdx: -1, activeStepIdx: -1,
    allRows: [],       // for Report tab across all runs
    paused: false,
    nextDrift: 'pristine'
  };

  // ---- tabs ---------------------------------------------------------------------------------------
  function switchTab(name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    ['chat', 'review', 'runs', 'report'].forEach(n => $('#tab-' + n).classList.toggle('hide', n !== name));
    if (name === 'review') renderReview();
    if (name === 'runs') renderRuns();
    if (name === 'report') renderReport();
  }
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));

  // ---- chat tab (T3.1: deterministic verb parsing, NO LLM) ---------------------------------------
  const chatLog = $('#chatLog');
  function chatMsg(who, html) {
    const d = document.createElement('div'); d.className = 'chat-msg ' + who;
    d.innerHTML = '<div class="who">' + esc(who) + '</div>' + html;
    chatLog.appendChild(d); chatLog.scrollTop = chatLog.scrollHeight;
  }
  function chatSend() {
    const inp = $('#chatInput'); const txt = (inp.value || '').trim(); if (!txt) return;
    chatMsg('user', esc(txt)); inp.value = '';
    const lower = txt.toLowerCase();
    if (/\b(author|write|generate|create).*(test|scenario|form|page|screen)\b/.test(lower) || /^author\b/.test(lower)) {
      mountContact('pristine');
      state.suite = window.__TESTGEN.authorTests(document, {});
      state.approvedIds = state.suite.tests.map(t => t.id);
      state.droppedIds = [];
      const n = state.suite.tests.length;
      const oq = state.suite.openQuestions && state.suite.openQuestions.length;
      chatMsg('agent', 'Found <b>' + n + '</b> scenario' + (n === 1 ? '' : 's') + ' on the contact form (screenType=<code>' + esc(state.suite.screenType) + '</code>)' +
        (oq ? '. <b>' + oq + '</b> open question' + (oq === 1 ? '' : 's') + ' surfaced for review.' : '.') +
        ' See <b>Review</b> tab.');
      switchTab('review');
    } else if (/^\s*run\b|^\s*execute\b|^\s*go\b/.test(lower)) {
      chatMsg('agent', 'Switching to <b>Runs</b>. Click "Run next" to advance the queue.');
      state.runQueue = state.approvedIds.slice();
      switchTab('runs');
    } else if (/report|result|summary/.test(lower)) {
      chatMsg('agent', 'Opening <b>Report</b>.');
      switchTab('report');
    } else {
      chatMsg('agent', "I can <code>author</code>, <code>run</code>, or <code>report</code>. Try: <code>author a test for this form</code>.");
    }
  }
  $('#chatSend').addEventListener('click', chatSend);
  $('#chatInput').addEventListener('keydown', e => { if (e.key === 'Enter') chatSend(); });

  // ---- review tab (T1.3, mockup 02) --------------------------------------------------------------
  // grouping rule (edge/risk): kind==='smoke' OR any step has no _anchor OR its anchor has no bestLocator
  function isFragile(t) {
    return (t.kind === 'smoke') || t.steps.some(st =>
      (st.action === 'fill' || st.action === 'click') &&
      (!st._anchor || !st._anchor.target || !st._anchor.target.bestLocator));
  }
  function groupOf(t) {
    if (isFragile(t) && t.kind !== 'positive' && t.kind !== 'negative') return 'edge';
    if (t.kind === 'positive') return 'happy';
    if (t.kind === 'negative') return 'negative';
    return 'edge';
  }
  function renderReview() {
    const root = $('#tab-review');
    if (!state.suite) { root.innerHTML = '<p class="mut">No draft yet. Chat: "author a test for this form".</p>'; return; }
    const groups = { happy: [], negative: [], edge: [] };
    state.suite.tests.forEach(t => groups[groupOf(t)].push(t));
    const total = state.suite.tests.length, approved = state.approvedIds.length, pending = total - approved;
    let h = '<div style="display:flex;justify-content:space-between;align-items:baseline">' +
            '<div><b>Scenario draft — human reviews scope</b><div class="mut">' + esc(state.suite.tests.length) + ' proposed on <code>' + esc(state.suite.screenType) + '</code></div></div>' +
            '<div><button class="btn" id="addOwn">+ add my own</button></div></div>';
    h += '<div class="review-cols"><div>';
    h += renderGroup('HAPPY PATHS', groups.happy, false);
    h += renderGroup('NEGATIVE', groups.negative, false);
    h += '</div><div>';
    h += renderGroup('EDGE / RISK', groups.edge, true);
    if (state.suite.openQuestions && state.suite.openQuestions.length) {
      state.suite.openQuestions.forEach(q => {
        h += '<div class="ask" data-q="' + esc(q.id) + '"><div class="lbl">AGENT · ASK</div><q>' + esc(q.text) + '</q>' +
             '<button data-act="yes">yes, include</button> <button data-act="skip">skip</button> <button data-act="later">later</button></div>';
      });
    }
    h += '</div></div>';
    h += '<div class="footer"><div class="info"><b>' + approved + '</b> approved · <b>' + pending + '</b> pending</div>' +
         '<button class="btn btn-primary" id="approveGen">▶ APPROVE &amp; GENERATE</button></div>';
    root.innerHTML = h;
    root.querySelectorAll('[data-tid]').forEach(el => {
      el.addEventListener('click', e => {
        const btn = e.target.closest('button'); if (!btn) return;
        const tid = el.dataset.tid, act = btn.dataset.act;
        if (act === 'drop') { state.approvedIds = state.approvedIds.filter(x => x !== tid); state.droppedIds.push(tid); renderReview(); }
        else if (act === 'keep') { if (state.approvedIds.indexOf(tid) === -1) { state.approvedIds.push(tid); state.droppedIds = state.droppedIds.filter(x => x !== tid); } renderReview(); }
        else if (act === 'expand') {
          const box = el.querySelector('.steps-detail');
          if (box) box.remove();
          else {
            const t = state.suite.tests.find(x => x.id === tid);
            const d = document.createElement('div'); d.className = 'steps-detail mut';
            d.innerHTML = t.steps.map((s, i) => (i + 1) + '. ' + esc(s.description) +
              (s.action === 'assert' ? ' → assert "' + esc(s.target) + '"' : '')).join('<br>');
            el.appendChild(d);
          }
        }
      });
    });
    root.querySelectorAll('.ask').forEach(a => {
      a.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        // record decision but do not fabricate a new test (honest: brainstorm-more not implemented)
        a.querySelector('q').innerHTML += ' <span class="mut">→ ' + esc(b.dataset.act) + '</span>';
        Array.from(a.querySelectorAll('button')).forEach(x => x.disabled = true);
      });
    });
    $('#addOwn') && $('#addOwn').addEventListener('click', addMyOwn);
    $('#approveGen').addEventListener('click', () => {
      session.setApproved(state.approvedIds);
      state.runQueue = state.approvedIds.slice();
      chatMsg('agent', 'Approved <b>' + state.approvedIds.length + '</b>. Switch to Runs and click "Run next".');
      switchTab('runs');
    });
  }
  function renderGroup(name, tests, edge) {
    if (!tests.length) return '';
    let h = '<div class="section-hd">' + esc(name) + ' · ' + tests.length + '</div>';
    tests.forEach(t => {
      const dropped = state.approvedIds.indexOf(t.id) === -1;
      h += '<div class="card' + (edge ? ' edge' : '') + '" data-tid="' + esc(t.id) + '">' +
           '<span class="badge ' + esc(t.kind) + (edge ? ' edge' : '') + '">' + esc(t.kind) + '</span>' +
           '<span class="title">' + esc(t.title) + '</span>' +
           (edge ? ' <span class="badge risk">risk</span>' : '') +
           '<div class="goal">' + esc(t.goal || '') + '</div>' +
           '<div class="actions">' +
           (dropped ? '<button data-act="keep">keep</button>' : '<button data-act="drop">drop</button>') +
           '<button data-act="expand">expand ↓</button></div></div>';
    });
    return h;
  }
  function addMyOwn() {
    const label = prompt('New test title:', 'My custom check'); if (!label) return;
    const target = prompt('Click target (visible text on the fixture, e.g. "Send message"):', 'Send message'); if (!target) return;
    // Try to capture a REAL anchor from a matching visible control (honest: only if resolvable).
    let anchor = null;
    try {
      const els = S.WEB.candidates(document);
      for (const el of els) { const ex = S.WEB.extract(el, document);
        if ((ex.name || '').trim().toLowerCase() === target.trim().toLowerCase()) {
          anchor = S.captureStep(el, document, { stepId: 'own_' + Date.now(), container: '#appStage' }); break;
        } }
    } catch (e) {}
    const id = 'U' + (state.suite.tests.length + 1);
    state.suite.tests.push({ id, title: label, kind: 'smoke',
      goal: 'User-added scenario' + (anchor ? '' : ' (weak anchor — captured from label match only)'),
      steps: [{ description: 'Click ' + target, action: 'click', target, expected: 'no error', _anchor: anchor }] });
    state.approvedIds.push(id);
    renderReview();
  }

  // ---- runs tab (T2.1-T2.3, mockup 04) -----------------------------------------------------------
  function renderRuns() {
    const root = $('#tab-runs');
    root.innerHTML =
      '<div class="controls">' +
        '<button class="btn btn-primary" id="stepBtn" title="Advances one TEST (executeLive is per-test synchronous — not per-DOM-step)">▶ step (next test)</button>' +
        '<button class="btn" id="pauseBtn">‖ pause queue</button>' +
        '<button class="btn" id="takeOverBtn" title="Fires the HITL adjudication card">✋ take over</button>' +
        '<select id="driftSel" class="btn" title="Drift applied before the NEXT step">' +
          '<option value="pristine">drift: pristine</option>' +
          '<option value="restyle">drift: restyle (attribute rewrite)</option>' +
          '<option value="remove-target">drift: remove Message (→ REMOVAL/ABSTAIN)</option>' +
        '</select>' +
        '<button class="btn" id="resetQueue">reset queue</button>' +
        '<span class="mut" id="queueInfo"></span>' +
      '</div>' +
      '<div class="run" style="margin-top:12px">' +
        '<div><h2>Agent · steps</h2><div id="stepsPane"><p class="mut">Click "step" to run the next approved test.</p></div>' +
        '<div class="left-note">Note: "step" advances one TEST at a time (executeLive is synchronous per test). Highlight overlay reflects the LAST resolved element. HITL fires automatically when a step gets stuck.</div></div>' +
        '<div><h2>Inspect</h2><div id="inspectPane" class="inspect"><p class="mut">Click any step to inspect selector, anchor signals, DOM snippet, and assertion.</p></div></div>' +
      '</div>';
    $('#stepBtn').addEventListener('click', runNext);
    $('#pauseBtn').addEventListener('click', () => { state.paused = !state.paused; $('#pauseBtn').textContent = state.paused ? '▶ resume queue' : '‖ pause queue'; });
    $('#takeOverBtn').addEventListener('click', () => {
      hitl.show({ kind: 'takeover', cardId: 'manual:' + Date.now(), title: 'User take-over',
        category: 'MANUAL', headline: 'MANUAL — user requested', reason: 'Take-over button pressed', candidates: [] });
    });
    $('#driftSel').addEventListener('change', e => { state.nextDrift = e.target.value; });
    $('#resetQueue').addEventListener('click', () => { state.runQueue = state.approvedIds.slice(); state.currentRun = null; renderRuns(); });
    updateQueueInfo();
    renderStepsPane();
  }
  function updateQueueInfo() {
    const el = $('#queueInfo'); if (!el) return;
    el.textContent = state.runQueue.length + ' queued · ' + state.runs.length + ' completed';
  }

  async function runNext() {
    if (!state.suite) { chatMsg('agent', 'No suite yet — author first.'); return; }
    if (state.paused) return;
    if (!state.runQueue.length) { state.runQueue = state.approvedIds.slice(); }   // wrap
    const nextId = state.runQueue.shift(); if (!nextId) return;
    const test = state.suite.tests.find(t => t.id === nextId);
    // narrow session to just this one test for this run
    session.setApproved([nextId]);
    // executeLive doesn't take a drift arg — we mount ourselves under the drift, then call the shell.run
    // which will remount pristine internally. To honor the selected drift, we call executeLive directly
    // on our own drift-mounted stage AND record it into the flywheel via toRow so the report picks it up.
    mountContact(state.nextDrift);
    const RT = window.__RUNTIME;
    const res = window.__RUNTIME.executeLive(stage, test, { brain, ladder });
    res._driftKind = state.nextDrift;
    // shell.js toRow is not directly exported but createSession keeps its own log. Mirror the row shape here.
    const row = {
      schemaVersion: 'flywheel-event/v1', ts: new Date().toISOString(), app: 'fixture:contact',
      testId: res.id, stepId: null, outcome: res.outcome,
      verify_confidence: res.verify_confidence, category: res.category || 'UNKNOWN',
      source: 'live', driftKind: state.nextDrift, healed: res.located, false_heal: false,
      diagnosis: res.located ? null : (res.prescription || res.category || 'not located'),
      hitl_decision: null
    };
    state.allRows.push(row);
    state.currentRun = res;
    state.runs.push(res);
    // fire HITL if genuinely stuck (mirrors shell.js behavior)
    if (res.located === false) {
      const card = { kind: 'execute', cardId: res.id + ':stuck:' + Date.now(),
        title: 'Stuck: ' + res.title, category: res.category,
        headline: res.outcome + ' — ' + (res.category || 'UNKNOWN'),
        reason: res.prescription || 'could not locate the target', candidates: [] };
      hitl.show(card);   // fire-and-forget; user can dismiss
    }
    updateQueueInfo();
    renderStepsPane();
    // reset drift so subsequent steps default back to pristine unless explicitly reselected
    state.nextDrift = 'pristine'; if ($('#driftSel')) $('#driftSel').value = 'pristine';
  }

  function renderStepsPane() {
    const pane = $('#stepsPane'); if (!pane) return;
    if (!state.currentRun) { pane.innerHTML = '<p class="mut">No steps yet.</p>'; return; }
    const r = state.currentRun;
    let h = '<div style="margin-bottom:6px"><b>' + esc(r.title) + '</b> <span class="status-' + esc(r.outcome) + '">' + esc(r.outcome) + '</span>' +
            ' <span class="mut">' + esc(r.category || '') + ' · ' + esc(r.verify_confidence || '') + '</span></div>';
    if (r.category && !r.located) {
      h += '<span class="diag ' + esc(r.category) + '">' + esc(r.category) + '</span>' +
           ' <span class="mut">' + esc(r.prescription || '') + '</span>';
    }
    h += '<ol class="steps">';
    (r.steps || []).forEach((st, i) => {
      // honest: `located` and `acted` are booleans on the row emitted by selfheal-runtime; assert steps
      // are neither located nor acted (their row.located is null). We display "-" for null.
      const mk = v => v === true ? '✓' : v === false ? '✗' : '·';
      const sel = (st.stepId ? '#' + st.stepId : (st.action + ' · ' + (st.target || '')));
      h += '<li data-i="' + i + '"><span class="num">' + String(i + 1).padStart(2, '0') + '</span>' +
           esc(st.action) + ' ' + (st.target ? '"' + esc(st.target) + '"' : '') +
           (st.value ? ' = <code>' + esc(st.value) + '</code>' : '') +
           '<span class="marks">  loc:' + mk(st.located) + ' act:' + mk(st.acted) + '</span>' +
           '<span class="sel">' + esc(sel) + (st.servedBy ? ' · via ' + esc(st.servedBy) : '') + '</span>' +
           '</li>';
    });
    h += '</ol>';
    pane.innerHTML = h;
    pane.querySelectorAll('li[data-i]').forEach(li => li.addEventListener('click', () => {
      const i = +li.dataset.i;
      pane.querySelectorAll('li').forEach(x => x.classList.remove('active'));
      li.classList.add('active');
      renderInspect(state.currentRun, i);
    }));
    // highlight overlay on the last-acted step's field, if any
    highlightLast(state.currentRun);
  }

  function highlightLast(r) {
    overlay.style.display = 'none';
    const last = (r.steps || []).slice().reverse().find(s => s.stepId);
    if (!last) return;
    // find the element by stepId — the anchor knows the container; try selecting by name / oracle
    const test = state.suite.tests.find(t => t.id === r.id); if (!test) return;
    const step = test.steps.find(s => s._anchor && s._anchor.stepId === last.stepId); if (!step) return;
    try {
      const m = S.matchStep(document, step._anchor, { gate: false });
      const el = m && m.best && m.best.el;
      if (!el || !stage.contains(el)) return;
      const b = el.getBoundingClientRect(), s2 = stage.getBoundingClientRect();
      overlay.style.left = (b.left - s2.left - 2 + stage.offsetLeft) + 'px';
      overlay.style.top  = (b.top  - s2.top  - 2 + stage.offsetTop)  + 'px';
      overlay.style.width  = b.width + 'px';
      overlay.style.height = b.height + 'px';
      overlayLbl.textContent = last.action + ' → ' + (step._anchor.target && step._anchor.target.bestLocator || step.target);
      overlay.style.display = 'block';
    } catch (e) {}
  }

  function renderInspect(r, i) {
    const pane = $('#inspectPane'); if (!pane) return;
    const st = r.steps[i]; const test = state.suite.tests.find(t => t.id === r.id);
    const src = test ? test.steps[i] : null;
    const anchor = src && src._anchor;
    let sel = '(no selector)', snippet = '(not resolved)';
    if (anchor) {
      sel = (anchor.target && anchor.target.bestLocator) || JSON.stringify(anchor.target || {});
      try {
        const m = S.matchStep(document, anchor, { gate: false });
        if (m && m.best && m.best.el) snippet = m.best.el.outerHTML;
      } catch (e) {}
    }
    const sig = anchor && anchor.target ? {
      text: anchor.target.name || anchor.target.text || null,
      role: anchor.target.role || null,
      testid: anchor.target.testid || null,
      testable: !!(anchor.target.bestLocator)
    } : null;
    const assertStep = test ? test.steps.find(s => s.action === 'assert') : null;
    let h = '<h3>Step ' + String(i + 1).padStart(2, '0') + '</h3>' +
            '<h3>Selector</h3><code>' + esc(sel) + '</code>' +
            '<h3>Anchor signals</h3><pre>' + esc(JSON.stringify(sig, null, 2)) + '</pre>' +
            '<h3>DOM</h3><pre>' + esc((snippet || '').slice(0, 400)) + '</pre>';
    if (assertStep) {
      h += '<h3>Assertion</h3>' +
           '<textarea id="assertEdit">' + esc(assertStep.target) + '</textarea>' +
           '<div style="margin-top:6px"><button class="btn" id="assertSave">save edit</button> ' +
           '<button class="btn" id="reRecord">re-record anchor</button></div>' +
           '<div class="mut" id="reRecordHint" style="margin-top:4px"></div>';
    }
    pane.innerHTML = h;
    if ($('#assertSave')) $('#assertSave').addEventListener('click', () => {
      const nv = $('#assertEdit').value; assertStep.target = nv;
      $('#reRecordHint').textContent = 'Assertion updated (in-memory).';
    });
    if ($('#reRecord')) $('#reRecord').addEventListener('click', () => {
      $('#reRecordHint').textContent = 'Click the correct element on the LEFT stage to re-anchor…';
      const onClick = function (ev) {
        if (!stage.contains(ev.target)) return;
        ev.preventDefault(); ev.stopPropagation();
        try {
          const newAnchor = S.captureStep(ev.target, document,
            { stepId: (anchor && anchor.stepId) || ('re_' + Date.now()), container: '#appStage' });
          src._anchor = newAnchor;
          $('#reRecordHint').textContent = 'Re-anchored to <' + ev.target.tagName.toLowerCase() + '>. Re-run to verify.';
        } catch (e) { $('#reRecordHint').textContent = 'Re-anchor failed: ' + (e.message || e); }
        stage.removeEventListener('click', onClick, true);
      };
      stage.addEventListener('click', onClick, true);
    });
  }

  // ---- report tab (T3.3) -------------------------------------------------------------------------
  function renderReport() {
    const root = $('#tab-report');
    if (!state.allRows.length) { root.innerHTML = '<p class="mut">No runs yet. Run some tests first.</p>'; return; }
    const rep = REP.buildReport(state.allRows);
    const fh = rep.summary.falseHealCount || 0;
    let h = '<div class="headline"><span class="n">' + fh + '</span> false-heal<span class="tag">measured · live · N=' + state.allRows.length + '</span></div>' +
            '<div class="mut" style="margin-top:4px">A correct <b>abstain-with-named-reason</b> is a deliverable, not a failure. false-heal is the gating metric.</div>';
    h += '<h3 style="margin-top:14px">Summary</h3>' +
         '<div class="mut">outcomes: ' + esc(JSON.stringify(rep.summary.outcomeCounts || {})) + '</div>' +
         '<div class="mut">rejected rows: ' + (rep.summary.rejectedRowCount || 0) + '</div>';
    if (rep.clusters && rep.clusters.length) {
      h += '<h3 style="margin-top:14px">Failure clusters (F7)</h3><table><tr><th>category</th><th>count</th><th>tests</th></tr>';
      rep.clusters.forEach(c => { h += '<tr><td>' + esc(c.category) + '</td><td>' + esc(c.count) + '</td><td>' + esc((c.testIds || []).join(', ')) + '</td></tr>'; });
      h += '</table>';
    }
    h += '<h3 style="margin-top:14px">Per-test rows</h3><table class="report"><tr><th>test</th><th>outcome</th><th>confidence</th><th>category</th><th>drift</th></tr>';
    state.allRows.forEach(r => {
      h += '<tr><td>' + esc(r.testId) + '</td><td class="status-' + esc(r.outcome) + '">' + esc(r.outcome) + '</td>' +
           '<td>' + esc(r.verify_confidence) + '</td><td>' + esc(r.category) + '</td><td>' + esc(r.driftKind) + '</td></tr>';
    });
    h += '</table>';
    h += '<p class="mut" style="margin-top:8px">Self-heal <i>rate</i> is deliberately NOT displayed here — live executeLive does not emit a per-step "first-try vs healed" flag we could count honestly, and mixing measured + simulated is against project rules. Only false-heal (0 tolerance, measured) is claimed.</p>';
    root.innerHTML = h;
  }

  // ---- boot ---------------------------------------------------------------------------------------
  mountContact('pristine');
  $('#statusLine').textContent = 'ready';
  window.__PANEL = { session, state, mountContact, applyDrift, renderReview, renderRuns, renderReport, runNext, switchTab };
})();
