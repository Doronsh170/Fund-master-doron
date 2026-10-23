(function(){
'use strict';
const input=document.getElementById('q'),list=document.getElementById('searchSuggestions'),search=document.getElementById('searchNow');
if(!input||!list||!search)return;
const funds=window.FUND_DATA||[],norm=FundSearch.norm;
// Merge equivalent spellings (including Hebrew/ASCII quotation marks) before ranking.
const termMap=new Map();
for(const label of ['דולר','כספית','לפדיון','90/10','מח״מ 10','מח״מ ארוך','S&P 500','Nasdaq 100',...funds.map(f=>f.manager),...funds.map(f=>f.category)].filter(Boolean)){
 const key=FundSearch.parse(label).text;
 if(!termMap.has(key))termMap.set(key,label.replace(/אג["״]ח/g,'אג״ח').replace(/חו["״]ל/g,'חו״ל'));
}
const terms=[...termMap.values()];
let choices=[],selected=-1,closed=false;
const close=()=>{list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');selected=-1;};
function choose(choice){input.value=choice.query;closed=true;input.dispatchEvent(new Event('input',{bubbles:true}));close();input.focus();search.click();}
function select(index){selected=index;list.querySelectorAll('[role=option]').forEach((b,i)=>b.setAttribute('aria-selected',String(i===selected)));if(index>=0)input.setAttribute('aria-activedescendant','fund-suggestion-'+index);else input.removeAttribute('aria-activedescendant');}
function render(){
const q=norm(input.value);if(!q||closed){close();return;}
const matches=terms.filter(t=>norm(t).includes(q)).map(label=>({label,query:label,count:funds.filter(f=>FundSearch.match(f,label).matched).length,kind:'חיפוש'})).filter(x=>x.count>0).sort((a,b)=>Number(norm(b.label).startsWith(q))-Number(norm(a.label).startsWith(q))||b.count-a.count||a.label.localeCompare(b.label,'he'));
const exact=matches.filter(x=>norm(x.label)===q);const related=matches.filter(x=>norm(x.label)!==q);
const rows=funds.filter(f=>FundSearch.match(f,input.value).matched).sort((a,b)=>FundSearch.match(b,input.value).score-FundSearch.match(a,input.value).score);
choices=[...exact,...related].slice(0,7);
for(const fund of rows.slice(0,/^\d/.test(q)?5:3))choices.push({label:fund.name,query:fund.number,count:1,kind:fund.number});
list.replaceChildren();const heading=document.createElement('div');heading.className='suggestion-heading';heading.textContent='אפשרויות לחיפוש · '+rows.length+' קרנות מתאימות';list.append(heading);
choices.forEach((choice,i)=>{const b=document.createElement('button');b.type='button';b.id='fund-suggestion-'+i;b.setAttribute('role','option');b.setAttribute('aria-selected','false');const label=document.createElement('span');label.textContent=choice.label;const detail=document.createElement('small');detail.textContent=choice.kind==='חיפוש'?choice.count+' קרנות':choice.kind;b.append(label,detail);b.addEventListener('click',()=>choose(choice));list.append(b);});
if(!choices.length){const empty=document.createElement('div');empty.className='suggestion-empty';empty.textContent='אין אפשרויות במאגר למונח הזה. אפשר לשנות את החיפוש.';list.append(empty);}
else{const all=document.createElement('button');all.type='button';all.textContent='הצג את כל '+rows.length+' התוצאות לחיפוש הזה';all.addEventListener('click',()=>{closed=true;close();search.click();});list.append(all);}
list.hidden=false;input.setAttribute('aria-expanded','true');selected=-1;input.removeAttribute('aria-activedescendant');
}
input.addEventListener('input',()=>{if(document.activeElement===input)closed=false;render();});
input.addEventListener('focus',()=>{closed=false;render();});
input.addEventListener('keydown',event=>{
if(event.key==='Escape'){closed=true;close();return;}
if(!list.hidden&&['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();if(choices.length)select(selected<0?(event.key==='ArrowDown'?0:choices.length-1):(selected+(event.key==='ArrowDown'?1:-1)+choices.length)%choices.length);}
if(event.key==='Enter'&&!list.hidden){event.preventDefault();event.stopImmediatePropagation();if(selected>=0)choose(choices[selected]);else{closed=true;close();search.click();}}
},true);
search.addEventListener('click',()=>{closed=true;close();});
document.addEventListener('click',e=>{if(e.target!==input&&!list.contains(e.target)){closed=true;close();}});
input.addEventListener('keydown',e=>{if(e.key==='Tab'){closed=true;close();}});
})();