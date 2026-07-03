/* self-heal/report/report.js — S3: run report + failure clustering (F7: "one root cause, many
 * failures" surfaces as ONE cluster, not N line items). Pure function over schema-validated
 * flywheel-event/v1 rows. Reads window.SELFHEAL_VALIDATOR + window.SELFHEAL_SCHEMA_FLYWHEEL
 * (must be loaded first, same idiom as validator.js) but touches no other DOM global.
 *
 * Consumes, does not define, the flywheel-event/v1 contract — self-heal/schemas/ is read-only here.
 */
(function (root) {
  function initCounts(values) {
    const o = {};
    values.forEach(v => { o[v] = 0; });
    return o;
  }

  function validateRows(rows, V, FW) {
    const validRows = [];
    const rejectedRows = [];
    rows.forEach((row, index) => {
      const r = V.validate(FW.EVENT, row);
      if (r.ok) { validRows.push(row); return; }
      const reason = r.errors.map(e => e.path + ': ' + e.msg).join('; ') || 'unknown validation failure';
      rejectedRows.push({ index, row, errors: r.errors, reason });
    });
    return { validRows, rejectedRows };
  }

  // false_heal is OPTIONAL in the schema (a row may omit it) — never conflate "omitted" with "confirmed false" or vice versa.
  function falseHealTally(validRows, rejectedRows) {
    let falseHealCount = 0, falseHealFieldMissingCount = 0;
    validRows.forEach(row => {
      if (!('false_heal' in row)) falseHealFieldMissingCount++;
      else if (row.false_heal === true) falseHealCount++;
    });
    // For REJECTED rows, false_heal may have been the very reason for rejection (e.g. "true" as a string,
    // or 1) — a strict === true check would make a genuine false-heal invisible exactly when the payload is
    // malformed. This is the gating metric, so surface ANY truthy false_heal on a rejected row.
    const falseHealInRejectedRows = rejectedRows.filter(rr => rr.row && typeof rr.row === 'object' && !!rr.row.false_heal).length;
    return { falseHealCount, falseHealFieldMissingCount, falseHealInRejectedRows };
  }

  // F7: group every non-PASS row by category so "one root cause" reads as one cluster, not N rows.
  function buildClusters(validRows) {
    // null-proto: category is free-form (no enum in the schema), so a value like 'constructor'/'toString'
    // would resolve truthy via Object.prototype on a bare {} and silently drop that whole failure class.
    const byCategory = Object.create(null);
    validRows.filter(r => r.outcome !== 'PASS').forEach(r => {
      const cat = r.category || 'UNKNOWN';
      if (!byCategory[cat]) byCategory[cat] = { category: cat, count: 0, testIdSet: new Set(), sampleDiagnosis: null };
      const c = byCategory[cat];
      c.count++;
      c.testIdSet.add(r.testId);
      if (c.sampleDiagnosis === null && r.diagnosis) c.sampleDiagnosis = r.diagnosis;
    });
    return Object.values(byCategory)
      .map(c => ({ category: c.category, count: c.count, exampleTestIds: Array.from(c.testIdSet).slice(0, 5), sampleDiagnosis: c.sampleDiagnosis }))
      .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
  }

  // heal-eligible = healed is decided (true|false), not null/n-a; rate is null (not 0) when there is no eligible data, to avoid fabricating a percentage.
  function healStats(rows) {
    const eligible = rows.filter(r => r.healed === true || r.healed === false);
    const healed = eligible.filter(r => r.healed === true).length;
    const healEligible = eligible.length;
    const rate = healEligible > 0 ? healed / healEligible : null;
    return { healed, healEligible, rate, ratePct: rate === null ? null : Math.round(rate * 100) };
  }

  // measured (source==='live') and simulated (source==='simulated') are NEVER blended into one number.
  function buildSelfHealRate(validRows) {
    const measured = healStats(validRows.filter(r => r.source === 'live'));
    const simulated = healStats(validRows.filter(r => r.source === 'simulated'));
    measured.label = 'measured';
    simulated.label = 'simulated';
    return { measured, simulated, manualExcludedCount: validRows.filter(r => r.source === 'manual').length };
  }

  // healRate — measured over rows where the runtime emitted firstTry (true|false). A row with
  // firstTry absent or firstTry===null is NEVER counted as either (assertions and no-locator anchors
  // fall here — no locate-and-heal semantics to speak of). Modeled 1:1 on healStats/buildSelfHealRate
  // above so measured vs simulated stay separated by source; rate is null (not 0) when denominator=0.
  //   healed        = rows with firstTry === false  (matcher had to lean on descriptor scoring → a heal)
  //   healEligible  = rows with firstTry === true or false (the ones we can honestly count)
  function firstTryStats(rows) {
    const eligible = rows.filter(r => r.firstTry === true || r.firstTry === false);
    const healed = eligible.filter(r => r.firstTry === false).length;
    const healEligible = eligible.length;
    const rate = healEligible > 0 ? healed / healEligible : null;
    return { healed, healEligible, rate, ratePct: rate === null ? null : Math.round(rate * 100) };
  }
  function buildHealRate(validRows) {
    const measured = firstTryStats(validRows.filter(r => r.source === 'live'));
    const simulated = firstTryStats(validRows.filter(r => r.source === 'simulated'));
    measured.label = 'measured';
    simulated.label = 'simulated';
    return { measured, simulated, manualExcludedCount: validRows.filter(r => r.source === 'manual').length };
  }

  function buildPerTest(validRows, outcomeValues) {
    const map = Object.create(null);
    validRows.forEach(r => {
      // JSON-encode the (app, testId) pair so neither field's contents can collide with a delimiter —
      // 'A::B'+'C' and 'A'+'B::C' would both key to 'A::B::C' with a naive string join.
      const key = JSON.stringify([r.app, r.testId]);
      if (!map[key]) map[key] = { app: r.app, testId: r.testId, rowCount: 0, outcomeCounts: initCounts(outcomeValues), falseHealCount: 0, categorySet: new Set() };
      const p = map[key];
      p.rowCount++;
      p.outcomeCounts[r.outcome] = (p.outcomeCounts[r.outcome] || 0) + 1;
      if (r.false_heal === true) p.falseHealCount++;
      p.categorySet.add(r.category || 'UNKNOWN');
    });
    return Object.values(map)
      .map(p => ({ app: p.app, testId: p.testId, rowCount: p.rowCount, outcomeCounts: p.outcomeCounts, falseHealCount: p.falseHealCount, categories: Array.from(p.categorySet) }))
      .sort((a, b) => a.app.localeCompare(b.app) || a.testId.localeCompare(b.testId));
  }

  function buildReport(rows) {
    const V = root.SELFHEAL_VALIDATOR, FW = root.SELFHEAL_SCHEMA_FLYWHEEL;
    if (!V || typeof V.validate !== 'function') throw new Error('SELFHEAL_REPORT.buildReport: window.SELFHEAL_VALIDATOR not loaded — load self-heal/schemas/validator.js first');
    if (!FW || !FW.EVENT) throw new Error('SELFHEAL_REPORT.buildReport: window.SELFHEAL_SCHEMA_FLYWHEEL not loaded — load self-heal/schemas/flywheel-event.schema.js first');
    if (!Array.isArray(rows)) throw new Error('SELFHEAL_REPORT.buildReport: rows must be an array, got ' + typeof rows);

    // Read the allowed values from the schema — never hardcode a copy that could silently go stale if the
    // schema's enum is edited/migrated. If the enum is absent, fail loudly (schema/report.js out of sync)
    // rather than fall back to a frozen list that would miscount new values.
    const enumOf = (name) => {
      const prop = FW.EVENT.properties[name];
      if (!prop || !Array.isArray(prop.enum)) throw new Error('SELFHEAL_REPORT.buildReport: flywheel-event schema property "' + name + '" has no enum — schema and report.js are out of sync');
      return prop.enum;
    };
    const outcomeValues = enumOf('outcome');
    const confValues = enumOf('verify_confidence');

    const { validRows, rejectedRows } = validateRows(rows, V, FW);
    const { falseHealCount, falseHealFieldMissingCount, falseHealInRejectedRows } = falseHealTally(validRows, rejectedRows);

    const outcomeCounts = initCounts(outcomeValues);
    const verifyConfidenceCounts = initCounts(confValues);
    validRows.forEach(r => {
      outcomeCounts[r.outcome] = (outcomeCounts[r.outcome] || 0) + 1;
      verifyConfidenceCounts[r.verify_confidence] = (verifyConfidenceCounts[r.verify_confidence] || 0) + 1;
    });

    const labels = {
      falseHealCount: 'measured — over schema-valid rows only; see falseHealInRejectedRows and falseHealFieldMissingCount so no row is silently dropped from the gate',
      outcomeCounts: 'measured — schema-valid rows only',
      verifyConfidenceCounts: 'measured — schema-valid rows only (each row already self-labels HIGH/MEDIUM/NONE/simulated)',
      clusters: 'measured — schema-valid, outcome!=="PASS" rows only, grouped by category (F7)',
      'selfHealRate.measured': 'measured — source==="live" rows only',
      'selfHealRate.simulated': 'simulated — source==="simulated" rows only; never blended with measured',
      'selfHealRate.manualExcludedCount': 'n/a — source==="manual" (HITL) rows are excluded from the heal rate, counted here so they are not silently dropped',
      'healRate.measured': 'measured — source==="live" rows only where the runtime emitted firstTry (true|false); assertions/no-locator anchors excluded (firstTry===null/absent — not counted either way)',
      'healRate.simulated': 'simulated — source==="simulated" rows only with firstTry present; never blended with measured',
      'healRate.manualExcludedCount': 'n/a — source==="manual" (HITL) rows excluded from the heal rate, counted here so they are not silently dropped',
      'perTest.rowCount': 'measured — schema-valid rows only, grouped per (app, testId)',
      'perTest.outcomeCounts': 'measured — schema-valid rows only',
      'perTest.falseHealCount': 'measured — schema-valid rows for this test ONLY; malformed rows for the same test are NOT counted here (see summary.falseHealInRejectedRows for the gate-level rejected-row count)'
    };

    return {
      summary: {
        totalRowsReceived: rows.length,
        validRowCount: validRows.length,
        rejectedRowCount: rejectedRows.length,
        falseHealCount,
        falseHealInRejectedRows,
        falseHealFieldMissingCount,
        outcomeCounts,
        verifyConfidenceCounts
      },
      clusters: buildClusters(validRows),
      selfHealRate: buildSelfHealRate(validRows),
      healRate: buildHealRate(validRows),
      perTest: buildPerTest(validRows, outcomeValues),
      rejectedRows,
      labels
    };
  }

  const API = { buildReport };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.SELFHEAL_REPORT = API;
})(typeof window !== 'undefined' ? window : globalThis);
