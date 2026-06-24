/* self-heal/pipeline/candidate-widening.js — Ledger K28: widen the candidate set to catch
 * roleless, attribute-less click targets (React-handler <div>s — Gong Slides cards, product-grid
 * cards) that core `WEB.candidates` (a/button/input/select/textarea/[role]) cannot see.
 *
 * Depends on the validated matcher core (window.SELFHEAL / require('../../selfheal-core.js')).
 * Does NOT modify the core — this is a pipeline-layer extension, OFF by default.
 *
 * WHY OPT-IN, NOT A CORE DEFAULT (measured — see docs/CANDIDATE-COVERAGE.md):
 *   Click handlers are NOT DOM-introspectable, so widening must lean on AFFORDANCE HINTS
 *   (cursor:pointer, tabindex, aria-*), which are proxies, not proof. On a live Flipkart product
 *   grid (onClick-fiber oracle as ground truth) the precision/recall tradeoff is stark:
 *     cursor:pointer (raw) ...... recall 0.90  precision 0.08   (1462 false positives — UNUSABLE)
 *     pointer-root .............. recall 0.30  precision 0.65
 *     this guarded widener ...... recall 0.27  precision 0.65   (57 flagged, 20 false positives)
 *   ~1 in 3 widened candidates is NOT a genuine target. Injecting that into the *default* matcher
 *   path — whose gating metric is false-heal == 0 — is unsafe, so widening is an explicit opt-in
 *   lever for SPA coverage, fronted by the core's actionability gate + verify-by-effect backstop.
 *
 * THE PRECISION LEVER (pointer-root): cursor:pointer is INHERITED down the whole subtree, so every
 *   descendant of a clickable card reports it → raw cursor:pointer floods (8% precision). The real
 *   target is the OUTERMOST pointer element (cursor:pointer whose parent is NOT). That one change is
 *   an 8x precision gain. cursor:pointer ALONE is therefore rejected here.
 */
