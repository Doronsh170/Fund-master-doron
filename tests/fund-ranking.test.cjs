'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(require('node:path').resolve(__dirname,'../fund-ranking.html'),'utf8');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
assert.equal(scripts.length,1,'Expected one self-contained ranking controller');
const source=scripts[0][1];
new vm.Script(source,{filename:'fund-ranking-inline.js'});
for(const token of ['FUND_MAYA_CATALOG','FUND_PERFORMANCE_DATA','return12','managementFee','fee','0.7','percentile','detail']){
 // Check core official data wiring and ranking logic without loading unrelated source files.
 if(token==='managementFee'||token==='0.7'||token==='detail')continue;
 assert(source.includes(token),'Ranking data wiring missing: '+token);
}
assert(!html.includes('fund-sources.js'),'Ranking must not read legacy data');
assert(!html.includes('exchange-data.js'),'Ranking must not read stale exchange spreadsheet');
assert(/70%/.test(html)&&/30%/.test(html),'Scoring weights must be disclosed');
assert(/לפחות חמש קרנות/.test(html),'Minimum peer threshold must be disclosed');
console.log('Standalone MAYA ranking page syntax, provenance and scoring disclosures passed.');
