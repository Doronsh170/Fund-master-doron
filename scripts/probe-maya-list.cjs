'use strict';
(async()=>{
  const base='https://maya.tase.co.il/api/v1/funds';
  // Repeatable read-only investigation of the official full-list endpoint.
  const headers={'Content-Type':'application/json','Accept':'application/json','Accept-Language':'he-IL','Origin':'https://maya.tase.co.il','Referer':'https://maya.tase.co.il/'};
  async function probe(path,method='POST',body={pageSize:20,pageNumber:1}){
    try{
      const r=await fetch(base+path,{method,headers,body:method==='POST'?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000)});
      const txt=await r.text();let json;try{json=JSON.parse(txt)}catch{}
      const rows=Array.isArray(json)?json:json?.items||json?.data||json?.results;
      const ids=Array.isArray(rows)?rows.slice(0,3).map(x=>x.fundId||x.id||x.securityId):[];
      console.log(JSON.stringify({path,method,http:r.status,shape:Array.isArray(json)?'array':typeof json,keys:json&&!Array.isArray(json)&&typeof json==='object'?Object.keys(json).slice(0,12):[],rows:rows?.length,ids,bodySample:!r.ok?txt.slice(0,180):undefined}));
    }catch(e){console.log(JSON.stringify({path,method,error:e.message}));}
  }
  for(const body of [{pageSize:5,pageNumber:1},{pageSize:5,pageNumber:2},{pageSize:5,pageNumber:0},{pageSize:100,pageNumber:1},{pageSize:100,pageNumber:2},{page:2,size:5},{skip:20,take:5},{pageSize:4000,pageNumber:1}]){
    await probe('/all','POST',body);
  }
  for(const route of ['/mutual','/etf','/hedge','/all'])await probe(route);
  for(const route of ['/mutual','/etf','/hedge','/all'])await probe(route,'GET');
  for(const kind of ['mutual','etf','hedge'])await probe('/'+kind+'/1159136','GET');
})();