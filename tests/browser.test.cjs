const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const path=require('node:path'),{pathToFileURL}=require('node:url'),assert=require('node:assert/strict');
const base=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE || undefined});try{
const context=await browser.newContext({viewport:{width:1024,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const url=pathToFileURL(path.resolve(base,'index.html')).href;
await page.goto(url);assert.equal(await page.locator('article.card').count(),0);
const report=await page.evaluate(()=>FUND_MERGE_REPORT);assert.equal(report.uniqueCount,280);
assert.equal(await page.locator('[data-role=profiles]').count(),0);
assert(await page.getByRole('button',{name:'חפש',exact:true}).isVisible());
await page.locator('#q').fill('א');assert(await page.locator('#searchSuggestions').isVisible());
const suggestionLabels=await page.locator('#searchSuggestions [role=option] > span').allTextContents();
const normalizedLabels=suggestionLabels.map(x=>x.replace(/["״׳']/g,'').replace(/\s+/g,' ').trim().toLowerCase());
assert.equal(new Set(normalizedLabels).size,normalizedLabels.length,'Duplicate suggestion labels');
await page.locator('#q').press('Escape');assert(await page.locator('#searchSuggestions').isHidden());

await page.locator('#q').fill('5142534');assert.equal(await page.locator('article.card').count(),1);assert.match(await page.locator('article.card').innerText(),/0.10%/);
await page.locator('#q').fill('90\\10');assert.equal(await page.locator('article.card').count(),9);
await page.locator('#q').fill('מחמ 10');assert.equal(await page.locator('article.card').count(),3);await page.getByRole('button',{name:'בדיוק 10',exact:true}).click();assert.equal(await page.locator('article.card').count(),0);
await page.locator('#q').fill('דולר');await page.locator('[data-action=add]').click();await page.locator('[data-role=name]').fill('דולר אישי');await page.locator('[data-role=editor] button[type=submit]').click();await page.reload();await page.getByRole('button',{name:'דולר אישי',exact:true}).click();assert.equal(await page.locator('article.card').count(),30);
await page.getByRole('button',{name:'נקה חיפוש',exact:true}).click();assert.equal(await page.locator('article.card').count(),0);
await page.locator('#typeFilter').selectOption('קרן סל');assert((await page.locator('article.card').count())>0);assert((await page.locator('article.card').count())<280);await page.getByRole('button',{name:'נקה חיפוש',exact:true}).click();
await page.locator('#q').fill('5139316');assert.match(await page.locator('article.card').innerText(),/דורש בדיקה/);
const exported=await page.evaluate(()=>{document.getElementById('q').value='';paint();return{rows:exportRows().length,csv:csv()};});assert.equal(exported.rows,280);assert(exported.csv.includes('מקורות'));
await page.evaluate(()=>localStorage.setItem('fund-master.personal-workspaces.v1',JSON.stringify({active:'old',profiles:[{id:'old',name:'יועץ קודם',tabs:[{id:'old-tab',name:'לשונית קודמת',query:'',filters:{typeFilter:'קרן מחקה',fxFilter:'מנוטרלת מט״ח',denomFilter:'לא'}}]}]})));
await page.reload();await page.getByRole('button',{name:'לשונית קודמת',exact:true}).click();assert.equal(await page.locator('#typeFilter').inputValue(),'קרן מחקה');assert.equal(await page.locator('#currency').inputValue(),'מנוטרלת');assert.equal(await page.getByRole('button',{name:'לשונית קודמת',exact:true}).getAttribute('aria-pressed'),'true');assert((await page.locator('article.card').count())>0);
await page.goto(pathToFileURL(path.resolve(base,'flyers/index.html')).href);await page.waitForURL(new URL('./',url).href);await page.goto(url);assert.equal(await page.locator('article.card').count(),0);
await page.setViewportSize({width:375,height:812});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));assert.deepEqual(errors,[]);console.log('Unified UI: clean opening, unique number lookup, search, export, saved tabs, legacy preferences, old-link redirect and mobile checks passed.');
await context.close();}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});