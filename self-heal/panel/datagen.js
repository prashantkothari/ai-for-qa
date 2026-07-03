/* self-heal/panel/datagen.js — P2 T4.3: seeded data fuzzing for authored form-fill steps.
 *
 * Antithesis-style property-fuzzing folded into authoring (per the plan): every `fill` step in a
 * case gets a small, DETERMINISTIC set of variant values (boundary/empty/long/unicode/format-invalid)
 * keyed off a PRNG seed stored ON THE CASE. Same seed -> byte-identical variants, every time — that's
 * what makes "replay by seed" meaningful (a failed variant can be reproduced exactly, not re-rolled).
 *
 * Deliberately NOT a matcher/heal concept: this module never touches selfheal-core.js or the pipeline.
 * It only clones authored OpenTest.ai test objects (testgen.js output) and substitutes one `value`.
 */
(function (root) {
  // mulberry32 — small, fast, deterministic PRNG. Not cryptographic; that's not the point here (we
  // want REPRODUCIBLE fuzz, not secure randomness).
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // deterministic string->uint32 seed (so a caller can seed from a stable case id, not just a number)
  function seedFromString(s) {
    let h = 0; const str = String(s || '');
    for (let i = 0; i < str.length; i++) h = (Math.imul(h, 31) + str.charCodeAt(i)) >>> 0;
    return h >>> 0;
  }

  const UNICODE_SAMPLE = 'Ünïçødé — 用户名 – 🚀 – Ω';
  const LONG_LEN = 300;

  // one deterministic variant set per field TYPE — the seed only perturbs `jitter` (an inspectable,
  // non-load-bearing tag proving the PRNG ran) so "same seed -> identical variants" is trivially true
  // by construction, not by luck.
  function kindsForType(type) {
    const longStr = new Array(LONG_LEN + 1).join('x');
    const base = [
      { kind: 'empty', value: '' },
      { kind: 'boundary', value: type === 'number' || type === 'tel' ? '0' : 'a' },
      { kind: 'long', value: longStr }
    ];
    if (type === 'email') {
      base.push({ kind: 'unicode', value: 'ünïçødé@example.com' });
      base.push({ kind: 'format-invalid', value: 'not-an-email' });
    } else if (type === 'tel') {
      base.push({ kind: 'unicode', value: '＋１２３' });                 // fullwidth digits
      base.push({ kind: 'format-invalid', value: 'abc-not-a-phone' });
    } else {
      base.push({ kind: 'unicode', value: UNICODE_SAMPLE });
      base.push({ kind: 'format-invalid', value: '####/////\\\\' });
    }
    return base;
  }

  // variantsForField({stepId, type}, seed) -> [{kind, value, seed, jitter, id}]
  function variantsForField(field, seed) {
    const rnd = mulberry32(seed);
    const type = field.type || 'text';
    return kindsForType(type).map(k => ({
      kind: k.kind, value: k.value, seed, type,
      jitter: +rnd().toFixed(4),                 // proves determinism (same seed -> same jitter sequence)
      id: (field.stepId || 'f') + ':' + k.kind
    }));
  }

  // infer a rough "type" for value-shaping from a step's captured anchor descriptor (best-effort;
  // falls back to 'text' — the shaping only changes WHICH format-invalid/unicode sample is used).
  function fieldTypeOf(step) {
    const t = (step.target || '') + ' ' + JSON.stringify((step._anchor && step._anchor.target && step._anchor.target.descriptor) || {});
    if (/email/i.test(t)) return 'email';
    if (/phone|tel/i.test(t)) return 'tel';
    return 'text';
  }

  // attachVariants(test, seedBase?) -> test, mutated in place with ._seed and ._variants
  //   ._variants: [{stepTarget, kind, value, seed, jitter, id}] — one entry per (fill step × variant kind)
  function attachVariants(test, seedBase) {
    const seed = (typeof seedBase === 'number') ? (seedBase >>> 0) : seedFromString(test.id);
    test._seed = seed;
    test._variants = [];
    test.steps.filter(s => s.action === 'fill').forEach(s => {
      variantsForField({ stepId: (s._anchor && s._anchor.stepId) || s.target, type: fieldTypeOf(s) }, seed)
        .forEach(v => test._variants.push(Object.assign({ stepTarget: s.target }, v)));
    });
    return test;
  }

  // buildVariantCase(test, variant) -> a deep-cloned test with ONE fill step's value substituted.
  // Deep clone via JSON is safe here: authored test objects (testgen.js) are plain data — descriptors,
  // strings, numbers — never DOM elements or functions, so nothing is lost in the round-trip.
  function buildVariantCase(test, variant) {
    const clone = JSON.parse(JSON.stringify(test));
    clone.id = test.id + '#' + variant.id;
    clone.title = test.title + ' — ' + variant.kind + ' (' + variant.stepTarget + ')';
    clone._variantOf = test.id;
    clone._variantKind = variant.kind;
    clone._seed = variant.seed;
    delete clone._variants;   // a variant case doesn't itself carry the variant list
    const step = clone.steps.find(s => s.action === 'fill' && s.target === variant.stepTarget);
    if (step) step.value = variant.value;
    return clone;
  }

  const API = { mulberry32, seedFromString, variantsForField, attachVariants, buildVariantCase };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.__DATAGEN = API;
})(typeof window !== 'undefined' ? window : globalThis);
