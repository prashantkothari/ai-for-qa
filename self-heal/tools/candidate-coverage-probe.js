/* self-heal/tools/candidate-coverage-probe.js — quantify the K28 candidate-coverage gap.
 *
 * PURPOSE: MEASURE the precision/recall tradeoff of widening the candidate selector to catch
 * roleless, attribute-less React-handler <div> clickables (Ledger K28). Injected verbatim via
 * Chrome MCP javascript_tool into a live SPA. Self-contained — no dependency on selfheal-core.
 *
 * THE METHOD (the asymmetry that makes this honest):
 *   - GROUND TRUTH ("is this element really clickable?") is obtained by EXPENSIVE, framework-
 *     coupled introspection: React fiber props (__reactProps$* / __reactEventHandlers$*),
 *     DOM .onclick / [onclick], and Vue event-invoker caches (_vei). This is NOT something the
 *     matcher could use at heal time — it is version-specific, framework-specific, and absent in
 *     Appium/cross-platform. But it is a perfectly valid *measurement oracle*.
 *   - The CANDIDATE HEURISTICS under test are CHEAP, deterministic, framework-agnostic CSS/attr
 *     signals (cursor:pointer, aria-*, tabindex, data-* hints). The question this probe answers:
 *     how well do the cheap signals approximate the expensive oracle, and at what false-positive cost?
 *
 * DELEGATION CAVEAT (measured, not hidden): many SPAs bind ONE onClick high in the tree and use
 * event delegation, so a clickable card may have NO own handler — the fiber sits on an ancestor.
 * The oracle reports `delegatedRoots` (handler-bearing ancestors of >=3 similar children) so we can
 * see when per-element handler introspection is structurally impossible, not just unimplemented.
 *
 * PRIVACY: emits only COUNTS, percentages, and the origin host. No element text/labels/URLs leave
 * the page. (Aligns with the I27 privacy model and app-observer.js.)
 */
