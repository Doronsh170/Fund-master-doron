'use strict';
const fs=require('node:fs'),path=require('node:path');
const base=path.resolve(__dirname,'..');
const {discover}=require('./discover-maya-funds.cjs');
const {validateSourceCollection}=require('./validate-maya-source.cjs');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const finite=x=>typeof x==='number'&&Number.isFinite(x)?x:null;
function officialMetadata(data){
 return {name:data.name??null,longName:data.longName??null,managerName:data.managerName??null,
  fundType:data.fundType??null,managementFee:finite(data.managementFee),
  trusteeFee:finite(data.trusteeFee),exposureProfile:data.exposureProfile??null,
  classification:data.classification??null,features:data.features??null,deleted:false};
}
function periodRows(y){
 return y?[
  {period:'יום קודם',fund:finite(y.dayYield),classification:finite(y.dayYieldAvg),remark:y.dayYieldRemarkType},
  {period:'מתחילת החודש',fund:finite(y.monthYield),classification:finite(y.monthYieldAvg),remark:y.monthYieldRemarkType},
  {period:'מתחילת השנה',fund:finite(y.yearYield),classification:finite(y.yearYieldAvg),remark:y.yearYieldRemarkType},
  {period:'12 חודשים*',fund:finite(y.last12MonthYield),classification:finite(y.last12MonthYieldAvg),remark:y.last12MonthYieldRemarkType}
 ]:[];
}
async function collect(f){
 const kinds=[f.kind,...['mutual','etf','hedge'].filter(kind=>kind!==f.kind)];
 let data=null,sourceApi=null,allNotFound=true;
 for(const kind of kinds){
  const endpoint='https://maya.tase.co.il/api/v1/funds/'+kind+'/'+f.number;
  for(let retry=0;retry<3;retry++){
   try{
    const response=await fetch(endpoint,{signal:AbortSignal.timeout(18000)});
    if(response.status===404)break;
    if(!response.ok){allNotFound=false;throw Error('Official MAYA detail HTTP '+response.status);}
    const detail=await response.json();
    if(String(detail.fundId)!==f.number)throw Error('Official MAYA fund number mismatch');
    data=detail;sourceApi=endpoint;break;
   }catch(error){
    if(retry===2)throw Error('Official MAYA detail '+f.number+': '+error.message);
    await wait(1100*(retry+1));
   }
  }
  if(data)break;
 }
 const y=data?.yields??null;
 const rows=periodRows(y);
 const meaningful=rows.some(row=>row.fund!==null||row.classification!==null&&row.classification!==0);
 const m=officialMetadata(f.official);
 const ratesAsOf=data?.ratesAsOf||f.official.ratesAsOf||null;
 if(!data&&!allNotFound)throw Error('Incomplete MAYA detail lookup: '+f.number);
 return {number:f.number,status:meaningful?'available':'not-provided',asOf:y?.dueDate||ratesAsOf,
  source:'https://maya.tase.co.il/he/funds/'+(f.kind==='hedge'?'hedge-funds/':'mutual-funds/')+f.number,
  sourceApi:sourceApi||'https://maya.tase.co.il/api/v1/funds/'+f.kind+'/'+f.number,
  name:m.name,classification:m.classification,deleted:false,
  rows:meaningful?rows:[],metadata:m,
  sourceSnapshot:{fundId:f.official.fundId,yields:y,ratesAsOf,metadata:m},
  detailUnavailable:!data,
  fetchedAt:new Date().toISOString()};
}
(async()=>{
 const {funds,listCount,listEndpoint}=await discover();
 // Every scheduled run rediscovers the authoritative fund universe.
 // A deleted fund disappears only if omitted from the authoritative official list.
 const results={},errors=[];let cursor=0,done=0;
 async function worker(){
  while(cursor<funds.length){
   const f=funds[cursor++];
   try{results[f.number]=await collect(f)}
   catch(error){errors.push(error.message);console.error(error.message)}
   done++;
   if(done%100===0)console.log(JSON.stringify({done,total:listCount,errors:errors.length}));
   await wait(300);
  }
 }
 await Promise.all([worker(),worker(),worker()]);
 if(errors.length)throw Error('Refusing publication: '+errors.length+' official MAYA detail requests failed. First: '+errors[0]);
 validateSourceCollection(JSON.parse(JSON.stringify(results)),listCount);
 const report={requestFailures:0,sourceVerified:true,total:listCount,listCount,listEndpoint,generatedAt:new Date().toISOString(),counts:{},detailUnavailable:0};
 for(const r of Object.values(results)){
  report.counts[r.status]=(report.counts[r.status]||0)+1;
  if(r.detailUnavailable)report.detailUnavailable++;
 }
 const payload={report,funds:results};
 require('./write-maya-performance.cjs').writePerformanceData(payload,base);
 fs.writeFileSync(path.resolve(base,'../maya-performance-report.json'),JSON.stringify(report,null,2));
 console.log('COMPLETE '+JSON.stringify(report));
})().catch(error=>{console.error(error);process.exitCode=1});
