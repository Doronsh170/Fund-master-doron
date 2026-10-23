(function(root){
'use strict';
const text=x=>String(x??'').trim();
const known=x=>x!==null&&x!==undefined&&x!==''&&!['לא ידוע','לא צוין'].includes(x);
const unique=xs=>[...new Set(xs.filter(x=>x!==null&&x!==undefined&&x!==''))];
function fromLegacy(r){
 const name=text(r['שם הקרן']),feeText=text(r['דמי ניהול']),rating=r['דירוג דיסקונט'];
 return {number:text(r['מספר קרן']),name,manager:text(r['חברה מנהלת']),type:text(r['סוג קרן']),category:text(r['מסלול השקעה']),profile:name.match(/\(([0-6][A-F0-6])\)/i)?.[1]||'לא צוין',currency:r['חשיפה למט״ח']==='מנוטרלת מט״ח'?'מנוטרלת':r['חשיפה למט״ח']==='כן'?'חשופה':'לא ידוע',denomination:text(r['נקובה במט״ח'])||'לא ידוע',fee:/^\d+(?:\.\d+)?%?$/.test(feeText)?Number(feeText.replace('%','')):null,discountRating:known(rating)&&Number.isFinite(Number(rating))?Number(rating):null,note:text(r['הערות']),source:text(r['מקור אימות']),validationStatus:'נקלט מחומר מקור; טרם אומת חיצונית',internalValidationStatus:text(r['סטטוס אימות']),ratingVerification:known(rating)?'דירוג היסטורי לפי חומר שהוזן; יש לאמת עדכניות':''};
}
function fromFlyer(r){return {...r,number:text(r.number),type:r.type||(/(?:^|\s)סל(?:\s|$)/.test(r.name)?'קרן סל':/מחקה/.test(r.name)?'קרן מחקה':''),denomination:/נקוב.*(?:דולר|\$)/.test(r.name)?'כן':'לא ידוע',fee:typeof r.fee==='number'&&Number.isFinite(r.fee)?r.fee:null,discountRating:typeof r.discountRating==='number'&&Number.isFinite(r.discountRating)?r.discountRating:null};}
function fromExchange(raw){
 const name=text(raw['שם הקרן']),number=text(raw["מס' קרן"]);
 const top=text(raw['סיווג הקרן כותרת על']),main=text(raw['סיווג הקרן כותרת ראשית']),sub=text(raw['סיווג הקרן כותרת משנית']);
 const fx=text(raw['פרופיל חשיפה מט"ח']),equity=text(raw['פרופיל חשיפה מניות']);
 const denominator=/נקוב.*(?:דולר|\$)/.test(name)?'כן':'לא ידוע';
 const currency=/מנוטרל/.test([name,main,sub].join(' '))?'מנוטרלת':denominator==='כן'?'דולר':equity==='0'&&fx==='0'?'שקל':'לא ידוע';
 const originalManager=text(raw['מנהל קרן']);
 const manager=({'איביאי קרנות נאמנות':'אי.בי.אי.','מיטב קרנות נאמנות':'מיטב','מור קרנות':'מור','אלטשולר-שחם קרנות':'אלטשולר שחם'})[originalManager]||originalManager;
 const type=raw['סוג הקרן']==='קרן פתוחה'?'קרן נאמנות':text(raw['סוג הקרן']);
 const searchTerms=unique([originalManager,top,main,sub,text(raw['נכס ייחוס']),text(raw['מאפייני הקרן'])]);
 return {number,name,manager,type,category:top||main||'לא ידוע',profile:equity+fx,currency,denomination:denominator,
  fee:typeof raw['דמי ניהול']==='number'?raw['דמי ניהול']:null,trusteeFee:typeof raw['דמי נאמנות']==='number'?raw['דמי נאמנות']:null,
  note:text(raw['מאפייני הקרן']),discountRating:null,source:'קובץ הבורסה funds.xlsx',validationStatus:'נתוני קובץ הבורסה',
  exchangeDate:text(raw['תאריך נכונות']),exchangeRecord:raw,importedFromExchange:true,searchTerms,
  aliases:unique([name,...searchTerms]),conflicts:[],provenance:[{source:'exchange',record:raw}]};
}
function build(sources,exchange=null){
 const map=new Map(),inputs=[...sources.legacy.map(raw=>({raw,source:'legacy',row:fromLegacy(raw)})),...sources.flyers.map(raw=>({raw,source:'flyers',row:fromFlyer(raw)}))];
 for(const input of inputs){const f=input.row;if(!/^\d{7}$/.test(f.number))throw Error('Invalid fund number: '+f.number);if(!map.has(f.number))map.set(f.number,[]);map.get(f.number).push(input);}
 const rows=[];
 for(const records of map.values()){
  const legacy=records.find(r=>r.source==='legacy')?.row,flyer=records.find(r=>r.source==='flyers')?.row,first=legacy||flyer;
  const row={...first,aliases:unique(records.flatMap(r=>[r.row.name,r.row.manager,r.row.category])),provenance:records.map(r=>({source:r.source,record:r.raw})),conflicts:[]};
  for(const field of ['fee','discountRating','profile','type','denomination']){
   const values=unique(records.map(r=>r.row[field]).filter(known));
   if(values.length>1){row.conflicts.push({field,values,sources:records.filter(r=>known(r.row[field])).map(r=>({source:r.source,value:r.row[field]}))});row[field]=['fee','discountRating'].includes(field)?null:'לא ידוע';}
   else row[field]=values[0]??(['fee','discountRating'].includes(field)?null:'לא ידוע');
  }
  row.name=legacy?.name||flyer?.name;row.manager=legacy?.manager||flyer?.manager;row.category=flyer?.category||legacy?.category;
  const distinct=unique(records.map(r=>r.row.currency).filter(known));
  if(distinct.includes('מנוטרלת')&&distinct.some(c=>['חשופה','דולר'].includes(c))){row.currency='לא ידוע';row.conflicts.push({field:'currency',values:distinct});}
  else row.currency=known(flyer?.currency)?flyer.currency:known(legacy?.currency)?legacy.currency:'לא ידוע';
  row.source=unique(records.map(r=>r.row.source)).join(' | ');row.note=unique(records.map(r=>r.row.note)).join('\n');
  if(flyer)for(const field of ['validationStatus','validationUrl','validationFields','ratingSource','ratingVerification'])if(known(flyer[field]))row[field]=flyer[field];
  row.validationStatus||='טרם אומת חיצונית';
  if(row.conflicts.length){const labels={fee:'דמי ניהול',discountRating:'דירוג',profile:'פרופיל',type:'סוג הקרן',denomination:'נקיבה במט״ח',currency:'סיווג מטבעי'};row.note+=(row.note?'\n':'')+'הבדל בין המקורות — דורש בדיקה: '+row.conflicts.map(c=>labels[c.field]+': '+c.values.join(' / ')).join('; ')+'.';}
  rows.push(row);
 }
 rows.sort((a,b)=>a.number.localeCompare(b.number));
 const report={inputCount:inputs.length,uniqueCount:rows.length,duplicateCount:inputs.length-rows.length,conflictCount:rows.filter(r=>r.conflicts.length).length};
 if(exchange){
  const existing=new Map(rows.map(row=>[row.number,row]));
  const seen=new Set();let added=0,matched=0;
  for(let i=0;i<exchange.rows.length;i++){
   const values=exchange.rows[i], raw=Object.fromEntries(exchange.columns.map((key,j)=>[key,values[j]]));
   const incoming=fromExchange(raw);
   if(!/^\d{7}$/.test(incoming.number)||seen.has(incoming.number))throw Error('Invalid or duplicate exchange fund: '+incoming.number);
   seen.add(incoming.number);
   if(existing.has(incoming.number)){
    const current=existing.get(incoming.number);
    // Keep the advisor's existing metadata; retain the exchange snapshot separately.
    current.exchangeRecord=raw;current.exchangeDate=incoming.exchangeDate;
    current.aliases=unique([...(current.aliases||[]),incoming.name,incoming.manager,...incoming.searchTerms]);
    current.provenance.push({source:'exchange',record:raw});matched++;
   }else{rows.push(incoming);existing.set(incoming.number,incoming);added++;}
  }
  report.legacyUniqueCount=report.uniqueCount;report.exchangeCount=seen.size;report.exchangeMatchedCount=matched;report.exchangeAddedCount=added;report.retainedOutsideExchangeCount=report.legacyUniqueCount-matched;report.uniqueCount=rows.length;
  rows.sort((a,b)=>a.number.localeCompare(b.number));
 }
 return {rows,report};
}
if(typeof module!=='undefined'&&module.exports)module.exports={build,fromLegacy,fromFlyer,fromExchange};else{const result=build(root.FUND_SOURCES,root.FUND_EXCHANGE);root.FUND_DATA=result.rows;root.FUND_MERGE_REPORT=result.report;}
})(typeof window==='undefined'?globalThis:window);