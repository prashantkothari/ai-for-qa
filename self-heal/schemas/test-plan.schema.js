/* self-heal/schemas/test-plan.schema.js — OpenTest.ai-shaped test plan (what testgen.js emits, what
 * executeLive consumes). Formalised so LLM-authored tests can be rejected pre-run (§13 false-test guard).
 *
 * Kept as a JS module (not raw .json) so we can load it into the browser without fetch(). Schema is a
 * plain object; the shape matches window.__S7_RESULT.suite (testKeys/stepKeys probed live).
 */
(function (root) {
  const stepSchema = {
    type: 'object',
    required: ['action'],
    properties: {
      description: { type: 'string' },
      thinking: { type: 'string' },
      action: { type: 'string', enum: ['navigate', 'fill', 'click', 'assert'] },
      target: { type: 'string' },                 // NL/visible-text; matcher resolves via _anchor
      value: { type: 'string' },                  // test data (fill only)
      expected: { type: 'string' },
      _anchor: { type: ['object', 'null'] }       // opaque descriptor from captureStep
    },
    additionalProperties: false,
    // discriminate by action: navigate needs no target; fill/click/assert must name one — else the
    // false-test guard (§13) can't catch a malformed LLM-authored step before it reaches the executor
    // (executeLive/opentest-runner both read .target unconditionally for these three actions).
    oneOf: [
      { properties: { action: { const: 'navigate' } } },
      { properties: { action: { enum: ['fill', 'click', 'assert'] } }, required: ['target'] }
    ]
  };

  const testSchema = {
    type: 'object',
    required: ['id', 'title', 'kind', 'steps'],
    properties: {
      id: { type: 'string', pattern: '^[A-Za-z][A-Za-z0-9_-]{0,63}$' },
      title: { type: 'string', minLength: 1 },
      goal: { type: 'string' },
      kind: { type: 'string', enum: ['positive', 'negative', 'smoke'] },
      steps: { type: 'array', minItems: 1, items: stepSchema }
    },
    additionalProperties: false
  };

  const planSchema = {
    $id: 'test-plan/v1',
    type: 'object',
    required: ['screenType', 'tests'],
    properties: {
      screenType: { type: 'string' },              // 'login'|'partial'|'generic' etc — free-form
      tests: { type: 'array', minItems: 1, items: testSchema }
    },
    additionalProperties: false
  };

  const API = { PLAN: planSchema, TEST: testSchema, STEP: stepSchema, VERSION: 'test-plan/v1' };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.SELFHEAL_SCHEMA_TESTPLAN = API;
})(typeof window !== 'undefined' ? window : globalThis);
