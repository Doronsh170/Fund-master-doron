'use strict';
const assert=require('node:assert/strict');
const data=require('../maya-performance-data.js');
const records=data.funds,counts={};
const ids=Object.keys(records);
assert.equal(data.report.sourceVerified,true,'Missing strict official MAYA source verification');
assert.equal(data.report.requestFailures,0,'A source request failed');
assert.equal(data.report.listEndpoint,'https://maya.tase.co.il/api/v1/funds/all','Full official MAYA list is required');
assert.equal(data.report.listCount,ids.length,'Missing or extra official MAYA records');
assert.equal(data.report.total,ids.length,'Wrong official universe count');
assert(ids.length>2000,'Unexpectedly small full MAYA list');
require('../scripts/validate-maya-source.cjs').validateSourceCollection(records,ids.length);
let unavailable=0;
for(const id of ids){
 const r=records[id];assert.equal(r.number,id);
 assert(['available','not-provided'].includes(r.status),'Official listed fund excluded: '+id);
 assert(r.metadata&&typeof r.metadata.name==='string'&&r.metadata.name.trim());
 assert(typeof r.metadata.managerName==='string'&&r.metadata.managerName.trim());
 assert(r.metadata.managementFee===null||Number.isFinite(r.metadata.managementFee));
 assert.deepEqual(r.metadata,r.sourceSnapshot.metadata,'Metadata differs from official source snapshot: '+id);
 assert(!Number.isNaN(Date.parse(r.fetchedAt)));
 counts[r.status]=(counts[r.status]||0)+1;
 if(r.detailUnavailable)unavailable++;
 if(r.status==='available'){
  assert(r.asOf===null||/^\d{4}-\d{2}-\d{2}/.test(r.asOf));
  assert.equal(r.rows.length,4);
  for(const row of r.rows)for(const key of ['fund','classification'])assert(row[key]===null||typeof row[key]==='number'&&Number.isFinite(row[key]));
  assert(r.source.startsWith('https://maya.tase.co.il/'));
 }else assert.equal(r.rows.length,0);
}
assert.deepEqual(data.report.counts,counts);
assert.equal(data.report.detailUnavailable,unavailable);
assert(counts.available>ids.length/2,'Insufficient official performance coverage');
console.log('MAYA full-universe source validation passed:',JSON.stringify(counts),'funds:',ids.length);
