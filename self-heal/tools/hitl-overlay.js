/* self-heal/tools/hitl-overlay.js — in-browser Human-In-The-Loop overlay for the self-heal loop.
 *
 * PURPOSE (Ledger K35 / plan §14.4): render the EXACT signals the pipeline already emits as a
 * live, fixed-position card the human can answer. This is the rendering of the I2 contract:
 *   "heal confidently OR hand a named, actionable card — never a silent stop, never a silent guess."
 *
 * It builds NOTHING new in the matcher. It only surfaces:
 *   - record-time  : the `flag` captureStep already emits (no-anchor / ambiguous / weak-identity)
 *   - execute-time : diagnoseFailure().category + failure-reporter.report() + the ranked candidate list
 *
 * DESIGN (POC → productization path):
 *   - No browser extension. Injected via Chrome MCP (or paste / bookmarklet). Self-contained — no
 *     external CSS/JS, no localhost dependency (works on a cross-origin app page OR the harness page).
 *   - Productization path (parent P2/P3): bookmarklet → content-script extension. Same card markup.
 *
 * LOOP MECHANISM (the contract the runner relies on):
 *   window.__hitl = {
 *     decision: null,                 // set by a button onclick → {action, value, cardId, ts}
 *     log: [],                        // every decision, in order — recorded as GROUND TRUTH (feeds P2 learning)
 *     pending: false,                 // a card is currently awaiting a human answer
 *     show(card) -> Promise<decision> // render a card, resolve when the human clicks a button
 *     close(), enabled
 *   }
 *   A runner does:  const d = await window.__hitl.show({...});  then routes on d.action.
 *
 * Card schema (what the runner passes to show()):
 *   { kind:'record'|'execute', cardId, title,
 *     descriptor, rowText, suggestedAnchor, locTier, flag,           // record-time fields
 *     category, headline, reason, candidates:[{n,label,row,conf}],   // execute-time fields
 *     buttons:[{action, label, value?}] }                            // overrides default buttons if given
 */
