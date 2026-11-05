'use strict';
const fs = require('node:fs');
const {verifyPublished} = require('./verify-published-maya.cjs');

async function publishPages({repository, token, fetcher = fetch, attempts = 60, delay = 10000}) {
  const response = await fetcher('https://api.github.com/repos/' + repository + '/pages', {
    headers: {Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'},
    signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) throw Error('Pages settings request failed: HTTP ' + response.status);
  const site = await response.json();
  if (site.build_type !== 'legacy' || site.source?.branch !== 'main' || site.source?.path !== '/') {
    throw Error('Unexpected GitHub Pages publishing source; refusing to accept an unverified deployment');
  }
  // Pushing the verified data already starts GitHub Pages' branch deployment.
  // Do not manually start a second build: it can fail while the first succeeds.
  // Verify what users actually receive before reporting success.
  const outcome = await verifyPublished(site.html_url, {fetcher, attempts, delay});
  console.log(outcome);
  return site.html_url;
}
module.exports = {publishPages};
if (require.main === module) {
  if (!process.env.GH_TOKEN || !process.env.GITHUB_REPOSITORY) throw Error('GitHub repository and token are required');
  publishPages({repository: process.env.GITHUB_REPOSITORY, token: process.env.GH_TOKEN})
    .then(url => {console.log('Verified published site: ' + url); fs.appendFileSync(process.env.GITHUB_OUTPUT, 'page_url=' + url + '\n');})
    .catch(error => {console.error(error); process.exitCode = 1;});
}
