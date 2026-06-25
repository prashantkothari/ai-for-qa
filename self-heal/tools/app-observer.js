/* self-heal/tools/app-observer.js — self-contained, cross-origin-injectable page measurer.
 *
 * PURPOSE: MEASURE the real failure surface across live apps (NOT build a brain / NOT heal).
 * Injected verbatim via Chrome MCP javascript_tool into whatever app the user opens. Standalone —
 * no dependency on selfheal-core / localhost (apps are cross-origin).
 *
 * PRIVACY: emits only COUNTS, percentages, and the origin host. No element text, labels, URLs,
 * or user content leave the page. (Aligns with the I27 privacy model.)
 *
 * KEY METRICS (why this run matters):
 *   ambiguousPct            — how often visible interactives fall into tied (role+name) sets → where
 *                             the matcher abstains and disambiguation is needed.
 *   rowTextDistinguishablePct — of those tied sets, how many container row-text could SAFELY
 *                             disambiguate → the real-world applicability rate of disambiguateByContext.
 *   recordability_pct       — strong-anchor coverage (testid/stable-id/id-fragment) → the heal-rate ceiling.
 */
(function () {
  const norm = s => (s || '').replace(/\s+/g, ' ').trim();
  const tok = s => norm(s).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const esc = s => { try { return (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&'); } catch (e) { return s; } };
  const looksHashed = s => !!s && (/[0-9a-f]{6,}/i.test(s) || /^(css-|sc-|jsx-|emotion-)/.test(s) || /__|\d{3,}/.test(s) || (/[a-z]/i.test(s) && /\d/.test(s) && s.length >= 8 && !/[ _]/.test(s)));
  const TESTID = ['data-testid', 'data-test', 'data-qa', 'data-cy', 'data-automation'];
  const testidOf = el => { for (const a of TESTID) { const v = el.getAttribute(a); if (v) return v; } return null; };
  function roleOf(el) {
    const r = el.getAttribute('role'); if (r) return r;
    const t = el.tagName.toLowerCase();
    if (t === 'a' && el.hasAttribute('href')) return 'link';
    if (t === 'button') return 'button';
    if (t === 'input') { const ty = (el.getAttribute('type') || 'text').toLowerCase(); return ty === 'checkbox' ? 'checkbox' : ty === 'radio' ? 'radio' : (ty === 'submit' || ty === 'button' || ty === 'reset') ? 'button' : 'textbox'; }
    if (t === 'select') return 'listbox'; if (t === 'textarea') return 'textbox';
    return t;
  }
  function nameOf(el) {
    let lbl = '';
    try { if (el.id) { const l = document.querySelector('label[for="' + esc(el.id) + '"]'); if (l) lbl = l.textContent; } } catch (e) {}
    return norm(el.getAttribute('aria-label') || lbl || el.value || (el.textContent || '').slice(0, 40) || el.getAttribute('placeholder') || el.getAttribute('title') || '');
  }
  function isVisible(el) { try { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; } catch (e) { return false; } }
  const SEL = 'a[href],button,input,select,textarea,[role=button],[role=link],[role=menuitem],[role=tab],[role=checkbox],[role=radio],[onclick],[tabindex]';
  function anchorOf(el) {
    if (testidOf(el)) return 'testid';
    const id = el.getAttribute('id');
    if (id && !looksHashed(id)) return 'stable-id';
    if (id && looksHashed(id) && /[-_:][A-Za-z]{3,}/.test(id)) return 'id-fragment';
    if (nameOf(el)) return 'name-only';
    return 'anchorless';
  }
  const ROW_TAGS = ['tr', 'li', 'td', 'th', 'article', 'section', 'fieldset', 'dd', 'dt'];
  const ROW_ROLES = ['row', 'listitem', 'gridcell', 'group'];
  function containerOf(el) {
    let n = el.parentElement;
    while (n && n.nodeType === 1) {  // 1) semantic row container
      const t = n.tagName.toLowerCase(); const r = n.getAttribute && n.getAttribute('role');
      if (ROW_TAGS.indexOf(t) !== -1 || (r && ROW_ROLES.indexOf(r) !== -1)) return n;
      n = n.parentElement;
    }
    n = el.parentElement;            // 2) div-soup: nearest repeating sibling unit (Ledger K25)
    while (n && n.parentElement && n.nodeType === 1) {
      const sibs = [].slice.call(n.parentElement.children).filter(c => c.tagName === n.tagName);
      if (sibs.length >= 2) {
        const rich = sibs.filter(s => s.querySelector(SEL));
        if (rich.length >= 2 && rich.indexOf(n) !== -1) return n;
      }
      n = n.parentElement;
    }
    return el.parentElement || el;
  }

  // K24: count LAID-OUT controls (box present, incl. hover/visually-hidden) — the surface a test
  // actually touches. Strict-visible alone undercounts SPAs badly (Gong: 247 strict vs 673 laid-out).
  const box = el => { try { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; } catch (e) { return false; } };
  const els = [].slice.call(document.querySelectorAll(SEL));
  const all = els.filter(box);                  // honest interactive surface
  const strictVisibleCount = els.filter(isVisible).length;
  const mix = { testid: 0, 'stable-id': 0, 'id-fragment': 0, 'name-only': 0, anchorless: 0 };
  const byKey = {};
  all.forEach(el => {
    mix[anchorOf(el)]++;
    if (!testidOf(el)) { const k = roleOf(el) + '::' + nameOf(el); (byKey[k] = byKey[k] || []).push(el); }  // testid'd → not ambiguous
  });
  // tied sets = same (role+name), ≥2 visible, with a non-empty name (anchorless-noname handled separately)
  const tiedSets = Object.keys(byKey).filter(k => byKey[k].length > 1 && k.split('::')[1]);
  let distinguishable = 0;
  tiedSets.forEach(k => {
    const xs = byKey[k]; const nameTok = new Set(tok(k.split('::')[1]));
    const sigs = xs.map(el => tok(norm(containerOf(el).textContent)).filter(t => !nameTok.has(t)).sort().join(' '));
    if (new Set(sigs).size === xs.length && sigs.indexOf('') === -1) distinguishable++;   // each member has a DISTINCT, non-empty row signature
  });
  const strong = mix.testid + mix['stable-id'] + mix['id-fragment'];
  const tiedEls = tiedSets.reduce((n, k) => n + byKey[k].length, 0);
  return {
    host: location.host,
    interactiveLaidOut: all.length,        // honest surface (incl. hover/visually-hidden) — K24
    interactiveStrictVisible: strictVisibleCount,
    anchorMix: mix,
    recordability_pct: all.length ? Math.round(100 * strong / all.length) : 0,
    ambiguousSets: tiedSets.length,
    ambiguousElements: tiedEls,
    ambiguousPct: all.length ? Math.round(100 * tiedEls / all.length) : 0,
    rowTextDistinguishableSets: distinguishable,
    rowTextDistinguishablePct: tiedSets.length ? Math.round(100 * distinguishable / tiedSets.length) : 0
  };
})()
