/* self-heal/panel/drift-torture.js — P2 T5.3: seeded drift regimes for the Safety view's live
 * "N mutations · false-heals: 0" counter. restyle/localize mirror eval-gate.js's own drift helper
 * (same documented transform, re-implemented here since eval-gate.js is a separate, protected
 * benchmark harness this session does not edit); reorder/twin are NEW regimes this view needs that
 * eval-gate.js's corpus never exercised. READ-ONLY consumer of selfheal-core.js's public surface —
 * no core or pipeline file is modified by this module.
 */
(function (root) {
  function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return 'x' + h.toString(16) + 'bh'; }
  const rev = s => (s || '').split('').reverse().join('');

  function restyle(stageEl) {
    stageEl.querySelectorAll('*').forEach(el => {
      if (el.getAttribute('class')) el.setAttribute('class', hash(el.getAttribute('class')));
      if (el.id) el.id = hash(el.id);
    });
  }
  function localize(stageEl) {
    const walker = stageEl.ownerDocument.createTreeWalker(stageEl, NodeFilter.SHOW_TEXT, null);
    const texts = []; let n; while ((n = walker.nextNode())) texts.push(n);
    texts.forEach(t => { if (t.nodeValue.trim()) t.nodeValue = rev(t.nodeValue); });
    stageEl.querySelectorAll('[aria-label],[placeholder]').forEach(el => {
      if (el.getAttribute('aria-label')) el.setAttribute('aria-label', rev(el.getAttribute('aria-label')));
      if (el.getAttribute('placeholder')) el.setAttribute('placeholder', rev(el.getAttribute('placeholder')));
    });
  }
  // shuffle sibling order within every repeating-row container (tbody/ul/ol) — simulates a re-sort.
  // Deterministic given the seeded `rnd()` passed in (Fisher-Yates on the plain array — no DOM
  // interaction during the shuffle itself, so correctness doesn't depend on insertBefore semantics —
  // then a single re-append pass realizes the exact computed permutation: appendChild on a node
  // already in the document MOVES it, so appending in shuffled order reproduces that order in the DOM).
  function reorder(stageEl, rnd) {
    stageEl.querySelectorAll('tbody, ul, ol').forEach(parent => {
      const children = Array.from(parent.children);
      if (children.length < 2) return;
      for (let i = children.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        const tmp = children[i]; children[i] = children[j]; children[j] = tmp;
      }
      children.forEach(el => parent.appendChild(el));
    });
  }
  // clone a random interactive control as an adjacent, name-identical sibling — a genuine twin.
  // The clone NEVER carries the original's data-oracle (it is not the ground-truth target; it is
  // the ambiguity itself) — false-heal checking stays keyed to the ORIGINAL element only.
  function twin(stageEl, rnd) {
    const cands = Array.from(stageEl.querySelectorAll('button, a, [role=button]'));
    if (!cands.length) return;
    const el = cands[Math.floor(rnd() * cands.length)];
    const clone = el.cloneNode(true);
    clone.removeAttribute('data-oracle');
    clone.setAttribute('data-twin-of', el.getAttribute('data-oracle') || '');
    el.parentNode.insertBefore(clone, el.nextSibling);
  }

  const KINDS = ['restyle', 'localize', 'reorder', 'twin'];
  function applyMutation(stageEl, kind, rnd) {
    if (kind === 'restyle') return restyle(stageEl);
    if (kind === 'localize') return localize(stageEl);
    if (kind === 'reorder') return reorder(stageEl, rnd);
    if (kind === 'twin') return twin(stageEl, rnd);
    throw new Error('drift-torture.js: unknown mutation kind "' + kind + '"');
  }

  root.__DRIFT_TORTURE = { applyMutation, KINDS };
})(typeof window !== 'undefined' ? window : globalThis);
