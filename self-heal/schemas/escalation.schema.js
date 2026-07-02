/* self-heal/schemas/escalation.schema.js — the det↔LLM handoff contract (F3).
 *
 * LLM is called at only 3 points (§2 decision 5): test-gen, nameless-icon residue, stuck→HITL.
 * All three share the same shape: a REQUEST describes the deterministic failure/miss + context;
 * a RESPONSE returns EITHER refined targets/steps OR a "cannot resolve" reason. Schema-checked at
 * both ends so we can swap models without touching pipeline code.
 */
(function (root) {
  const requestSchema = {
    $id: 'escalation-request/v1',
    type: 'object',
    required: ['schemaVersion', 'reason', 'app', 'screen'],
    properties: {
      schemaVersion: { const: 'escalation-request/v1' },
      reason: { type: 'string', enum: ['testgen', 'nameless-residue', 'stuck'] },
      app: { type: 'string', minLength: 1 },
      screen: {
        type: 'object',
        required: ['url', 'domSummary'],
        properties: {
          url: { type: 'string' },
          domSummary: { type: 'string' },              // trimmed control list, not raw HTML
          screenshot: { type: ['string', 'null'] }     // data:image/... or null
        },
        additionalProperties: false
      },
      failure: {                                        // present for nameless-residue + stuck
        type: ['object', 'null'],
        required: ['verdict'],                          // without it the LLM has no grounding for the ask
        properties: {
          verdict: { type: 'string', enum: ['abstain', 'fail'] },
          category: { type: 'string' },                // AMBIGUITY|REMOVAL|STATE_ISSUE|TEMPORAL|UNKNOWN
          diagnosis: { type: 'string' }
        },
        additionalProperties: false
      },
      goal: { type: ['string', 'null'] }              // set for testgen
    },
    additionalProperties: false
  };

  const responseSchema = {
    $id: 'escalation-response/v1',
    type: 'object',
    required: ['schemaVersion', 'ok'],
    properties: {
      schemaVersion: { const: 'escalation-response/v1' },
      ok: { type: 'boolean' },
      // when ok===true, EXACTLY one of these branches is populated:
      testPlan: { type: ['object', 'null'] },          // conforms to test-plan/v1 (validated separately)
      hint: {                                          // for nameless-residue / stuck
        type: ['object', 'null'],
        properties: {
          containerText: { type: 'string' },
          nearbyLabel: { type: 'string' },
          ordinal: { type: ['integer', 'null'], minimum: 0 }
        },
        additionalProperties: false
      },
      // when ok===false:
      reason: { type: ['string', 'null'] },            // 'cannot-resolve'|'ambiguous'|'refused'
      confidence: { type: ['number', 'null'], minimum: 0, maximum: 1 }
    },
    additionalProperties: false
  };

  const API = { REQUEST: requestSchema, RESPONSE: responseSchema, VERSION: 'escalation/v1' };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.SELFHEAL_SCHEMA_ESCALATION = API;
})(typeof window !== 'undefined' ? window : globalThis);
