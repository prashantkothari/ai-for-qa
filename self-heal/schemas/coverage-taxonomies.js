/* self-heal/schemas/coverage-taxonomies.js — closed vocabularies for the AUTHORING coverage layer.
 *
 * Every list here exists to kill a specific failure mode: an open-ended string field lets a gap
 * generator or refusal invent its own category, which is exactly the fabrication this project's
 * false-heal=0 / no-fabrication rules forbid on the healer side. Closed enums make every gap and
 * every refusal machine-checkable and buyer-legible (see self-heal/docs/AUTHORING-MOCK-EXPERIMENT.md).
 *
 * ENVIRONMENT is deliberately NOT one flat enum (the design doc's illustrative list mixed platform,
 * locale, network, and auth-state into a single set). A coverage cell is a tuple across these
 * independent axes — "en-US x web-desktop x slow-3G" is three axes, not one value — so splitting
 * them here is a refinement over the doc, not a divergence from it.
 *
 * ORACLE_CONDITION adds `set` alongside `unset` — the doc's worked example ("decomposes to
 * unset(reservation_id) -> set(reservation_id)") needs both halves; only `unset` was listed.
 */
(function (root) {
  const ELEMENT_TYPE = [
    'button', 'input', 'select', 'link', 'label', 'list-item', 'image', 'icon-only',
    'container', 'text', 'overlay', 'tui-prompt', 'tui-menu-item', 'tui-cursor'
  ];

  const ACTION = [
    'navigate', 'click', 'fill', 'select', 'hover', 'wait-for', 'key', 'read',
    'assert-visible', 'assert-hidden', 'assert-equals', 'assert-matches'
  ];

  // post-condition primitives the symbolized oracle is built from (WebTestPilot-derived discipline:
  // pass/fail checks a named condition on a symbol, never an LLM's opinion of the screen)
  const ORACLE_CONDITION = [
    'presence', 'absence', 'equals', 'matches', 'contains', 'in-range',
    'count-equals', 'count-at-least', 'ordered', 'not-changed', 'changed', 'unset', 'set'
  ];

  const GAP_TYPE = [
    'missing-cell', 'missing-cross-service', 'missing-negative', 'missing-boundary',
    'missing-locale', 'missing-role', 'missing-network-condition', 'missing-recovery-path'
  ];

  const REFUSE_REASON = [
    'ambiguous-spec', 'externally-gated', 'data-not-known', 'pre-condition-unresolvable',
    'element-not-found', 'permission-not-simulatable', 'oracle-underdetermined',
    'flaky-signal-insufficient'
  ];

  const SCREEN_STATE = [
    'initial', 'mid-flow', 'blocking-modal', 'error-state', 'loading',
    'resumed', 'logged-out', 'permission-denied'
  ];

  const DATA_CLASS = [
    'valid', 'boundary-low', 'boundary-high', 'just-over', 'malformed', 'empty',
    'null', 'unicode-name', 'expired', 'duplicate', 'adversarial'
  ];

  // split from the doc's single ENVIRONMENT list — see file header
  const PLATFORM = ['web-desktop', 'web-mobile', 'tui'];
  const LOCALE = ['en-US', 'ja-JP', 'de-DE'];
  const NETWORK_CONDITION = ['normal', 'slow-3G', 'offline', 'offline-recover'];
  const AUTH_STATE = ['logged-in', 'guest', 'logged-out'];

  const SERVICE_TAG = ['critical', 'supporting', 'external', 'unknown'];

  const API = {
    ELEMENT_TYPE, ACTION, ORACLE_CONDITION, GAP_TYPE, REFUSE_REASON, SCREEN_STATE,
    DATA_CLASS, PLATFORM, LOCALE, NETWORK_CONDITION, AUTH_STATE, SERVICE_TAG,
    VERSION: 'coverage-taxonomies/v1'
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.SELFHEAL_TAXONOMIES = API;
})(typeof window !== 'undefined' ? window : globalThis);