(function () {
  // ---------- laid-out filter (K24: count the surface a test actually touches) ----------
  const box = el => { try { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; } catch (e) { return false; } };
  const area = el => { try { const r = el.getBoundingClientRect(); return r.width * r.height; } catch (e) { return 0; } };
  const cs = el => { try { return getComputedStyle(el); } catch (e) { return null; } };

  // ====================================================================================
  // GROUND-TRUTH ORACLE — expensive, framework-coupled introspection (measurement only).
  // ====================================================================================
  // ONCLICK-ONLY (measured choice): onMouseDown/onPointerDown over-count — React attaches them for
  // ripples, hover, drag and analytics, NOT navigation. Restricting to onClick/onClickCapture gave the
  // honest "genuine click target" ground truth (Flipkart: 139 vs 142 — handler noise was small, the
  // count is dominated by REAL nested onClick, not ripple noise).
  const CLICK_PROPS = ['onClick', 'onClickCapture'];
  function reactClick(el) {
    // React 17+ exposes props on the DOM node under a hashed key __reactProps$<rand>;
    // React 16 used __reactEventHandlers$<rand>. The value is the JSX props object.
    for (const k in el) {
      if (k.charCodeAt(0) === 95 && (k.indexOf('__reactProps$') === 0 || k.indexOf('__reactEventHandlers$') === 0)) {
        const p = el[k];
        if (p) for (const h of CLICK_PROPS) { if (typeof p[h] === 'function') return true; }
      }
    }
    return false;
  }
  function vueClick(el) {
    // Vue 3 caches wrapped event handlers on el._vei keyed by "onClick" etc.
    const vei = el._vei;
    if (vei) { for (const k in vei) { if (/^onClick/i.test(k)) return true; } }
    return false;
  }
  function domClick(el) {
    return typeof el.onclick === 'function' || el.hasAttribute('onclick');
  }
  // own-handler oracle: does THIS element carry a click handler?
  function hasOwnHandler(el) { return domClick(el) || reactClick(el) || vueClick(el); }

  // ---------- native-semantic set (what the core already understands) ----------
  const NATIVE_SEL = 'a[href],button,input,select,textarea';
  const ROLE_SEL = '[role=button],[role=link],[role=menuitem],[role=tab],[role=checkbox],[role=radio],[role=switch],[role=option]';
  function isNativeInteractive(el) { return el.matches(NATIVE_SEL) || el.matches(ROLE_SEL); }

  // ====================================================================================
  // CHEAP HEURISTIC SIGNALS (the detectors under test)
  // ====================================================================================
  const hasAria = el => { const a = el.attributes; for (let i = 0; i < a.length; i++) { const n = a[i].name; if (n.indexOf('aria-') === 0) return true; } return false; };
  const hasTabindex = el => el.hasAttribute('tabindex') && el.getAttribute('tabindex') !== '-1';
  const DATA_HINT = /(data-(test|qa|cy|automation|action|click|track|analytics|ga|event|id|index|key|slide|card|item|product|sku)|^data-[a-z-]*click)/i;
  const hasDataHint = el => { const a = el.attributes; for (let i = 0; i < a.length; i++) { if (DATA_HINT.test(a[i].name)) return true; } return false; };
  function cursorPointer(c) { return c && c.cursor === 'pointer'; }
  // POINTER-ROOT (the key precision lever, found on Flipkart): cursor:pointer is INHERITED down the
  // whole subtree, so every descendant of a clickable card also reports pointer → cursorPointer alone
  // floods (precision ~8%). The real click target is the OUTERMOST pointer element: cursor:pointer
  // whose parent is NOT pointer. This collapses a card's entire pointer subtree to one candidate.
  function pointerRoot(el) {
    const c = cs(el); if (!cursorPointer(c)) return false;
    const p = el.parentElement; if (!p) return true;
    const pc = cs(p); return !cursorPointer(pc);
  }

  // ====================================================================================
  // GUARDED WIDENER — the precision-preserving proposal (mirrors pipeline widenCandidates).
  // Adds a roleless/attribute-less element ONLY if it looks like a discrete, repeating,
  // leaf-ish click target — not a styled text span, not a giant backdrop, not a wrapper.
  // ====================================================================================
  const VIEW_AREA = (window.innerWidth || 1280) * (window.innerHeight || 800);
  function isWrapperOfCandidate(el, baseSet) {
    // contains another base candidate → it's a container, not the leaf target
    for (const c of baseSet) { if (c !== el && el.contains(c)) return true; }
    return false;
  }
  function repeatingSibling(el) {
    // is el one of >=3 same-tag siblings (a grid/list of cards)?
    const p = el.parentElement; if (!p) return false;
    let same = 0; const ch = p.children;
    for (let i = 0; i < ch.length; i++) { if (ch[i].tagName === el.tagName) same++; }
    return same >= 3;
  }
  function guardedAccept(el, c, baseSet) {
    if (!c) return false;
    if (isNativeInteractive(el)) return false;            // already a base candidate
    const a = area(el);
    if (a < 24 || a > 0.5 * VIEW_AREA) return false;      // too tiny (icon glyph in text) or backdrop-sized
    if ((c.display || '') === 'inline') return false;     // inline styled text span, not a discrete target
    // affordance must be a POINTER-ROOT (outermost pointer; dedups the inherited subtree) OR an
    // explicit focusable/aria hint. cursor:pointer alone is rejected — it floods (Flipkart: 8% precision).
    const affordance = pointerRoot(el) || hasTabindex(el) || hasAria(el);
    if (!affordance) return false;
    // a pointer-root that still WRAPS a native control is the card-around-a-button case: keep the
    // wrapper only when it is one of >=3 repeating siblings (a real clickable card grid), else prefer
    // the inner control and drop the wrapper to protect precision.
    if (isWrapperOfCandidate(el, baseSet) && !repeatingSibling(el)) return false;
    return true;
  }

  // ====================================================================================
  // MEASURE
  // ====================================================================================
  const all = [].slice.call(document.querySelectorAll('*')).filter(box);

  // ground-truth clickable set (own-handler), split into native vs the K28 gap (roleless handler els)
  const ownHandler = all.filter(hasOwnHandler);
  const gapTruth = ownHandler.filter(el => !isNativeInteractive(el));   // the elements core CANNOT see today
  // OUTERMOST handler targets: gap-truth nodes with NO handler-bearing ancestor. When this collapses
  // to ~1 (Flipkart) it proves DELEGATION — the app routes clicks through one root handler, so genuine
  // onClick is not per-element attributable even WITH fiber access. The hardest face of the K28 limit.
  const hset = new Set(ownHandler);
  const hasHandlerAncestor = el => { let p = el.parentElement; while (p) { if (hset.has(p)) return true; p = p.parentElement; } return false; };
  const gapTruthOutermost = gapTruth.filter(el => !hasHandlerAncestor(el)).length;

  // delegation roots: handler-bearing elements that wrap >=3 similar children w/o own handlers
  let delegatedRoots = 0, delegatedChildrenEst = 0;
  ownHandler.forEach(el => {
    const kids = [].slice.call(el.children);
    const sameTag = {};
    kids.forEach(k => { sameTag[k.tagName] = (sameTag[k.tagName] || 0) + 1; });
    const maxGroup = Math.max(0, ...Object.values(sameTag));
    if (maxGroup >= 3) { delegatedRoots++; delegatedChildrenEst += maxGroup; }
  });

  // base candidate set (the core/observer baseline) for the wrapper guard
  const baseSet = all.filter(isNativeInteractive);

  // confusion stats for a detector predicate over the GAP universe (non-native laid-out els)
  const gapUniverse = all.filter(el => !isNativeInteractive(el));
  const gapTruthSet = new Set(gapTruth);
  function evalDetector(pred) {
    let tp = 0, fp = 0;
    const flagged = [];
    for (const el of gapUniverse) { if (pred(el)) { flagged.push(el); if (gapTruthSet.has(el)) tp++; else fp++; } }
    const flaggedN = tp + fp;
    const truthN = gapTruth.length;
    return {
      flagged: flaggedN,
      truthPositives: truthN,
      tp, fp,
      precision: flaggedN ? +(tp / flaggedN).toFixed(3) : null,   // of what it flags, fraction really clickable
      recall: truthN ? +(tp / truthN).toFixed(3) : null,          // of really-clickable gap els, fraction caught
    };
  }

  const detectors = {
    cursorPointer:        el => cursorPointer(cs(el)),
    pointerRoot:          el => pointerRoot(el),
    ariaPresent:          el => hasAria(el),
    focusableRoleless:    el => hasTabindex(el),
    dataHint:             el => hasDataHint(el),
    GUARDED_widener:      el => guardedAccept(el, cs(el), baseSet),
  };
  const detectorStats = {};
  for (const k in detectors) detectorStats[k] = evalDetector(detectors[k]);

  return {
    host: location.host,
    title: (document.title || '').slice(0, 60),
    laidOutTotal: all.length,
    nativeInteractive: baseSet.length,
    // --- ground truth ---
    ownHandlerTotal: ownHandler.length,
    gapTruth: gapTruth.length,                  // roleless/attr-less elements that REALLY have a click handler (the K28 gap)
    gapTruthPctOfClickable: ownHandler.length ? Math.round(100 * gapTruth.length / ownHandler.length) : 0,
    gapTruthOutermost,                           // ~1 ⇒ delegation collapse (clicks routed through one root handler)
    delegatedRoots,                              // handler-bearing wrappers of >=3 similar kids (per-element introspection impossible)
    delegatedChildrenEst,
    // --- precision/recall of each cheap detector over the gap ---
    detectors: detectorStats,
  };
})()
