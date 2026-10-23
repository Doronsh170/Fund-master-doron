(function(){
  const input=document.getElementById('q');
  input.value='';
  input.dispatchEvent(new Event('input',{bubbles:true}));
  // Browsers may restore form values when navigating back to this page.
  window.addEventListener('pageshow',()=>{input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));});
  const options=document.getElementById('searchOptions'),toggle=document.getElementById('toggleSearchOptions');
  toggle.addEventListener('click',()=>{options.hidden=!options.hidden;toggle.setAttribute('aria-expanded',String(!options.hidden));toggle.title=options.hidden?'פתח סינון':'סגור סינון';});
  toggle.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/></svg><span>סינון</span>';
  toggle.title='פתח סינון';
  const row=document.querySelector('.search-input-row'),shell=document.createElement('div');shell.className='smart-search-shell';row.before(shell);shell.append(row,toggle);
  const helper=document.createElement('p');helper.className='search-helper';helper.textContent='האפשרויות יופיעו תוך כדי הקלדה';shell.after(helper);
  const more=document.getElementById('toggleMoreActions'),actions=document.getElementById('moreActions');
  more.addEventListener('click',()=>{actions.hidden=!actions.hidden;more.setAttribute('aria-expanded',String(!actions.hidden));more.querySelector('span').textContent=actions.hidden?'⌄':'⌃';});
  document.getElementById('searchNow').addEventListener('click',()=>{if(input.value.trim()||Array.from(options.querySelectorAll('select,input')).some(x=>x.id!=='sort'&&x.value))input.blur();});
  const theme=document.createElement('button');theme.id='themeToggle';theme.type='button';
  document.querySelector('header>div').prepend(theme);
  let dark=false;try{dark=localStorage.getItem('fund-master.theme')==='dark';}catch(_){}
  function paintTheme(){document.documentElement.dataset.theme=dark?'dark':'light';theme.textContent=dark?'מצב בהיר':'מצב כהה';theme.setAttribute('aria-pressed',String(dark));}
  theme.addEventListener('click',()=>{dark=!dark;paintTheme();try{localStorage.setItem('fund-master.theme',dark?'dark':'light');}catch(_){}});
  document.getElementById('backToSearch').addEventListener('click',()=>{input.scrollIntoView({behavior:'smooth',block:'center'});input.focus({preventScroll:true});});
  paintTheme();
})();
