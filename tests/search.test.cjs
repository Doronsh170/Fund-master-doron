const assert = require('node:assert/strict');
const fs = require('node:fs');
const S = require('../search.js');
const f = (name, extra = {}) => ({name, ...extra});
assert(S.match(f('קרן 10/90'), '90\\10').matched);
assert(S.match(f('קרן עד 10% מניות'), '90/10').matched);
assert(!S.match(f('קרן אג״ח + 10%'), '90/10').matched);
assert(S.match(f('קרן NASDAQ 100'), 'נאסדק').matched);
assert(S.match(f('קרן S&P 500'), 'S&P 500').matched);
assert(S.match(f('קרן נקובה $'), 'דולר').matched);
assert(S.match(f('קרן מנוטרלת דולר'), 'דולר').matched);
assert(!S.match(f('קרן זרה', {currency:'חשופה'}), 'דולר').matched);
assert(!S.match(f('קרן לפדיון 2035'), 'מחמ 10').matched);
assert(!S.match(f('אג״ח ממשלה 10+ שנים'), 'מחמ ארוך').matched);
assert(S.match(f('קרן', {durationYears:9.5}), 'מחמ 10').matched);
assert(!S.match(f('קרן', {durationYears:9.5}), 'מחמ בדיוק 10').matched);
assert(S.match(f('קרן', {durationYears:12}), 'מחמ לפחות 10').matched);
assert(S.match(f('קרן', {note:'מח״מ מדד בפרסום: 10.4 שנים.'}), 'מחמ 10').matched);
assert(S.match(f('קרן', {note:'מדיניות מח״מ ארוך'}), 'מחמ ארוך').matched);
assert(S.match(f('קרן לפדיון 2035'), 'לפדיון').matched);
assert(S.match(f('קרן', {note:'מסלול לפדיון 2030'}), 'לפדיון').matched);
assert(S.match(f('אנליסט מדינה', {manager:'אנליסט'}), 'אנליסט מדינה').matched);
assert(!S.match(f('קרן', {durationYears:''}), 'מחמ 0').matched);
for (const path of ['index.html','flyers/index.html']) {
  const html=fs.readFileSync(require('node:path').join(__dirname,'..',path),'utf8');
  const rows=JSON.parse(html.match(path==='index.html'?/const DATA = (\[[\s\S]*?\]);/:/const funds=(\[[\s\S]*?\]);/)[1]);
  for (const q of ['דולר','לפדיון','90\\10','מחמ ארוך','מחמ 10','אנליסט','NASDAQ','S&P 500']) {
    const n=rows.filter(r=>S.match(r,q).matched).length;
    console.log(path,q,n);
  }
  assert.equal(rows.length,path==='index.html'?206:121);
}
console.log('Search behavior checks passed');