(function (root) {
  let S = (root && root.SELFHEAL) || null;
  if (!S && typeof module !== 'undefined' && module.exports) { try { S = require('../../selfheal-core.js'); } catch (e) { /* fall through */ } }
  S = S || (root && root.SELFHEAL);
  const { WEB, descFromStep, verdict, scoreEx, isShown, isEnabled, diagnose } = S;

  // computed style, layout-safe: detached DOMParser docs have no layout/window → getComputedStyle
  // returns empty strings, so pointer signals quietly yield false and only attribute hints fire.
  function cs(el) { try { const v = (el.ownerDocument && el.ownerDocument.defaultView) || (typeof window !== 'undefined' ? window : null); return v && v.getComputedStyle ? v.getComputedStyle(el) : null; } catch (e) { return null; } }
  function area(el) { try { const r = el.getBoundingClientRect(); return r.width * r.height; } catch (e) { return 0; } }
  const cursorPointer = c => !!c && c.cursor === 'pointer';

  // POINTER-ROOT: outermost cursor:pointer element (parent not pointer) — dedups the inherited subtree.
  function pointerRoot(el) {
    const c = cs(el); if (!cursorPointer(c)) return false;
    const p = el.parentElement; if (!p) return true;
    return !cursorPointer(cs(p));
  }
  const hasAria = el => { const a = el.attributes; for (let i = 0; i < a.length; i++) { if (a[i].name.indexOf('aria-') === 0) return true; } return false; };
  const hasTabindex = el => el.hasAttribute('tabindex') && el.getAttribute('tabindex') !== '-1';

  const NATIVE_SEL = 'a[href],button,input,select,textarea';
  const ROLE_SEL = '[role=button],[role=link],[role=menuitem],[role=tab],[role=checkbox],[role=radio],[role=switch],[role=option]';
  const isNative = el => { try { return el.matches(NATIVE_SEL) || el.matches(ROLE_SEL) || (el.getAttribute && !!el.getAttribute('role')); } catch (e) { return false; } };

  function repeatingSibling(el) {
    const p = el.parentElement; if (!p) return false;
    let same = 0; const ch = p.children;
    for (let i = 0; i < ch.length; i++) { if (ch[i].tagName === el.tagName) same++; }
    return same >= 3;
  }
  function wrapsNative(el, baseSet) { for (let i = 0; i < baseSet.length; i++) { const c = baseSet[i]; if (c !== el && el.contains(c)) return true; } return false; }

  // The accept rule (data-driven on Flipkart): affordance must be pointer-root or an explicit
  // focusable/aria hint; cursor:pointer alone is NOT accepted (it floods). Guards drop styled inline
  // text, icon-glyph-sized specks, page-sized backdrops, and wrappers around a real control.
  function accept(el, baseSet, viewArea) {
    if (isNative(el)) return false;
    const c = cs(el);
    if (c && (c.display === 'inline')) return false;                 // inline styled text span, not a target
    const a = area(el);
    if (a > 0) { if (a < 24 || a > 0.5 * viewArea) return false; }   // layout present → size guards (skip if detached)
    const affordance = pointerRoot(el) || hasTabindex(el) || hasAria(el);
    if (!affordance) return false;
    if (wrapsNative(el, baseSet) && !repeatingSibling(el)) return false;  // prefer the inner control unless it's a card grid
    return true;
  }

  // Return base WEB.candidates PLUS the accepted roleless click targets (deduped, order preserved).
  function widenCandidates(doc, opts) {
    opts = opts || {};
    const base = WEB.candidates(doc);
    const baseSet = base.slice();
    const v = (doc.defaultView) || (typeof window !== 'undefined' ? window : null);
    const viewArea = (v && v.innerWidth ? v.innerWidth * v.innerHeight : 1280 * 800);
    const seen = new Set(base);
    const extra = [];
    const scan = doc.querySelectorAll('div,span,li,section,article,td,tr,figure,label');
    for (let i = 0; i < scan.length; i++) {
      const el = scan[i];
      if (seen.has(el)) continue;
      if (accept(el, baseSet, viewArea)) { extra.push(el); seen.add(el); }
    }
    return { candidates: base.concat(extra), added: extra.length, baseCount: base.length, extra };
  }

  // matchStepWidened — mirrors core matchStep's CONTRACT (scope→rank→verdict→gate→diagnose) but over
  // the widened candidate set. Reuses core scoring/verdict/gate verbatim so numbers stay comparable.
  // Result carries {widened:true, widenedAdded:n} so callers/diagnosis can see the lever fired.
  function matchStepWidened(doc, step, opts) {
    opts = opts || {};
    const desc = descFromStep(step.target.descriptor);
    const w = widenCandidates(doc, opts);
    let cands = w.candidates;
    if (opts.scopeVisible !== false) cands = cands.filter(el => isShown(el) && isEnabled(el));
    if (step.scope && step.scope.container) { const region = doc.querySelector(step.scope.container); if (region) cands = cands.filter(el => region.contains(el)); }
    if (!cands.length) return { verdict: 'fail', diagnosis: 'not-ready', best: null, margin: 0, cands: [], ranked: [], widened: true, widenedAdded: w.added };
    const ranked = cands.map(el => { const ex = WEB.extract(el, doc); return { el, ex, conf: scoreEx(ex, desc) }; }).sort((a, b) => b.conf - a.conf);
    const vd = verdict(ranked);
    if (vd.v === 'heal' && opts.gate !== false) {
      const act = WEB.actionable(vd.best.el);
      if (!act.usable) return { verdict: 'abstain', best: vd.best, margin: vd.margin, gated: true, diagnosis: act.reason || 'not-usable', cands, ranked, widened: true, widenedAdded: w.added };
    }
    if (vd.v === 'heal') return { verdict: 'heal', best: vd.best, margin: vd.margin, diagnosis: null, cands, ranked, widened: true, widenedAdded: w.added };
    return { verdict: vd.v, best: vd.best, margin: vd.margin, diagnosis: diagnose(ranked, vd), cands, ranked, widened: true, widenedAdded: w.added };
  }

  const API = { widenCandidates, matchStepWidened, pointerRoot, accept };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.SELFHEAL_WIDEN = API;
})(typeof window !== 'undefined' ? window : globalThis);
