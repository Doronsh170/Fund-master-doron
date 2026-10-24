const assert=require('node:assert/strict'),S=require('../search.js'),{rows}=require('../fund-catalog.js').build(require('../fund-sources.js'),require('../exchange-data.js'));S.setCatalog(rows);const ids=q=>rows.filter(x=>S.match(x,q).matched).map(x=>x.number).sort();
assert(ids('קרנות מעורבות').length>0);assert(ids('קרנות מעורבות').length<rows.length);assert(!S.match({name:'קרן רגילה',category:'אגח'},'מעורבות').matched);
assert.deepEqual(ids('90\\10 עד דמי ניהול 0.6'),ids('90/10 דמי ניהול עד 0.6'));assert.deepEqual(ids('70/30'),ids('30/70'));
for(const q of ['הראל אגח חול דירוג 4,5 דמי ניהול עד 0.6','קרנות מעורבות','90/10 עד דמי ניהול 0.6','מחמ ארוך מנוטרלת מטח']){const reconstructed=S.conditions(q).map(x=>x.query).join(' ');assert.deepEqual(ids(q),ids(reconstructed),q);}
console.log('Mixed classification, fee word order, ratios and condition serialization passed.');
