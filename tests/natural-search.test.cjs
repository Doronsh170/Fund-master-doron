const assert=require('node:assert/strict'),S=require('../search.js'),{rows}=require('../fund-catalog.js').build(require('../fund-sources.js'),require('../exchange-data.js'));S.setCatalog(rows);
for(const [q,expected] of [
 ['הראל אגח חול דירוג 4 או 5',x=>x.manager==='הראל'&&S.match(x,'אגח חול').matched&&[4,5].includes(x.discountRating)],
 ['כספית דמי ניהול עד 0.2',x=>S.match(x,'כספית').matched&&Number.isFinite(x.fee)&&x.fee<=.2],
 ['90/10 של מגדל',x=>x.manager==='מגדל'&&S.match(x,'90/10').matched],
 ['מחמ ארוך מנוטרלת מטח',x=>x.currency==='מנוטרלת'&&S.match(x,'מחמ ארוך').matched]
])assert.deepEqual(rows.filter(x=>S.match(x,q).matched).map(x=>x.number),rows.filter(expected).map(x=>x.number),q);
const r={name:'קרן כספית מח״מ 10',manager:'הראל',category:'כספית',currency:'מנוטרלת',fee:.2,discountRating:5};
assert(S.match(r,'אני מחפש קרן של הראל כספית דמי ניהול עד 0.2 דירוג 5').matched);
for(const field of ['fee','discountRating','currency']){const q=field==='fee'?'כספית דמי ניהול עד 0.2':field==='discountRating'?'כספית דירוג 5':'כספית מנוטרלת מטח';assert(!S.match({...r,[field]:null},q).matched);}
assert(!S.match({name:'קרן 2030',fee:0},'מחמ 10').matched);
assert(!S.match(r,'כספית דמי ניהול פחות מ 0.2').matched);assert(S.match({...r,fee:0},'כספית ללא דמי ניהול').matched);
assert(!S.match(r,'כספית תשואה מעל 5').matched);assert(!S.match(r,'כספית לא מנוטרלת מטח').matched);assert(!S.match(r,'כספית תנאי-לא-קיים').matched);
assert(S.describe('הראל כספית דמי ניהול עד 0.2 דירוג 4,5').includes('דירוג דיסקונט: 4 או 5'));
console.log('Natural query combinations, strict missing fields, fee comparisons, unsupported conditions and interpretation passed.');
