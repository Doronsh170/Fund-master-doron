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
}
module.exports={writePerformanceData,PARTS};