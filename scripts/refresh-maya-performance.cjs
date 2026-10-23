'use strict';
const fs=require('node:fs'),path=require('node:path');
const base=path.resolve(__dirname,'..');
const {build}=require('../fund-catalog.js');
const funds=build(require('../fund-sources.js'),require('../exchange-data.js')).rows;
const checkpoint=path.resolve(base,'../maya-performance-checkpoint.json');
const resume=process.argv.includes('--resume');
const results=resume&&fs.existsSync(checkpoint)?JSON.parse(fs.readFileSync(checkpoint,'utf8')):{};
const oldFile=path.join(base,'maya-performance-data.js');
const previous=fs.existsSync(oldFile)?require(oldFile).funds||{}:{};
let cursor=0,done=Object.keys(results).length;
const pending=funds.filter(f=>!results[f.number]);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const finite=x=>typeof x==='number'&&Number.isFinite(x)?x:null;
function kindFor(f){if(/גידור/.test(f.type)||/גידור/.test(f.name))return 'hedge';if(['קרן סל','קרן הייטק'].includes(f.type))return 'etf';return 'mutual';}
async function collect(f){
 const kind=kindFor(f),endpoint='https://maya.tase.co.il/api/v1/funds/'+kind+'/'+f.number;
 for(let attempt=0;attempt<3;attempt++){
  try{
   const response=await fetch(endpoint,{signal:AbortSignal.timeout(18000)});
   if(response.status===429||response.status>=500){await wait(3000*(attempt+1));continue;}
   if(response.status!==200)return {number:f.number,status:response.status===404?'not-found':'request-failed',httpStatus:response.status,sourceApi:endpoint,fetchedAt:new Date().toISOString()};
   const data=await response.json();if(String(data.fundId)!==f.number)throw Error('Fund number mismatch');
   const y=data.yields;
   const rawRows=y?[
    {period:'יום קודם',fund:finite(y.dayYield),classification:finite(y.dayYieldAvg),remark:y.dayYieldRemarkType},
    {period:'מתחילת החודש',fund:finite(y.monthYield),classification:finite(y.monthYieldAvg),remark:y.monthYieldRemarkType},
    {period:'מתחילת השנה',fund:finite(y.yearYield),classification:finite(y.yearYieldAvg),remark:y.yearYieldRemarkType},
    {period:'12 חודשים*',fund:finite(y.last12MonthYield),classification:finite(y.last12MonthYieldAvg),remark:y.last12MonthYieldRemarkType}
   ]:[];
   // Empty hedge records contain all-null fund returns and default zero averages.
   const meaningful=rawRows.some(r=>r.fund!==null||r.classification!==null&&r.classification!==0);
   return {number:f.number,status:meaningful?'available':'not-provided',asOf:y?.dueDate||data.ratesAsOf||null,source:'https://maya.tase.co.il/he/funds/'+(kind==='hedge'?'hedge-funds/':'mutual-funds/')+f.number,sourceApi:endpoint,name:data.name,classification:data.classification||null,deleted:data.deleted===true,rows:meaningful?rawRows:[],fetchedAt:new Date().toISOString()};
  }catch(error){if(attempt===2)return {number:f.number,status:'request-failed',error:error.message,sourceApi:endpoint,fetchedAt:new Date().toISOString()};await wait(1000*(attempt+1));}
 }
 return {number:f.number,status:'request-failed',sourceApi:endpoint,fetchedAt:new Date().toISOString()};
}
function save(){fs.writeFileSync(checkpoint,JSON.stringify(results));}
async function worker(){while(cursor<pending.length){const f=pending[cursor++];results[f.number]=await collect(f);done++;if(done%50===0){save();console.log(JSON.stringify({done,total:funds.length,available:Object.values(results).filter(x=>x.status==='available').length}));}await wait(300);}}
(async()=>{console.log('Collecting MAYA data for '+funds.length+' funds; remaining '+pending.length);await Promise.all([worker(),worker(),worker()]);save();let failures=0;
for(const [id,value] of Object.entries(results))if(value.status==='request-failed'){
 failures++;
 if(previous[id]?.status==='available')results[id]={...previous[id],refreshWarning:true,lastAttemptAt:value.fetchedAt};
}
if(failures>Math.max(10,Math.ceil(funds.length*0.03)))throw Error('Too many source request failures; existing published data was not replaced: '+failures);
if(Object.keys(results).length!==funds.length)throw Error('Incomplete collection; existing published data was not replaced');
const report={requestFailures:failures,total:funds.length,generatedAt:new Date().toISOString(),counts:{}};for(const v of Object.values(results))report.counts[v.status]=(report.counts[v.status]||0)+1;const payload={report,funds:results};require('./write-maya-performance.cjs').writePerformanceData(payload,base);fs.writeFileSync(path.resolve(base,'../maya-performance-report.json'),JSON.stringify(report,null,2));console.log('COMPLETE '+JSON.stringify(report));})().catch(error=>{save();console.error(error);process.exitCode=1;});