(function(root){
'use strict';
// Monthly source data is fetched server-side; the tooltip never borrows another fund's results.
const data=typeof module!=='undefined'&&module.exports?require('./maya-performance-data.js'):root.FUND_PERFORMANCE_DATA;
function recordFor(number){return data?.funds?.[String(number)]||null;}
function snapshotFor(number){const record=recordFor(number);return record?.status==='available'?record:null;}
function displayDate(value){if(!value)return 'לא נמסר';return /^\d{4}-\d{2}-\d{2}/.test(value)?value.slice(0,10).split('-').reverse().join('/'):value;}
if(typeof module!=='undefined'&&module.exports){module.exports={snapshotFor,recordFor,displayDate};return;}
const popup=document.createElement('aside');popup.id='fund-performance-popover';popup.className='fund-performance-popover';popup.dir='rtl';popup.hidden=true;popup.setAttribute('role','dialog');popup.setAttribute('aria-label','תשואות הקרן מול הסיווג');document.body.append(popup);
let trigger=null,pinned=false,closeTimer=null;
const percent=value=>typeof value==='number'&&Number.isFinite(value)?(value>0?'+':'')+value.toFixed(2)+'%':'—';
function hide(){clearTimeout(closeTimer);if(trigger)trigger.setAttribute('aria-expanded','false');popup.hidden=true;trigger=null;pinned=false;}
function position(){
 if(!trigger||popup.hidden)return;
 const rect=trigger.getBoundingClientRect(),width=popup.getBoundingClientRect().width,height=popup.getBoundingClientRect().height;
 const left=Math.max(12,Math.min(rect.right-width,innerWidth-width-12));
 let top=rect.bottom+10;if(top+height>innerHeight-12)top=rect.top-height-10;
 popup.style.left=left+'px';popup.style.top=Math.max(12,Math.min(top,innerHeight-height-12))+'px';
}
function element(tag,text,className){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;}
function show(button){
 clearTimeout(closeTimer);if(trigger===button&&!popup.hidden)return;
 if(trigger)trigger.setAttribute('aria-expanded','false');trigger=button;pinned=false;
 const number=button.dataset.fundPerformance,fund=(root.FUND_DATA||[]).find(f=>f.number===number),snapshot=snapshotFor(number),record=recordFor(number);
 popup.replaceChildren();
 const heading=element('div',undefined,'performance-heading');heading.append(element('strong','ביצועי הקרן והסיווג'));
 const close=element('button','×','performance-close');close.type='button';close.setAttribute('aria-label','סגור תשואות');close.addEventListener('click',hide);heading.append(close);popup.append(heading);
 popup.append(element('div',(fund?.name||'קרן')+' · '+number,'performance-fund-name'));
 if(snapshot){
  popup.append(element('div',snapshot.asOf?'לפי מאיה · נכון ל־'+displayDate(snapshot.asOf):'לפי מאיה · תאריך הנתונים לא נמסר במקור','performance-date'));
  const classification=snapshot.classification;
  if(classification)popup.append(element('div','סיווג: '+[classification.major,classification.main,classification.secondary].filter(Boolean).join(' · '),'performance-caption'));
  const table=element('table');table.dir='rtl';const head=element('thead'),hr=element('tr');
  for(const label of ['תקופה','תשואת הקרן','תשואת הסיווג']){const th=element('th',label);th.scope='col';hr.append(th);}head.append(hr);table.append(head);
  const body=element('tbody');for(const row of snapshot.rows){const tr=element('tr'),period=element('th',row.period);period.scope='row';tr.append(period);for(const value of [row.fund,row.classification]){const td=element('td',percent(value));td.dir='ltr';tr.append(td);}body.append(tr);}table.append(body);popup.append(table);
  if(snapshot.deleted)popup.append(element('p','הקרן מסומנת כ״מחוקה״ במאיה; הנתונים היסטוריים.','performance-unavailable'));
  popup.append(element('p','תשואת הסיווג היא ממוצע סיווג הקרן כפי שמוצג במאיה.','performance-caption'));
  popup.append(element('p','* לפי הגדרת 12 החודשים במאיה, מתחילת החודש הקלנדרי הראשון בתקופה.','performance-caption'));
  popup.append(element('p','נתוני העדכון החודשי · בדיקה אחרונה: '+displayDate(snapshot.fetchedAt),'performance-caption'));
  if(snapshot.refreshWarning)popup.append(element('p','העדכון האחרון לקרן לא הושלם; מוצגים הנתונים השמורים מתאריך המקור.','performance-unavailable'));
 }else {
  const message=record?.status==='not-provided'?'מאיה אינה מספקת טבלת תשואה והשוואה לסיווג לקרן זו.':record?.status==='not-found'?'הקרן לא נמצאה בממשק נתוני הביצועים של מאיה.':record?.status==='request-failed'?'עדכון נתוני הקרן ממאיה לא הושלם.':'טרם נאספו נתוני תשואה לקרן זו.';
  popup.append(element('p',message,'performance-unavailable'));
  if(record?.fetchedAt)popup.append(element('div','בדיקה אחרונה: '+displayDate(record.fetchedAt),'performance-date'));
 }
 const link=element('a','פתיחת הקרן במאיה ↗');link.href=record?.source||'https://maya.tase.co.il/he/funds/mutual-funds/'+encodeURIComponent(number);link.target='_blank';link.rel='noopener noreferrer';popup.append(link);
 popup.hidden=false;button.setAttribute('aria-expanded','true');position();
}
function laterHide(){if(!pinned)closeTimer=setTimeout(hide,180);}
document.addEventListener('mouseover',e=>{const b=e.target.closest('[data-fund-performance]');if(b&&(!pinned||b===trigger))show(b);});
document.addEventListener('mouseout',e=>{const b=e.target.closest('[data-fund-performance]');if(b&&b===trigger&&!b.contains(e.relatedTarget)&&!popup.contains(e.relatedTarget))laterHide();});
document.addEventListener('focusin',e=>{const b=e.target.closest('[data-fund-performance]');if(b)show(b);else if(!popup.contains(e.target)&&!pinned)hide();});
document.addEventListener('click',e=>{const b=e.target.closest('[data-fund-performance]');if(b){if(trigger===b&&!popup.hidden&&pinned){hide();return;}show(b);pinned=true;return;}if(!popup.contains(e.target))hide();});
popup.addEventListener('mouseenter',()=>clearTimeout(closeTimer));popup.addEventListener('mouseleave',laterHide);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!popup.hidden){e.preventDefault();hide();}});
window.addEventListener('resize',position);window.addEventListener('scroll',position,true);
const cards=document.getElementById('cards');if(cards)new MutationObserver(()=>{if(trigger&&!trigger.isConnected)hide();}).observe(cards,{childList:true});
})(typeof window==='undefined'?globalThis:window);