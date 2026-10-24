(function () {
  'use strict';
  const key = 'fund-master.personal-workspaces.v1';
  const filters = ['typeFilter', 'fxFilter', 'denomFilter', 'manager', 'category', 'currency', 'profile', 'rating', 'fee', 'sort'];
  const byId = id => document.getElementById(id);
  const queryInput = byId('q');
  if (!queryInput) return;
  let storageAvailable = true;
  function validTab(t) {
    return t && typeof t.id === 'string' && typeof t.name === 'string' && typeof t.query === 'string' && t.filters && typeof t.filters === 'object';
  }
  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(key));
      if (data && Array.isArray(data.profiles)) {
        const profiles = data.profiles.filter(p => p && typeof p.id === 'string' && typeof p.name === 'string' && Array.isArray(p.tabs))
          .map(p => ({...p, tabs: p.tabs.filter(validTab).slice(0, 50)})).slice(0, 30);
        if (profiles.length) return {profiles, active: profiles.some(p => p.id === data.active) ? data.active : profiles[0].id};
      }
    } catch (_) {storageAvailable = false;}
    return {profiles: [{id: 'local', name: 'היועץ שלי', tabs: []}], active: 'local'};
  }
  let state = load(), activeTab = '', editing = null, applying = false, activeSnapshot = null;
  const profile = () => state.profiles.find(p => p.id === state.active);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const box = document.createElement('section');
  box.className = 'personal-workspace'; box.setAttribute('aria-label', 'לשוניות אישיות');
  box.innerHTML = '<div class="personal-row" data-role="tabs"></div><form class="personal-editor" data-role="editor" hidden><label>שם הלשונית<input data-role="name" required maxlength="50"></label><label>חיפוש שמור<input data-role="query" maxlength="200" placeholder="למשל: לפדיון, מח״מ 10, S&P 500"></label><p class="personal-note">לשונית חדשה שומרת גם את המסננים הנוכחיים. בעריכת לשונית נשמרים המסננים שלה; אפשר להחליפם במסננים הנוכחיים.</p><label><span><input data-role="replace-filters" type="checkbox"> החלף במסננים הנוכחיים</span></label><div class="personal-row"><button type="submit">שמור לשונית</button><button type="button" data-action="cancel">ביטול</button><button type="button" data-action="earlier">העבר לפני</button><button type="button" data-action="later">העבר אחרי</button><button type="button" data-action="delete">מחק לשונית</button></div></form><p class="personal-note" data-role="storage"></p><div class="fund-search-status" data-role="status" aria-live="polite"></div><div class="personal-row" data-role="duration"></div>';
  const shortcuts = document.querySelector('.quick-search');
  if (shortcuts) {shortcuts.replaceChildren(box);shortcuts.classList.remove('quick-search');}
  else (document.querySelector('.searchbox') || queryInput.parentElement).append(box);
  const part = name => box.querySelector('[data-role="' + name + '"]');
  function persist() {
    try {localStorage.setItem(key, JSON.stringify(state));storageAvailable = true;}
    catch (_) {storageAvailable = false;}
    storageNote();
  }
  function storageNote() {
    part('storage').textContent = storageAvailable ? 'הלשוניות שלך נשמרות בדפדפן במכשיר הזה.' : 'השמירה בדפדפן אינה זמינה. השינויים יישמרו רק כל עוד העמוד פתוח.';
  }
  function capture() {return Object.fromEntries(filters.filter(byId).map(id => [id, byId(id).value]));}
  function refresh() {
    queryInput.dispatchEvent(new Event('input', {bubbles: true}));
    if (byId('manager')) byId('manager').dispatchEvent(new Event('change', {bubbles: true}));
  }
  function apply(tab) {
    applying = true;
    activeTab = tab?.id || '';
    queryInput.value = tab?.query || '';
    for (const id of filters) if (byId(id)) {
      const control = byId(id), value = tab?.filters[id] ?? '';
      control.value = value;
      if (control.tagName === 'SELECT' && control.selectedIndex < 0) control.selectedIndex = 0;
    }
    // Preserve currency filters from personal tabs created in the original interface.
    if (tab?.filters.fxFilter && !tab.filters.currency && byId('currency')) {
      byId('currency').value = {'כן':'חשופה','מנוטרלת מט״ח':'מנוטרלת','לא ידוע':'לא ידוע'}[tab.filters.fxFilter] || '';
    }
    applyFilters(false);
    refresh();
    applying = false;
    activeSnapshot = JSON.stringify({query: queryInput.value, filters: capture()});
    status(); paint();
  }
  function button(text, callback, pressed) {
    const b = document.createElement('button');b.type = 'button';b.textContent = text;
    if (pressed !== undefined) b.setAttribute('aria-pressed', String(pressed));
    b.addEventListener('click', callback);return b;
  }
  function paint() {
    const tabs = part('tabs');tabs.replaceChildren(button('נקה חיפוש', () => apply(null), false));
    for (const tab of profile().tabs) {
      const group = document.createElement('span');group.className = 'personal-tab';
      group.append(button(tab.name, () => apply(tab), activeTab === tab.id));
      const edit = button('ערוך', () => openEditor(tab));edit.setAttribute('aria-label', 'ערוך לשונית ' + tab.name);group.append(edit);tabs.append(group);
    }
    storageNote();
  }
  function openEditor(tab) {
    editing = tab?.id || null;
    part('name').value = tab?.name || queryInput.value || '';
    part('query').value = tab?.query ?? queryInput.value;
    part('replace-filters').checked = false;
    part('editor').hidden = false;
    for (const action of ['earlier', 'later', 'delete']) box.querySelector('[data-action="' + action + '"]').hidden = !tab;
    part('name').focus();
  }
  let lastStatusQuery = null;
  function status() {
    if (lastStatusQuery === queryInput.value) return;
    lastStatusQuery = queryInput.value;
    const parsed = FundSearch.parse(queryInput.value);
    const duration = parsed.duration !== null || parsed.longDuration;
    part('status').textContent = duration ? (parsed.duration !== null
      ? 'מח״מ ' + parsed.duration + ' · ' + (parsed.durationMode === 'סביב' ? 'סביב הערך: טווח של שנה לכל כיוון' : parsed.durationMode) + ' · רק נתון מח״מ מפורש; תאריך הנתון מוצג אם הוזן.'
      : 'מח״מ ארוך: רק תיאור מפורש בשם או במדיניות. אין הסקה משנת פדיון או מטווח השנים של האג״ח.')
      : parsed.text.includes('ratio10') ? '90/10 ו־10/90 מזוהים כאותו חיפוש. מוצגות גם התאמות מפורשות לעד 10% מניות.'
      : parsed.tokens.includes('דולר') ? 'חיפוש דולר כולל נקיבה, נטרול ואזכור דולר בנתונים. חשיפה כללית למט״ח לבדה אינה התאמה לדולר.'
      : parsed.raw ? 'חיפוש בכל הקרנות בעמוד: שם, מנהל, מסלול והערות. התוצאות מתעדכנות תוך כדי הקלדה.' : '';
    part('duration').replaceChildren();
    if (parsed.duration !== null) for (const mode of ['סביב', 'בדיוק', 'לפחות']) {
      part('duration').append(button(mode + ' ' + parsed.duration, () => {
        queryInput.value = queryInput.value.replace(/מח[״"׳']?מ\s*(?:(?:לפחות|מעל|בדיוק|סביב)\s*)?\d+(?:\.\d+)?/, 'מח״מ ' + mode + ' ' + parsed.duration);refresh();
      }, parsed.durationMode === mode));
    }
  }
  part('editor').addEventListener('submit', e => {
    e.preventDefault();const name = part('name').value.trim();if (!name) return;
    const existing = profile().tabs.find(t => t.id === editing);
    const tab = {id: existing?.id || uid(), name, query: part('query').value.trim(), filters: existing && !part('replace-filters').checked ? existing.filters : capture()};
    if (existing) Object.assign(existing, tab);else profile().tabs.push(tab);
    persist();part('editor').hidden = true;apply(tab);
  });
  box.addEventListener('click', e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'add') openEditor(null);
    if (action === 'cancel') part('editor').hidden = true;
    const tabs = profile().tabs, index = tabs.findIndex(t => t.id === editing);
    if (index < 0) return;
    if (action === 'delete') {const removed = tabs.splice(index, 1)[0];part('editor').hidden = true;persist();if (activeTab === removed.id) apply(null);else paint();}
    if (action === 'earlier' || action === 'later') {
      const next = index + (action === 'earlier' ? -1 : 1);
      if (next < 0 || next >= tabs.length) return;
      [tabs[index], tabs[next]] = [tabs[next], tabs[index]];persist();paint();
    }
  });
  for (const id of ['q', ...filters]) if (byId(id)) for (const event of ['input', 'change']) byId(id).addEventListener(event, () => {
    if (applying) return;
    const selectedBefore = activeTab;
    if (activeTab && activeSnapshot !== JSON.stringify({query: queryInput.value, filters: capture()})) activeTab = '';
    status();
    if (selectedBefore !== activeTab) paint();
  });
  byId('clearBtn')?.addEventListener('click', () => {activeTab = '';status();paint();});
  byId('reset')?.addEventListener('click', () => {activeTab = '';status();paint();});
  paint();status();
})();
