'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {publishPages} = require('../scripts/publish-maya-pages.cjs');
(async () => {
  const calls=[];
  const site={build_type:'legacy',source:{branch:'main',path:'/'},html_url:'https://example.com/'};
  const fetcher=async (url,options={})=>{
    const address=String(url);
    calls.push([address,options.method||'GET']);
    if(address.endsWith('/pages'))return Response.json(site);
    const relative=new URL(address).pathname.slice(1);
    const name=relative||'index.html';
    const file=path.join(__dirname,'..',name);
    return new Response(fs.readFileSync(file),{status:200});
  };
  const options={repository:'owner/repo',token:'test',fetcher,attempts:1,delay:0};
  assert.equal(await publishPages(options),site.html_url);
  assert.equal(calls.filter(([,method])=>method!=='GET').length,0,'Publication must not trigger a duplicate Pages build');
  assert.ok(calls.length>=19,'Must verify published index and all performance chunks');
  await assert.rejects(publishPages({...options,fetcher:async()=>Response.json({...site,build_type:'workflow'})}),/Unexpected GitHub Pages publishing source/);
  await assert.rejects(publishPages({...options,fetcher:async()=>new Response('',{status:403})}),/HTTP 403/);
  await assert.rejects(publishPages({...options,fetcher:async(url)=>String(url).endsWith('/pages')?Response.json(site):new Response('missing',{status:404})}),/HTTP 404/);
  console.log('Branch-based Pages, no duplicate build, published byte equality and failure guards passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
