/* self-heal/tools/hitl-live-demo.js — drive the HITL overlay IN the live app tab, highlighting the
 * real control for each card.
 *
 * WHY (the user's question): the window.name transfer trick navigates the capture tab AWAY from the
 * app to the same-origin harness, so at HITL time the app isn't on screen → a card like
 * `presentation ""` is unanchorable. Fix: render the human-facing cards where the app + human ARE —
 * the live app tab — and HIGHLIGHT the actual element (outline + scroll-into-view) as each card shows.
 * The matcher sweep stays on the harness; only the cards move to the app. This is also the
 * productization-faithful shape (a bookmarklet / content-script extension runs inside the app).
 *
 * Standalone: depends only on window.__hitl (hitl-overlay.js, also injectable cross-origin) — NOT on
 * selfheal-core. Re-locates each demo control LIVE by its strongest anchor.
 *
 * Usage (inject hitl-overlay.js first, then this, then):
 *   await window.__hitlDemo.run(CASES)   // CASES = [{selector|find, kind, card}], see buildCards()
 */
window.__hitlDemo = (function () {
  const norm = s => (s || '').replace(/\s+/g, ' ').trim();
  // re-locate a control on the LIVE page: prefer testid, else role+name, else a text+role scan.
  function locate(spec) {
    if (spec.selector) { try { const el = document.querySelector(spec.selector); if (el) return el; } catch (e) {} }
    if (spec.testid) { const el = document.querySelector("[data-testid='" + spec.testid + "']"); if (el) return el; }
    if (spec.role || spec.name) {
      const cands = [].slice.call(document.querySelectorAll('button,a,input,[role],div'));
      const hit = cands.find(el => {
        const role = el.getAttribute('role') || el.tagName.toLowerCase();
        const nm = norm(el.getAttribute('aria-label') || el.textContent).slice(0, 40);
        return (!spec.role || role === spec.role) && (!spec.name || nm.indexOf(spec.name) !== -1) &&
               (!spec.rowContains || norm((el.closest('[role=row],li,tr,section,div')||el).textContent).indexOf(spec.rowContains) !== -1);
      });
      if (hit) return hit;
    }
    return null;
  }

  async function run(cases) {
    const h = window.__hitl; if (!h) throw new Error('inject hitl-overlay.js first');
    h.interactive = true;
    const decisions = [];
    for (const c of cases) {
      const el = locate(c);
      const found = el ? h.highlight(el, c.card.title || c.kind) : false;
      const card = Object.assign({}, c.card, { kind: c.kind });
      if (!found) card.where = (card.where || '') + '  [LIVE ELEMENT NOT FOUND — open the right tab/portal]';
      const d = await h.show(card);
      d.located = found; d.caseId = c.id || null;
      decisions.push(d);
      h.clearHighlight();
    }
    h.close();
    return decisions;
  }

  return { run, locate };
})();
window.__hitlDemo_READY = true;
