(function(root){
'use strict';
function formatResults(rows,context={}){
 const unique=[...new Map(rows.map(f=>[String(f.number),f])).values()];
 if(!unique.length)return '';
 const lines=['קרנות מתוצאות החיפוש'];
 if(context.query?.trim())lines.push('חיפוש: '+context.query.trim());
 for(const filter of context.filters||[])lines.push(filter.label+': '+filter.value);
 lines.push(unique.length+' קרנות','');
 unique.forEach((f,i)=>{
  lines.push((i+1)+'. '+f.name,'מספר קרן: '+f.number);
  if(f.manager)lines.push('מנהל: '+f.manager);
  const fee=typeof f.fee==='number'&&Number.isFinite(f.fee)?f.fee.toFixed(2)+'%':f.conflicts?.some(c=>c.field==='fee')?'דורש בדיקה':'לא הוזן';
  lines.push('דמי ניהול בפרסום: '+fee);
  if(f.note)lines.push('הערות: '+f.note);
  lines.push('');
 });
 lines.push('הנתונים לפי הפרסומים שהוזנו, אינם נתונים חיים. יש להצליב עם מערכות הבנק.');
 return lines.join('\n');
}
const api={formatResults};root.FundWhatsApp=api;
if(typeof module!=='undefined'&&module.exports){module.exports=api;return;}
const button=document.getElementById('shareWhatsApp');if(!button)return;
button.textContent='שתף תוצאות בוואטסאפ ↗';
button.addEventListener('click',()=>{
 const ids=['manager','category','currency','profile','rating','fee','typeFilter','denomFilter'];
 const filters=ids.map(id=>document.getElementById(id)).filter(e=>e&&e.value!=='').map(e=>({label:e.closest('label')?.firstChild?.textContent?.trim()||e.id,value:e.tagName==='SELECT'?e.selectedOptions[0]?.textContent:e.value+'%'}));
 const text=formatResults(filtered(),{query:document.getElementById('q').value,filters});
 if(!text)return;
 window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank','noopener,noreferrer');
});
})(typeof window==='undefined'?globalThis:window);