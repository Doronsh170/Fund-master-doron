const assert=require('node:assert/strict'),S=require('../search.js'),{rows}=require('../fund-catalog.js').build(require('../fund-sources.js'),require('../exchange-data.js'));
const expected=rows.filter(x=>S.match(x,'אגח חול').matched&&[4,5].includes(x.discountRating));assert(expected.length>0);
for(const query of ['אגח חול דירוג 4,5','אג״ח חו״ל דירוג דיסקונט 4 ו5','אגח חול דירוג 4 או 5'])assert.deepEqual(rows.filter(x=>S.match(x,query).matched).map(x=>x.number),expected.map(x=>x.number));
for(const discountRating of [null,undefined,3])assert(!S.match({name:'אגח חול',discountRating},'אגח חול דירוג 4,5').matched);
assert(S.match({name:'אגח חול',discountRating:4},'אגח חול דירוג 4').matched);assert(!S.match({name:'אגח חול',discountRating:5},'אגח חול דירוג 4').matched);
console.log('Combined category/rating search and missing rating exclusions passed.');
