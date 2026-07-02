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
      // selfheal-core.js's noAnchorVeto (2026-07-02 false-heal fix): a candidate DID clear
      // TH.heal/TH.margin here — this is NOT "nothing matched" (that's 'no-identity' above). It is
      // a deliberate POLICY decline: the recorded step never had a real anchor (no testid/id/name/
      // nameAttr — bestLocator() tier 'none'), so the winner was chosen by score+margin over pure
      // DOM context (role/tag/type/inForm/formAction), which cannot distinguish a genuine
      // re-location from a coincidental same-shape sibling. Mislabeling this REMOVAL would tell the
      // user "go check if the feature still exists" when the real, actionable fix is "add a stable
      // anchor (data-testid recommended) to this control at record time" — closest existing
      // category is AMBIGUITY (P1 "can't deterministically discriminate" — here, between "this
      // candidate is genuinely the same control" and "this candidate merely won by elimination").
      case 'no-anchor':
        return { category: 'AMBIGUITY', reason: 'a candidate cleared the heal threshold, but the recorded step has no identifying anchor (no testid/id/name) to trust it against — likely a coincidental match among generically similar controls, not a verified re-location; add a stable anchor (data-testid recommended) at record time' };
      default:
        return { category: 'UNKNOWN', reason: result.diagnosis || 'unclassified' };
    }
  }

  const API = { diagnoseFailure };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.SELFHEAL_DIAGNOSIS = API;
})(typeof window !== 'undefined' ? window : globalThis);
