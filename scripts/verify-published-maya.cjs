'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const base = path.resolve(__dirname, '..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

async function verifyPublished(url, {fetcher = fetch, attempts = 18, delay = 10000} = {}) {
  const index = fs.readFileSync(path.join(base, 'index.html'), 'utf8');
  const scripts = [...index.matchAll(/src="((?:maya-performance\/part-\d{2}\.js|maya-performance-data\.js)\?v=[^"]+)"/g)].map(m => m[1]);
  if (scripts.length !== 17) throw Error('Expected 17 versioned performance scripts');
  const files = ['index.html', ...scripts];
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await Promise.all(files.map(async file => {
        const remote = new URL(file, url.endsWith('/') ? url : url + '/');
        remote.searchParams.set('verify', process.env.GITHUB_RUN_ID || String(Date.now()));
        const response = await fetcher(remote, {cache: 'no-store', signal: AbortSignal.timeout(30000)});
        if (!response.ok) throw Error(`${file}: HTTP ${response.status}`);
        const actual = Buffer.from(await response.arrayBuffer());
        const expected = fs.readFileSync(path.join(base, file.split('?')[0]));
        if (hash(actual) !== hash(expected)) throw Error(`${file}: published bytes differ`);
      }));
      return 'Published index and all 17 performance scripts match the validated snapshot.';
    } catch (error) {
      console.log(`Publication check ${attempt}/${attempts}: ${error.message}`);
      if (attempt === attempts) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
module.exports = {verifyPublished};
if (require.main === module) {
  if (!process.env.SITE_URL) throw Error('SITE_URL is required');
  verifyPublished(process.env.SITE_URL).then(message => {
    console.log(message);
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, message + '\n');
  }).catch(error => { console.error(error); process.exitCode = 1; });
}
