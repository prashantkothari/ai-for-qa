/* self-heal/tools/amplitude-stash.js — capture-side snippet, runs IN the cross-origin Amplitude tab.
 *
 * Implements the cross-origin transfer trick (Ledger K-Gong) + Gong lessons (1) content-settle and
 * (2) viewport-scope, BEFORE handing the DOM to the same-origin harness:
 *   1. CONTENT-SETTLE GATE: poll the interactive-control count until it is stable across two ticks
 *      (SPA async render — Gong captured an un-rendered tab twice). Abort with a flag if never settles.
 *   2. VIEWPORT-SCOPE: tag every in-viewport laid-out candidate with data-vp="1" so the (layout-less)
 *      harness doc can restrict the candidate universe to what a real runner's resolveScope sees.
 *   3. STASH: serialize documentElement.outerHTML into window.name (survives same-tab cross-origin nav).
 *
 * Returns a summary object. The caller then navigates THIS tab to the harness on static-server.py.
 * Invoke via Chrome MCP javascript_tool with `await`.
 */
(async function () {
  const SEL = 'input,button,a,select,textarea,[role]';
  const inViewport = el => { try { const r = el.getBoundingClientRect(); const vw = innerWidth, vh = innerHeight;
    return r.width > 1 && r.height > 1 && r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw; } catch (e) { return false; } };
  const tid = el => { for (const a of ['data-testid','data-test','data-qa','data-cy','data-automation']) { const v = el.getAttribute(a); if (v) return v; } return null; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // (1) content-settle: testid count stable across 2 polls (≤ 8 tries)
  let prev = -1, settled = false, tries = 0;
  for (; tries < 8; tries++) {
    const n = document.querySelectorAll('[data-testid]').length;
    if (n === prev && n > 0) { settled = true; break; }
    prev = n; await sleep(500);
  }
  const testidCount = document.querySelectorAll('[data-testid]').length;

  // (2) viewport-scope tagging (clean prior tags first)
  document.querySelectorAll('[data-vp]').forEach(el => el.removeAttribute('data-vp'));
  let tagged = 0;
  document.querySelectorAll(SEL).forEach(el => { if (inViewport(el)) { el.setAttribute('data-vp', '1'); tagged++; } });

  // (3) stash
  const html = document.documentElement.outerHTML;
  window.name = html;

  return {
    settled, settlePolls: tries + 1, testidCount,
    viewportTagged: tagged,
    bytes: html.length,
    url: location.href,
    portalsOpen: document.querySelectorAll('[role=listbox],[role=menu],[role=dialog]').length,
    note: settled ? 'content-settled; DOM stashed to window.name — navigate THIS tab to the harness now'
                  : 'WARNING: content did not settle (SPA still rendering?) — stash done anyway, flagged'
  };
})()
