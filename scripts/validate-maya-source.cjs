'use strict';
const assert = require('node:assert/strict');
const periods = [
  ['יום קודם', 'dayYield', 'dayYieldAvg', 'dayYieldRemarkType'],
  ['מתחילת החודש', 'monthYield', 'monthYieldAvg', 'monthYieldRemarkType'],
  ['מתחילת השנה', 'yearYield', 'yearYieldAvg', 'yearYieldRemarkType'],
  ['12 חודשים*', 'last12MonthYield', 'last12MonthYieldAvg', 'last12MonthYieldRemarkType']
];
function validateSourceRecord(record) {
  assert(!record.refreshWarning && !record.returnMethod, 'Previous or calculated returns must not be published');
  assert.notEqual(record.status, 'request-failed', 'Every source request must succeed');
  if (record.status === 'not-found') {
    assert.equal(record.httpStatus, 404);
    assert(!record.rows?.length);
    return;
  }
  const source = record.sourceSnapshot;
  assert(source, 'Missing official source snapshot for ' + record.number);
  assert.equal(String(source.fundId), record.number);
  const yields = source.yields;
  assert(yields === null || (typeof yields === 'object' && !Array.isArray(yields)), 'Unexpected yields schema');
  const rows = yields ? periods.map(([period, fund, classification, remark]) => {
    for (const field of [fund, classification]) {
      const value = yields[field];
      assert(value == null || (typeof value === 'number' && Number.isFinite(value)), 'Unexpected source value: ' + field);
    }
    return {period, fund: yields[fund] ?? null, classification: yields[classification] ?? null, remark: yields[remark]};
  }) : [];
  const meaningful = rows.some(row => row.fund !== null || (row.classification !== null && row.classification !== 0));
  assert.equal(record.status, meaningful ? 'available' : 'not-provided');
  assert.equal(record.asOf, yields?.dueDate || source.ratesAsOf || null);
  // JSON serialization omits undefined remarks, just as it does in the published files.
  assert.deepEqual(record.rows, JSON.parse(JSON.stringify(meaningful ? rows : [])), 'Published values differ from official source for ' + record.number);
}
function validateSourceCollection(records, expectedTotal) {
  assert.equal(Object.keys(records).length, expectedTotal, 'Incomplete official source collection');
  for (const record of Object.values(records)) validateSourceRecord(record);
}
module.exports = {validateSourceRecord, validateSourceCollection};
