'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {verifyPublished} = require('../scripts/verify-published-maya.cjs');
const base = path.resolve(__dirname, '..');
(async () => {
  let requests = 0;
  const valid = async url => {
    requests++;
    assert(url.searchParams.has('verify'));
    const file = decodeURIComponent(url.pathname.replace('/site/', ''));
    return new Response(fs.readFileSync(path.join(base, file)));
  };
  await verifyPublished('https://example.com/site/', {fetcher: valid, attempts: 1});
  assert.equal(requests, 18);
  await assert.rejects(verifyPublished('https://example.com/site/', {
    fetcher: async () => new Response('stale content'), attempts: 1
  }), /published bytes differ/);
  await assert.rejects(verifyPublished('https://example.com/site/', {
    fetcher: async () => new Response('', {status: 404}), attempts: 1
  }), /HTTP 404/);
  let first = true;
  await verifyPublished('https://example.com/site/', {
    fetcher: async url => { if (first) {first = false; return new Response('', {status: 503});} return valid(url); },
    attempts: 2, delay: 0
  });
  console.log('Published snapshot, stale content, HTTP failure and retry checks passed.');
})().catch(error => {console.error(error); process.exitCode = 1;});
