/* self-heal/pipeline/change-diagnosis.js — Step 1: classify WHY a step failed.
 *
 * REPORTING layer (P1). GROUNDED: built only on outputs the core already produces
 * (verdict, diagnosis, gated, disambiguated). It RELABELS into the failure-mode taxonomy; it does
 * NOT re-decide. Decision-divergence vs matchStep ≈ 0 in P1 — see Ledger GA2 / R1. Honest P1 value
 * = a named, actionable failure category instead of a silent stop.
 *
 * Categories (docs/FAILURE-TAXONOMY.md):
 *   DRIFT | REMOVAL | AMBIGUITY | STATE_ISSUE | TEMPORAL | FLOW_CHANGE | UNKNOWN
 * P1 can deterministically reach: DRIFT, AMBIGUITY, STATE_ISSUE, and REMOVAL (= not-found).
 * TEMPORAL (appears-after-wait) and FLOW_CHANGE (semantics changed) need runtime / record-time
 * intent to separate from REMOVAL — so they are NOT fabricated here; REMOVAL carries an honest hint.
 */
(function (root) {
  // result = output of matchStep() or candidate-generation.disambiguate()
  function diagnoseFailure(result) {
    if (!result) return { category: 'UNKNOWN', reason: 'no result object' };

    if (result.verdict === 'heal') {
      return {
        category: 'DRIFT',
        reason: result.disambiguated
          ? 'healed after deterministic disambiguation (margin tie broken by elimination)'
          : 'healed: stable signals re-located the element'
      };
    }

    // gated = identity matched but the element is not interactable (overlay/disabled/off-screen)
    if (result.gated) {
      return { category: 'STATE_ISSUE', reason: 'element identified but not interactable: ' + (result.diagnosis || 'gated') };
    }

    switch (result.diagnosis) {
      case 'ambiguous':
        return { category: 'AMBIGUITY', reason: 'multiple candidates tied within margin; no deterministic discriminator' };
      case 'not-ready':
        return { category: 'REMOVAL', reason: 'no candidate on current screen — removed, OR not yet rendered (TEMPORAL needs runtime to distinguish)' };
      case 'no-identity':
        return { category: 'REMOVAL', reason: 'no candidate cleared the identity floor — drifted beyond recognition, OR removed' };
      default:
        return { category: 'UNKNOWN', reason: result.diagnosis || 'unclassified' };
    }
  }

  const API = { diagnoseFailure };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.SELFHEAL_DIAGNOSIS = API;
})(typeof window !== 'undefined' ? window : globalThis);
