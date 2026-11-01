'use strict';
const assert = require('node:assert/strict');
const {publishPages} = require('../scripts/publish-maya-pages.cjs');
(async () => {
  const calls = [];
  let poll = 0;
  const site = {build_type: 'legacy', source: {branch: 'main', path: '/'}, html_url: 'https://example.com/'};
  const fetcher = async (url, options) => {
    calls.push([url, options.method]);
    return Response.json(url.endsWith('/builds/latest') ? (++poll === 1 ? {commit: 'old', status: 'building'} : {commit: 'expected', status: 'built'}) : url.endsWith('/builds') ? {status: 'queued'} : site);
  };
  const options = {repository: 'owner/repo', token: 'test', sha: 'expected', fetcher, attempts: 2, delay: 0};
  assert.equal(await publishPages(options), site.html_url);
  assert.equal(calls.filter(([, method]) => method === 'POST').length, 1);
  await assert.rejects(publishPages({...options, fetcher: async () => Response.json({...site, build_type: 'workflow'})}), /competing deployment/);
  await assert.rejects(publishPages({...options, fetcher: async url => Response.json(url.endsWith('/latest') ? {commit: 'expected', status: 'errored'} : site)}), /build failed/);
  await assert.rejects(publishPages({...options, fetcher: async () => new Response('', {status: 403})}), /HTTP 403/);
  console.log('Single Pages build queue, commit identity, failure and permissions checks passed.');
})().catch(error => {console.error(error); process.exitCode = 1;});
