'use strict';
const assert=require('node:assert/strict');
const ENDPOINT='https://maya.tase.co.il/api/v1/funds/all';
const kindOf=r=>(r.fundTypeId===5||r.fundTypeId===3)?'etf':r.fundTypeId===6?'hedge':'mutual';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function discover({fetcher=fetch,pageSize=1000,maxPages=20}={}){
 const all=[],seen=new Set();
 for(let page=1;page<=maxPages;page++){
  let rows,err;
  for(let retry=0;retry<3;retry++){
   try{
    const res=await fetcher(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json','Accept-Language':'he-IL',Origin:'https://maya.tase.co.il',Referer:'https://maya.tase.co.il/'},body:JSON.stringify({pageNumber:page,pageSize}),signal:AbortSignal.timeout(45000)});
    if(!res.ok)throw Error('MAYA official list page '+page+' HTTP '+res.status);
    rows=await res.json();
    if(!Array.isArray(rows))throw Error('Unexpected MAYA list schema');
    err=null;break;
   }catch(error){err=error;if(retry<2)await pause(1200*(retry+1));}
  }
  if(err)throw err;
  for(const raw of rows){
   const id=String(raw.fundId??'');
   assert(/^\d{7}$/.test(id),'Missing official MAYA fund ID');
   assert(!seen.has(id),'Duplicate official MAYA fund '+id);
   assert(typeof raw.name==='string'&&raw.name.trim(),'Missing official MAYA name '+id);
   assert(typeof raw.managerName==='string'&&raw.managerName.trim(),'Missing official MAYA fund manager '+id);
   assert([1,3,4,5,6].includes(raw.fundTypeId),'Unknown MAYA fund type '+id);
   seen.add(id);all.push({number:id,kind:kindOf(raw),official:raw});
  }
  console.log('MAYA list page '+page+': '+rows.length+' records; total '+all.length);
  if(rows.length<pageSize)break;
  if(page===maxPages)throw Error('MAYA list exceeded safe pagination limit');
 }
 assert(all.length>2000,'MAYA returned unexpectedly incomplete fund list');
 return {funds:all,listCount:all.length,listEndpoint:ENDPOINT};
}
module.exports={discover,kindOf};
if(require.main===module)discover().then(x=>console.log(JSON.stringify({count:x.listCount,ids:x.funds.slice(0,5).map(y=>y.number)}))).catch(e=>{console.error(e);process.exitCode=1});
