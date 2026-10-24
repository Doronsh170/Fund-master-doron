const fs=require('node:fs');
const DAY=86400000,anchor=Date.UTC(2026,9,24);
function isDue(now=Date.now(),event='schedule'){return event==='workflow_dispatch'||Math.floor((now-anchor)/DAY)%3===0;}
module.exports={isDue};
if(require.main===module){const due=isDue(Date.now(),process.env.GITHUB_EVENT_NAME);if(!process.env.GITHUB_OUTPUT)throw Error('GITHUB_OUTPUT is required');fs.appendFileSync(process.env.GITHUB_OUTPUT,'due='+due+'\n');console.log(due?'Refresh is due.':'No refresh due today.');}
