/* self-heal/schemas/coverage-model.schema.js — scenario-COVERAGE shapes (authoring layer), distinct
 * from test-plan.schema.js (which is what testgen.js emits today for login-only execution).
 *
 * Formalises self-heal/docs/AUTHORING-MOCK-EXPERIMENT.md: per-screen element registry, screen
 * transitions, service dependencies, spec statements, coverage-grid cells, named refusals, the
 * symbolized-oracle TEST shape (WebTestPilot-derived: condition/action/expectation, not "the LLM
 * says it passed"), and TEST_GOAL (what the RFP calls an "exploratory charter" — kept plain here).
 *
 * Depends on coverage-taxonomies.js — load that script FIRST. Enums reference it directly so a
 * gap-type or refuse-reason typo fails validation instead of silently becoming a new category.
 *
 * additionalProperties:false throughout, same discipline as the other schema files — an unexpected
 * field is a producer bug, not something to silently accept.
 */
(function (root) {
  const T = root && root.SELFHEAL_TAXONOMIES;
  if (!T) throw new Error('coverage-model.schema.js requires coverage-taxonomies.js loaded first');

  // ---- element registry (one per screen; a small lookup, never a graph library) ----
  const registryEntrySchema = {
    type: 'object',
    required: ['symbol', 'type'],
    properties: {
      symbol: { type: 'string', minLength: 1 },              // e.g. "book_button" — what steps/expectations reference
      type: { type: 'string', enum: T.ELEMENT_TYPE },
      role: { type: ['string', 'null'] },
      name_hint: { type: ['string', 'null'] },
      match: { type: ['string', 'null'] },                    // TUI/regex or list-under selector; null for DOM elements
      hidden: { type: ['boolean', 'null'] }
    },
    additionalProperties: false
  };

  const elementRegistrySchema = {
    $id: 'coverage-element-registry/v1',
    type: 'object',
    required: ['screen', 'elements'],
    properties: {
      screen: { type: 'string', minLength: 1 },
      elements: { type: 'array', minItems: 1, items: registryEntrySchema }
    },
    additionalProperties: false
  };

  // ---- screen-transition graph edge ----
  const transitionEdgeSchema = {
    $id: 'coverage-transition-edge/v1',
    type: 'object',
    required: ['from', 'action', 'to'],
    properties: {
      from: { type: 'string', minLength: 1 },
      action: { type: 'string', enum: T.ACTION },
      to: { type: 'string', minLength: 1 },
      condition: { type: ['string', 'null'] }
    },
    additionalProperties: false
  };

  // ---- service-dependency graph edge (customer-supplied for real apps; schema ships either way) ----
  const serviceEdgeSchema = {
    $id: 'coverage-service-edge/v1',
    type: 'object',
    required: ['from_service', 'to_service', 'tag'],
    properties: {
      from_service: { type: 'string', minLength: 1 },
      to_service: { type: 'string', minLength: 1 },
      tag: { type: 'string', enum: T.SERVICE_TAG }
    },
    additionalProperties: false
  };

  // ---- spec statement (an acceptance-criterion unit, with a source citation) ----
  const statementSchema = {
    $id: 'coverage-statement/v1',
    type: 'object',
    required: ['id', 'text', 'source', 'screens'],
    properties: {
      id: { type: 'string', pattern: '^[A-Za-z][A-Za-z0-9_-]{0,63}$' },   // e.g. "S-4"
      text: { type: 'string', minLength: 1 },
      source: { type: 'string', minLength: 1 },                          // e.g. "BRD §4.1 line 62" — no statement without one
      screens: { type: 'array', minItems: 1, items: { type: 'string', minLength: 1 } },
      criticality: { type: ['string', 'null'], enum: T.SERVICE_TAG.concat([null]) }
    },
    additionalProperties: false
  };

  // ---- coverage-grid cell — a covered cell needs nothing else; an uncovered one MUST name a gap_type
  // (mirrors test-plan.schema.js's action-discriminated oneOf — no silent gaps, same rule as the healer)
  const cellSchema = {
    $id: 'coverage-cell/v1',
    type: 'object',
    required: ['statement_id', 'covered'],
    properties: {
      statement_id: { type: 'string', minLength: 1 },
      platform: { type: ['string', 'null'], enum: T.PLATFORM.concat([null]) },
      locale: { type: ['string', 'null'], enum: T.LOCALE.concat([null]) },
      network: { type: ['string', 'null'], enum: T.NETWORK_CONDITION.concat([null]) },
      authState: { type: ['string', 'null'], enum: T.AUTH_STATE.concat([null]) },
      data_class: { type: ['string', 'null'], enum: T.DATA_CLASS.concat([null]) },
      screen_state: { type: ['string', 'null'], enum: T.SCREEN_STATE.concat([null]) },
      covered: { type: 'boolean' },
      gap_type: { type: ['string', 'null'], enum: T.GAP_TYPE.concat([null]) }
    },
    additionalProperties: false,
    oneOf: [
      { properties: { covered: { const: true } } },
      // `required` alone only checks key presence — gap_type:null would slip through as "present".
      // Re-typing it non-nullable here closes that: an explicit null is rejected, not just an omission.
      { properties: { covered: { const: false }, gap_type: { type: 'string', enum: T.GAP_TYPE } }, required: ['gap_type'] }
    ]
  };

  // ---- named refusal — a deliverable, never a silent skip ----
  const refusalSchema = {
    $id: 'coverage-refusal/v1',
    type: 'object',
    required: ['id', 'reason', 'note'],
    properties: {
      id: { type: 'string', pattern: '^[A-Za-z][A-Za-z0-9_-]{0,63}$' },
      reason: { type: 'string', enum: T.REFUSE_REASON },
      statement_id: { type: ['string', 'null'] },
      note: { type: 'string', minLength: 1 }                             // the human-legible "why", always required
    },
    additionalProperties: false
  };

  // ---- test step — condition/action/expectation (WebTestPilot Step shape, attributed in the doc) ----
  const stepSchema = {
    type: 'object',
    required: ['action'],
    properties: {
      id: { type: ['string', 'null'] },
      condition: { type: ['string', 'null'] },                          // pre-condition, plain text
      action: { type: 'string', enum: T.ACTION },
      target: { type: ['string', 'null'] },                             // element symbol from the registry
      value: { type: ['string', 'null'] },
      value_class: { type: ['string', 'null'], enum: T.DATA_CLASS.concat([null]) },
      produces: { type: ['string', 'null'] },                           // names a symbol this step's read binds
      consumes: { type: ['array', 'null'], items: { type: 'string' } }, // symbols this step's expectation reads
      expectation: { type: ['string', 'null'] },                        // e.g. "presence(x) AND equals(y, z)"
      note: { type: ['string', 'null'] }
    },
    additionalProperties: false
  };

  // ---- authored test — carries traceability back to the spec line, and the cells it fills ----
  const testSchema = {
    $id: 'coverage-test/v1',
    type: 'object',
    required: ['id', 'goal', 'statement', 'cells_covered', 'screens', 'steps'],
    properties: {
      id: { type: 'string', pattern: '^[A-Za-z][A-Za-z0-9_-]{0,63}$' },
      goal: { type: 'string', minLength: 1 },
      statement: { type: 'string', minLength: 1 },                      // statement id, or "S-4 + S-5" style composite
      cells_covered: { type: 'array', minItems: 1, items: { type: 'string', minLength: 1 } },
      screens: { type: 'array', minItems: 1, items: { type: 'string', minLength: 1 } },
      steps: { type: 'array', minItems: 1, items: stepSchema },
      traceability: {
        type: ['object', 'null'],
        properties: {
          spec_line: { type: 'string' },
          statement: { type: 'string' },
          evidence_bundle: { type: 'string' }
        },
        additionalProperties: false
      }
    },
    additionalProperties: false
  };

  // ---- test goal (RFP's "exploratory charter" — plain name; a product of uncovered cells, not a free idea) ----
  const testGoalSchema = {
    $id: 'coverage-test-goal/v1',
    type: 'object',
    required: ['id', 'focus', 'target_cells', 'capture'],
    properties: {
      id: { type: 'string', pattern: '^[A-Za-z][A-Za-z0-9_-]{0,63}$' },
      focus: { type: 'string', minLength: 1 },
      target_cells: { type: 'array', minItems: 1, items: { type: 'string', minLength: 1 } },
      duration_minutes: { type: ['number', 'null'], minimum: 1 },
      capture: { type: 'array', minItems: 1, items: { type: 'string', minLength: 1 } }
    },
    additionalProperties: false
  };

  const API = {
    ELEMENT_REGISTRY: elementRegistrySchema,
    REGISTRY_ENTRY: registryEntrySchema,
    TRANSITION_EDGE: transitionEdgeSchema,
    SERVICE_EDGE: serviceEdgeSchema,
    STATEMENT: statementSchema,
    CELL: cellSchema,
    REFUSAL: refusalSchema,
    STEP: stepSchema,
    TEST: testSchema,
    TEST_GOAL: testGoalSchema,
    VERSION: 'coverage-model/v1'
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.SELFHEAL_SCHEMA_COVERAGE = API;
})(typeof window !== 'undefined' ? window : globalThis);