(function (root) {
  if (root.__hitl && root.__hitl.__installed) return root.__hitl;   // idempotent re-inject

  // ---------- default buttons per card kind (plan §14.4) ----------
  const RECORD_BTNS = [
    { action: 'confirm-row',     label: 'Confirm row identifies it' },
    { action: 'strengthen',      label: 'Strengthen anchor (note testid)', needsNote: true, noteHint: 'data-testid to add' },
    { action: 'pick-viewport',   label: 'Pick viewport' },
    { action: 'caption-icon',    label: 'Caption icon', needsNote: true, noteHint: 'accessible name (Clue-3)' },
    { action: 'skip',            label: 'Skip' }
  ];
  const EXECUTE_BTNS = [
    { action: 'confirm-heal',    label: 'Confirm heal' },
    { action: 'pick-candidate',  label: 'Pick candidate N', needsNum: true },
    { action: 'skip',            label: 'Adjudicate-skip' }
  ];

  // ---------- styling (inline; high z-index so it sits over any app) ----------
  const css = `
   #__hitl_panel{position:fixed;top:16px;right:16px;width:380px;max-height:88vh;overflow:auto;z-index:2147483647;
     background:#fff;color:#111;border:1px solid #d0d0d0;border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,.28);
     font:13px/1.5 ui-sans-serif,-apple-system,Segoe UI,Roboto,sans-serif}
   #__hitl_panel *{box-sizing:border-box}
   .__hitl_hdr{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #eee;background:#fafafa;border-radius:10px 10px 0 0}
   .__hitl_badge{font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;color:#fff}
   .__hitl_badge.rec{background:#b06000}.__hitl_badge.exe{background:#1a73e8}
   .__hitl_title{font-weight:600;flex:1}
   .__hitl_x{cursor:pointer;color:#888;font-size:16px;padding:0 4px}
   .__hitl_body{padding:12px}
   .__hitl_row{margin:6px 0}
   .__hitl_k{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#888}
   .__hitl_v{font-family:ui-monospace,Menlo,monospace;font-size:12px;background:#f6f6f6;border-radius:5px;padding:4px 6px;white-space:pre-wrap;word-break:break-word}
   .__hitl_cat{display:inline-block;font-weight:700;padding:2px 8px;border-radius:5px;background:#fdecea;color:#c5221f}
   .__hitl_cat.DRIFT{background:#e6f4ea;color:#137333}
   .__hitl_cand{border:1px solid #eee;border-radius:6px;padding:6px 8px;margin:4px 0;cursor:pointer;display:flex;gap:8px;align-items:center}
   .__hitl_cand:hover{background:#f0f6ff;border-color:#1a73e8}
   .__hitl_cand .n{font-weight:700;color:#1a73e8;min-width:18px}
   .__hitl_btns{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
   .__hitl_btn{cursor:pointer;border:1px solid #ccc;background:#fff;border-radius:6px;padding:6px 10px;font-size:12px}
   .__hitl_btn:hover{background:#f0f0f0}
   .__hitl_btn.prim{background:#137333;color:#fff;border-color:#137333}
   .__hitl_btn.prim:hover{background:#0f5c28}
   .__hitl_note{width:100%;margin-top:6px;padding:5px 7px;border:1px solid #ccc;border-radius:5px;font-size:12px;display:none}
   .__hitl_foot{font-size:11px;color:#999;padding:6px 12px;border-top:1px solid #eee}`;

  function ensurePanel() {
    let p = document.getElementById('__hitl_panel');
    if (p) return p;
    const style = document.createElement('style'); style.id = '__hitl_style'; style.textContent = css;
    document.documentElement.appendChild(style);
    p = document.createElement('div'); p.id = '__hitl_panel';
    document.documentElement.appendChild(p);
    return p;
  }

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function render(card) {
    const p = ensurePanel();
    const isRec = card.kind === 'record';
    const btns = card.buttons || (isRec ? RECORD_BTNS : EXECUTE_BTNS);
    let h = '';
    h += '<div class="__hitl_hdr"><span class="__hitl_badge ' + (isRec ? 'rec' : 'exe') + '">' + (isRec ? 'RECORD' : 'EXECUTE') + '</span>' +
         '<span class="__hitl_title">' + esc(card.title || (isRec ? 'Fragile control recorded' : 'Heal needs a decision')) + '</span>' +
         '<span class="__hitl_x" id="__hitl_close">&times;</span></div>';
    h += '<div class="__hitl_body">';
    if (isRec) {
      if (card.flag)      h += row('flag', card.flag);
      if (card.locTier)   h += row('locator tier', card.locTier);
      if (card.descriptor) h += row('descriptor', typeof card.descriptor === 'string' ? card.descriptor : JSON.stringify(card.descriptor));
      if (card.rowText != null)        h += row('container row-text', card.rowText || '(none)');
      if (card.suggestedAnchor) h += row('suggested anchor', card.suggestedAnchor);
    } else {
      // WHERE is this control? — name it so the human can find it on the real app (I2 contract)
      if (card.where)      h += row('control', card.where);
      if (card.stratum)    h += row('regime', card.stratum + (card.locTier ? ' · ' + card.locTier : ''));
      if (card.descriptor) h += row('descriptor', typeof card.descriptor === 'string' ? card.descriptor : JSON.stringify(card.descriptor));
      if (card.rowText != null) h += row('container row-text', card.rowText || '(none)');
      if (card.recordedAt) h += row('recorded position', card.recordedAt);
      if (card.suggestedAnchor) h += row('anchor', card.suggestedAnchor);
      if (card.category) h += '<div class="__hitl_row"><span class="__hitl_k">diagnosis</span><br><span class="__hitl_cat ' + esc(card.category) + '">' + esc(card.category) + '</span></div>';
      if (card.headline) h += row('report', card.headline);
      if (card.reason)   h += row('reason', card.reason);
      if (card.candidates && card.candidates.length) {
        h += '<div class="__hitl_row"><span class="__hitl_k">candidates</span></div>';
        card.candidates.forEach(c => {
          h += '<div class="__hitl_cand" data-pick="' + esc(c.n) + '"><span class="n">' + esc(c.n) + '</span>' +
               '<span>' + esc(c.label || '') + (c.conf != null ? ' <small>(conf ' + esc(c.conf) + ')</small>' : '') +
               (c.row ? '<br><small style="color:#888">' + esc(String(c.row).slice(0, 60)) + '</small>' : '') + '</span></div>';
        });
      }
    }
    // buttons
    h += '<input class="__hitl_note" id="__hitl_note" placeholder="">';
    h += '<div class="__hitl_btns">';
    btns.forEach((b, i) => {
      h += '<button class="__hitl_btn ' + (i === 0 ? 'prim' : '') + '" data-act="' + esc(b.action) +
           '" data-note="' + (b.needsNote ? 1 : 0) + '" data-num="' + (b.needsNum ? 1 : 0) + '" data-hint="' + esc(b.noteHint || '') + '">' +
           esc(b.label) + '</button>';
    });
    h += '</div></div>';
    h += '<div class="__hitl_foot">decision → window.__hitl.decision · recorded as ground truth (' + (root.__hitl.log.length) + ' so far)</div>';
    p.innerHTML = h;
    return p;
  }
  const row = (k, v) => '<div class="__hitl_row"><span class="__hitl_k">' + esc(k) + '</span><div class="__hitl_v">' + esc(v) + '</div></div>';

  // ---------- the await-able show() ----------
  function show(card) {
    card.cardId = card.cardId || ('card-' + (root.__hitl.log.length + 1));
    const p = render(card);
    root.__hitl.pending = true;
    root.__hitl.decision = null;
    return new Promise(resolve => {
      const finish = (action, value) => {
        const decision = { cardId: card.cardId, kind: card.kind, action, value: value == null ? null : value, ts: Date.now() };
        root.__hitl.decision = decision;
        root.__hitl.log.push({ card: { kind: card.kind, cardId: card.cardId, title: card.title, flag: card.flag, category: card.category }, decision });
        root.__hitl.pending = false;
        resolve(decision);
      };
      // candidate row click = pick-candidate N
      p.querySelectorAll('.__hitl_cand').forEach(el => el.addEventListener('click', () => finish('pick-candidate', +el.getAttribute('data-pick'))));
      const note = p.querySelector('#__hitl_note');
      p.querySelectorAll('.__hitl_btn').forEach(btn => btn.addEventListener('click', () => {
        const act = btn.getAttribute('data-act');
        const needsNote = btn.getAttribute('data-note') === '1';
        const needsNum = btn.getAttribute('data-num') === '1';
        if ((needsNote || needsNum) && note.style.display !== 'block') {        // first click reveals input
          note.style.display = 'block'; note.placeholder = btn.getAttribute('data-hint') || (needsNum ? 'candidate number' : 'note'); note.focus();
          note.dataset.act = act; note.dataset.kind = needsNum ? 'num' : 'note'; return;
        }
        let value = null;
        if (needsNote) value = note.value || null;
        if (needsNum)  value = note.value ? +note.value : null;
        finish(act, value);
      }));
      note && note.addEventListener('keydown', e => { if (e.key === 'Enter') {
        const act = note.dataset.act; finish(act, note.dataset.kind === 'num' ? +note.value : (note.value || null)); } });
      p.querySelector('#__hitl_close').addEventListener('click', () => finish('skip', null));
    });
  }

  function close() { const p = document.getElementById('__hitl_panel'); if (p) p.remove(); clearHighlight(); root.__hitl.pending = false; }

  // ---------- highlight the REAL element on the live app so the human sees WHICH control ----------
  // Solves the "which click needs input?" problem: when the overlay runs in the live app tab, draw a
  // box over the target element + scroll it into view. No-op safely on the (layout-less) harness doc.
  function clearHighlight() { const b = document.getElementById('__hitl_hi'); if (b) b.remove(); const l = document.getElementById('__hitl_hi_lbl'); if (l) l.remove(); }
  function highlight(el, label) {
    clearHighlight();
    if (!el || !el.getBoundingClientRect) return false;
    try { el.scrollIntoView({ block: 'center', inline: 'center' }); } catch (e) {}
    const r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) return false;
    const box = document.createElement('div'); box.id = '__hitl_hi';
    box.style.cssText = 'position:fixed;z-index:2147483646;pointer-events:none;border:3px solid #1a73e8;border-radius:4px;' +
      'box-shadow:0 0 0 3px rgba(26,115,232,.25),0 0 0 9999px rgba(0,0,0,.18);' +
      'left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px;transition:all .15s';
    document.documentElement.appendChild(box);
    if (label) { const lbl = document.createElement('div'); lbl.id = '__hitl_hi_lbl';
      lbl.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;background:#1a73e8;color:#fff;font:12px/1.4 ui-sans-serif,sans-serif;padding:2px 7px;border-radius:4px;' +
        'left:' + r.left + 'px;top:' + Math.max(0, r.top - 22) + 'px';
      lbl.textContent = label; document.documentElement.appendChild(lbl); }
    return true;
  }

  root.__hitl = {
    __installed: true, enabled: true, decision: null, pending: false, log: [],
    show, close, render, highlight, clearHighlight,
    RECORD_BTNS, EXECUTE_BTNS
  };
  return root.__hitl;
})(typeof window !== 'undefined' ? window : globalThis);
