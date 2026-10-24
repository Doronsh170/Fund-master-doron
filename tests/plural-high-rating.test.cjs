const assert=require('node:assert/strict'),S=require('../search.js'),{rows}=require('../fund-catalog.js').build(require('../fund-sources.js'),require('../exchange-data.js'));S.setCatalog(rows);const ids=q=>rows.filter(x=>S.match(x,q).matched).map(x=>x.number);
assert(ids('קרן כספית דמי ניהול עד 0.1').length>0);assert.deepEqual(ids('קרנות כספיות דמי ניהול עד 0.1'),ids('קרן כספית דמי ניהול עד 0.1'));
assert.deepEqual(ids('דירוג גבוה'),rows.filter(x=>[3,4,5].includes(x.discountRating)).map(x=>x.number));assert.deepEqual(ids('אגח חול דירוג גבוה'),ids('אגח חול דירוג 3,4,5'));
for(const discountRating of [null,undefined,1,2])assert(!S.match({name:'קרן',discountRating},'דירוג גבוה').matched);
console.log('Plural equivalence and explicit high-rating definition passed.');
