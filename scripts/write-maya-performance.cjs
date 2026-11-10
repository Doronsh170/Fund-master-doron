'use strict';
const fs=require('node:fs'),path=require('node:path');
const PARTS=16;
function writePerformanceData(payload,base){
 const groups=Array.from({length:PARTS},()=>({}));
 for(const [id,record]of Object.entries(payload.funds))groups[Number(id)%PARTS][id]=record;
 const folder=path.join(base,'maya-performance');fs.mkdirSync(folder,{recursive:true});
 const names=groups.map((group,i)=>{const name='part-'+String(i).padStart(2,'0')+'.js';const code='(function(root){const data='+JSON.stringify(group)+';if(typeof module!=="undefined"&&module.exports)module.exports=data;else(root.FUND_PERFORMANCE_PARTS ||= []).push(data);})(typeof window==="undefined"?globalThis:window);';fs.writeFileSync(path.join(folder,name),code);return name;});
 const requires=names.map(name=>'require('+JSON.stringify('./maya-performance/'+name)+')').join(',');
 const code='(function(root){const report='+JSON.stringify(payload.report)+';const funds=typeof module!=="undefined"&&module.exports?Object.assign({},'+requires+'):Object.assign({},...(root.FUND_PERFORMANCE_PARTS||[]));const data={report,funds};if(typeof module!=="undefined"&&module.exports)module.exports=data;else{root.FUND_PERFORMANCE_DATA=data;delete root.FUND_PERFORMANCE_PARTS;}})(typeof window==="undefined"?globalThis:window);';
 fs.writeFileSync(path.join(base,'maya-performance-data.js'),code);
 // The search catalogue is derived exclusively from fields returned by the same MAYA API responses.
 // Do not mix stale spreadsheet, legacy flyers or locally inferred fees into the site.
 const catalog=[];
 for(const [number,record] of Object.entries(payload.funds)){
  const m=record.metadata;
  if(!m||record.status==='not-found'||m.deleted===true)continue;
  if(typeof m.name!=='string'||!m.name.trim()||typeof m.managerName!=='string'||!m.managerName.trim())continue;
  const shares=m.exposureProfile?.shareSymbol??null,fx=m.exposureProfile?.fxSymbol??null;
  const profile=shares!=null&&fx!=null?String(shares)+String(fx):'לא ידוע';
  const classification=m.classification||{};
  const features=Array.isArray(m.features)?m.features.filter(x=>x&&x.enabled===true&&typeof x.title==='string').map(x=>x.title):[];
  catalog.push({number,name:m.longName||m.name,manager:m.managerName.trim(),type:m.fundType||'לא ידוע',
   category:classification.major||classification.main||'לא ידוע',profile,currency:'לא ידוע',
   denomination:'לא ידוע',fee:m.managementFee,trusteeFee:m.trusteeFee,
   note:features.join(' · '),source:record.source,sourceApi:record.sourceApi,
   exchangeDate:record.asOf,sourceDate:record.fetchedAt,aliases:[m.name,m.longName||m.name,classification.main||'',classification.secondary||''],
   searchTerms:[classification.major||'',classification.main||'',classification.secondary||''],
   importedFromExchange:false,conflicts:[],provenance:[{source:'MAYA',fundId:number}]});
 }
 catalog.sort((a,b)=>a.number.localeCompare(b.number));
 const catalogCode='(function(root){const data='+JSON.stringify({generatedAt:payload.report.generatedAt,source:'MAYA',funds:catalog})+';if(typeof module!=="undefined"&&module.exports)module.exports=data;else root.FUND_MAYA_CATALOG=data.funds;})(typeof window==="undefined"?globalThis:window);';
 fs.writeFileSync(path.join(base,'maya-catalog-data.js'),catalogCode);

}
module.exports={writePerformanceData,PARTS};