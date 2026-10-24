const assert=require('node:assert/strict'),{isDue}=require('../scripts/maya-refresh-due.cjs');const anchor=Date.UTC(2026,9,24),DAY=86400000;
for(let day=0;day<400;day++){assert.equal(isDue(anchor+day*DAY,'schedule'),day%3===0);assert.equal(isDue(anchor+day*DAY,'workflow_dispatch'),true);}
assert(isDue(Date.UTC(2026,9,27)));assert(!isDue(Date.UTC(2026,9,28)));console.log('Three-day cadence across month/year boundaries and manual override passed.');
