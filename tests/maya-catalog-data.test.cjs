'use strict';
const assert=require('node:assert/strict');
const records=require('../maya-performance-data.js').funds;
const catalog=require('../maya-catalog-data.js');
assert.equal(catalog.source,'MAYA');
assert(Array.isArray(catalog.funds)&&catalog.funds.length>1500,'Missing official MAYA catalog records');
const unique=new Set();
for(const row of catalog.funds){
 assert(!unique.has(row.number),'Duplicate fund '+row.number);unique.add(row.number);
 const record=records[row.number],meta=record?.sourceSnapshot?.metadata;
 assert(meta,'Missing original MAYA source metadata '+row.number);
 assert.equal(String(record.sourceSnapshot.fundId),row.number);
 assert.equal(row.name,meta.longName||meta.name);
 assert.equal(row.manager,meta.managerName.trim());
 assert.equal(row.fee,meta.managementFee);
 assert.equal(row.trusteeFee,meta.trusteeFee);
 assert.equal(row.type,meta.fundType||'לא ידוע');
 assert.equal(row.category,meta.classification?.major||meta.classification?.main||'לא ידוע');
 assert.equal(row.sourceApi,record.sourceApi);
 assert.equal(row.provenance.length,1);
 assert.equal(row.provenance[0].source,'MAYA');
}
const expected=Object.values(records).filter(r=>r.status!=='not-found'&&r.metadata?.deleted!==true&&typeof r.metadata?.name==='string'&&r.metadata.name.trim()&&typeof r.metadata?.managerName==='string'&&r.metadata.managerName.trim());
assert.equal(catalog.funds.length,expected.length,'MAYA funds omitted from official catalog');
const zero=catalog.funds.filter(f=>f.fee===0);
assert(zero.every(f=>f.fee===0),'0% fee results contain nonzero values');
console.log('MAYA-only catalog verified:',catalog.funds.length,'funds,',zero.length,'zero-management-fee funds');
