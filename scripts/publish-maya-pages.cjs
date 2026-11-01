'use strict';
const fs = require('node:fs');
const {execFileSync} = require('node:child_process');
async function publishPages({repository, token, sha, fetcher = fetch, attempts = 60, delay = 10000}) {
  const api = async (suffix, method = 'GET') => {
    const response = await fetcher(`https://api.github.com/repos/${repository}/pages${suffix}`, {
      method, headers: {Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'},
      signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) throw Error(`Pages ${method} ${suffix}: HTTP ${response.status}`);
    return response.json();
  };
  const site = await api('');
  if (site.build_type !== 'legacy' || site.source?.branch !== 'main' || site.source?.path !== '/') {
    throw Error('Expected the existing branch-based Pages source main /; refusing to start a competing deployment');
  }
  // Use the SAME queue as automatic branch builds, never a second artifact deployment.
  // GitHub serializes build requests for this endpoint.
  await api('/builds', 'POST');
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const build = await api('/builds/latest');
    if (build.commit === sha && build.status === 'built') return site.html_url;
    if (build.commit === sha && build.status === 'errored') throw Error('Pages build failed: ' + (build.error?.message || sha));
    console.log(`Waiting for Pages build ${sha}: ${build.status} (${attempt}/${attempts})`);
    if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, delay));
  }
  throw Error('Timed out waiting for the verified commit to finish its Pages build');
}
module.exports = {publishPages};
if (require.main === module) {
  if (!process.env.GH_TOKEN || !process.env.GITHUB_REPOSITORY) throw Error('GitHub repository and token are required');
  publishPages({repository: process.env.GITHUB_REPOSITORY, token: process.env.GH_TOKEN, sha: execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim()})
    .then(url => {console.log('Pages build completed: ' + url); fs.appendFileSync(process.env.GITHUB_OUTPUT, 'page_url=' + url + '\n');})
    .catch(error => {console.error(error); process.exitCode = 1;});
}
