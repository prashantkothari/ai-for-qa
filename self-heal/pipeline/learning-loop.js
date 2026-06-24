/* self-heal/pipeline/learning-loop.js — Step 6: improve over time from VERIFIED outcomes.
 *
 * STATUS: P2/P3 — STUB (documented + pseudocode only; throws if called).
 *
 * Why not in P1:
 *   - Promote/demote ("3–5 verified successes ↑, 1–2 false-positives ↓", Ledger I16) requires
 *     RUNTIME-VERIFIED outcomes. P1 has none — wiring it to inferred (static) outcomes would
 *     contaminate stats (the OV#4 trap). So it MUST wait for outcome-verification at HIGH confidence.
 *   - The compounding moat (Ledger I27 / K-series) is CROSS-TENANT outcome aggregation, not
 *     per-user pattern recognition. Privacy model: share signal-profiles + outcomes ONLY — never
 *     DOM snapshots, URLs, or user data. Aggregate across tenants, not per-tenant. → P3.
 *
 * Pseudocode (P2):
 *   function learn(store, patternKey, verification):
 *     if verification.confidence !== 'HIGH': return store      // OV#4 guard — never learn from unverified
 *     rec = store.get(patternKey) || {successes:0, failures:0, observations:0}
 *     rec.observations += 1
 *     verification.passed ? rec.successes++ : rec.failures++
 *     return store.set(patternKey, rec)                        // promote at successes≥5; demote at failures≥2
 */
(function (root) {
  function learn() {
    throw new Error('learning-loop: P2/P3 — needs HIGH-confidence runtime-verified outcomes (I16/OV#4) ' +
                    'and a federated cross-tenant store (I27). Not implemented in P1.');
  }
  const API = { learn };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.SELFHEAL_LEARN = API;
})(typeof window !== 'undefined' ? window : globalThis);
