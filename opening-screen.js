(function(){
  const input=document.getElementById('q');
  input.value='';
  input.dispatchEvent(new Event('input',{bubbles:true}));
  // Browsers may restore form values when navigating back to this page.
  window.addEventListener('pageshow',()=>{input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));});
  const options=document.getElementById('searchOptions'),toggle=document.getElementById('toggleSearchOptions');
  toggle.addEventListener('click',()=>{options.hidden=!options.hidden;toggle.setAttribute('aria-expanded',String(!options.hidden));toggle.textContent=options.hidden?'אפשרויות חיפוש':'הסתר אפשרויות חיפוש';});
  const theme=document.createElement('button');theme.id='themeToggle';theme.type='button';
  document.querySelector('header>div').prepend(theme);
  let dark=false;try{dark=localStorage.getItem('fund-master.theme')==='dark';}catch(_){}
  function paintTheme(){document.documentElement.dataset.theme=dark?'dark':'light';theme.textContent=dark?'מצב בהיר':'מצב כהה';theme.setAttribute('aria-pressed',String(dark));}
  theme.addEventListener('click',()=>{dark=!dark;paintTheme();try{localStorage.setItem('fund-master.theme',dark?'dark':'light');}catch(_){}});
  paintTheme();
})();
