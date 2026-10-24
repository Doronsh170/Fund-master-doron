(function(){
 const ids=['manager','category','currency','profile','rating','typeFilter','denomFilter'],widgets=[];
 for(const id of ids){const select=document.getElementById(id);select.multiple=true;select.hidden=true;for(const o of select.options)o.selected=false;
 const label=select.closest('label'),title=label.firstChild.textContent.trim(),field=document.createElement('div');field.className='field multi-filter';label.before(field);field.append(label);const details=document.createElement('details'),summary=document.createElement('summary'),list=document.createElement('div');details.className='multi-filter-menu';list.className='multi-filter-list';list.setAttribute('role','group');list.setAttribute('aria-label',title);details.append(summary,list);field.append(details);
 const all=document.createElement('button');all.type='button';all.textContent='נקה בחירה';all.addEventListener('click',()=>{for(const o of select.options)o.selected=false;sync();select.dispatchEvent(new Event('change',{bubbles:true}))});list.append(all);
 const boxes=[];for(const option of Array.from(select.options).filter(o=>o.value)){const item=document.createElement('label'),box=document.createElement('input'),text=document.createElement('span');box.type='checkbox';box.value=option.value;text.textContent=option.textContent;item.append(box,text);list.append(item);box.addEventListener('change',()=>{option.selected=box.checked;sync();select.dispatchEvent(new Event('change',{bubbles:true}))});boxes.push({box,option})}
 function sync(){for(const {box,option} of boxes)box.checked=option.selected;const chosen=boxes.filter(x=>x.option.selected).map(x=>x.option.textContent);summary.textContent=chosen.length?chosen.join(' · '):'הכול';summary.title=summary.textContent;summary.setAttribute('aria-label',title+': '+summary.textContent);}
 select.addEventListener('change',sync);widgets.push(sync);sync();
 }
 window.syncMultiFilters=()=>widgets.forEach(sync=>sync());
})();
