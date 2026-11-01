'use strict';
const assert = require('node:assert/strict');
const {validateSourceRecord, validateSourceCollection} = require('../scripts/validate-maya-source.cjs');
const source = {fundId: 5100144, yields: {dueDate: '2026-10-30', dayYield: 0.123456789, dayYieldAvg: -1.23456789, monthYield: 0, monthYieldAvg: null, yearYield: -2.123456789, last12MonthYield: null}, ratesAsOf: null};
const record = {number: '5100144', status: 'available', asOf: '2026-10-30', sourceSnapshot: source, rows: [
  {period: 'יום קודם', fund: 0.123456789, classification: -1.23456789},
  {period: 'מתחילת החודש', fund: 0, classification: null},
  {period: 'מתחילת השנה', fund: -2.123456789, classification: null},
  {period: '12 חודשים*', fund: null, classification: null}
]};
validateSourceRecord(record);
for (const change of [
  r => r.rows[0].fund = 0.12,
  r => r.rows[0].classification = -1.23,
  r => r.rows[3].fund = 0,
  r => r.rows.reverse(),
  r => r.asOf = '2026-10-29',
  r => r.sourceSnapshot.fundId = 123,
  r => r.sourceSnapshot.yields.dayYield = '0.123456789',
  r => delete r.sourceSnapshot,
  r => r.refreshWarning = true,
  r => r.returnMethod = 'nav-price-change',
  r => r.status = 'request-failed'
]) {
  const changed = structuredClone(record); change(changed);
  assert.throws(() => validateSourceRecord(changed));
}
assert.throws(() => validateSourceCollection({'5100144': record}, 2));
validateSourceRecord({number: '1', status: 'not-found', httpStatus: 404});
assert.throws(() => validateSourceRecord({number: '1', status: 'not-found', httpStatus: 500}));
validateSourceRecord({number: '1', status: 'not-provided', asOf: null, rows: [], sourceSnapshot: {fundId: '1', yields: null, ratesAsOf: null}});
console.log('Exact source values, precision, zero/null, periods, dates, IDs, schema and fail-closed publication checks passed.');
