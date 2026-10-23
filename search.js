(function (host) {
  'use strict';
  function norm(value) {
    return String(value ?? '').normalize('NFKC').toLowerCase()
      .replace(/["'׳״’]/g, '').replace(/[\u200e\u200f\u202a-\u202e]/g, '')
      .replace(/\\/g, '/').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
  }
  function fields(row) {
    return {
      name: row.name ?? row['שם הקרן'] ?? '',
      aliases: Array.isArray(row.aliases) ? row.aliases.join(' ') : '',
      number: String(row.number ?? row['מספר קרן'] ?? ''),
      manager: row.manager ?? row['חברה מנהלת'] ?? '',
      category: row.category ?? row['מסלול השקעה'] ?? '',
      note: row.note ?? row['הערות'] ?? '',
      type: row.type ?? row['סוג קרן'] ?? '',
      currency: row.currency ?? row['חשיפה למט״ח'] ?? '',
      denomination: row['נקובה במט״ח'] ?? '',
      duration: row.durationYears ?? row['מח״מ'] ?? null,
      durationDate: row.durationDate ?? row['תאריך מח״מ'] ?? ''
    };
  }
  function parseUncached(query) {
    const raw = norm(query);
    const text = raw.replace(/\b(?:nasdaq|nasdac)\b|נאסדאק|נסדאק|נאסדק|נסדק/g, 'nasdaq')
      .replace(/s\s*(?:&|and)\s*p\s*500|סנופי(?:\s*500)?|סנופי500/g, 's&p 500')
      .replace(/\busd\b|\bdollar\b|דולרי(?:ות|ת)?/g, 'דולר')
      .replace(/\b90\s*\/\s*10\b|\b10\s*\/\s*90\b/g, 'ratio10');
    const duration = text.match(/מחמ\s*(?:(לפחות|מעל|בדיוק|סביב)\s*)?(\d+(?:\.\d+)?)/);
    const longDuration = /מחמ\s*ארו[ךכ]/.test(text);
    let remaining = text;
    if (duration) remaining = remaining.replace(duration[0], '').replace(/שנים/g, '');
    if (longDuration) remaining = remaining.replace(/מחמ\s*ארו[ךכ](?:ה|ות|ים)?/, '');
    return {raw, text, tokens: remaining.trim().split(/\s+/).filter(Boolean), duration: duration ? Number(duration[2]) : null,
      durationMode: duration?.[1] || 'סביב', longDuration};
  }
  const parsedQueries = new Map();
  function parse(query) {
    const key = String(query ?? '');
    if (parsedQueries.has(key)) return parsedQueries.get(key);
    const parsed = parseUncached(query);
    if (parsedQueries.size >= 128) parsedQueries.delete(parsedQueries.keys().next().value);
    parsedQueries.set(key, parsed);
    return parsed;
  }
  function durationOf(f) {
    if (f.duration !== null && f.duration !== '' && Number.isFinite(Number(f.duration))) {
      return {value: Number(f.duration), source: 'נתון מח״מ', date: f.durationDate};
    }
    // A maturity year or a bond tenor in the name is never a duration value.
    const notes = norm(f.note).match(/מחמ(?:\s+מדד)?(?:\s+בפרסום)?\s*[:=]?\s*(\d+(?:\.\d+)?)/);
    if (notes) return {value: Number(notes[1]), source: 'מח״מ לפי הערה / פרסום', date: ''};
    const name = norm(f.name).match(/מחמ\s*(\d+(?:\.\d+)?)/);
    return name ? {value: Number(name[1]), source: 'מח״מ בשם הקרן', date: ''} : null;
  }
  // Catalog records are immutable after import; build normalized fields only once per record.
  const rowIndex = new WeakMap();
  function indexed(row) {
    if (rowIndex.has(row)) return rowIndex.get(row);
    const index = indexRecord(row);
    rowIndex.set(row, index);
    return index;
  }
  function indexRecord(row) {
    const f = fields(row);
    const title = norm(f.name), manager = norm(f.manager);
    const nameText = norm([f.name, f.category].join(' '));
    const policyText = norm(f.note);
    const hay = norm([f.name, f.number, f.manager, f.category, f.type, f.currency, f.note, f.aliases].join(' '))
      .replace(/נאסדאק|נסדאק|נאסדק|נסדק/g, 'nasdaq');
    return {f, title, manager, nameText, policyText, hay};
  }
  function match(row, query) {
    const p = typeof query === 'string' ? parse(query) : query;
    const {f, title, manager, nameText, policyText, hay} = indexed(row);
    let reason = '', score = 10;
    if (p.duration !== null || p.longDuration) {
      const d = durationOf(f);
      if (p.duration !== null) {
        if (!d) return {matched: false, score: 0};
        const fits = p.durationMode === 'בדיוק' ? Math.abs(d.value - p.duration) < 0.001
          : p.durationMode === 'לפחות' ? d.value >= p.duration
          : p.durationMode === 'מעל' ? d.value > p.duration : Math.abs(d.value - p.duration) <= 1;
        if (!fits) return {matched: false, score: 0};
        reason = d.source + ': ' + d.value + ' שנים' + (d.date ? ' · ' + d.date : ' · תאריך נתון לא הוזן');
        score = 60 - Math.abs(d.value - p.duration);
      } else {
        // No arbitrary threshold for "long"; require an explicit duration description.
        if (!/מחמ\s*ארו[ךכ]/.test(nameText + ' ' + policyText)) return {matched: false, score: 0};
        reason = '״מח״מ ארוך״ בשם / במדיניות'; score = 40;
      }
    }
    for (const token of p.tokens) {
      if (token === 'ratio10') {
        if (/(?:90\s*\/\s*10|10\s*\/\s*90)/.test(nameText)) {reason = 'יחס 90/10 בשם / במסלול'; score += 60;}
        else if (/עד\s*10\s*%?\s*מניות/.test(nameText + ' ' + policyText)) {reason = 'עד 10% מניות לפי הנתונים'; score += 40;}
        else return {matched: false, score: 0};
      } else if (token === 'דולר') {
        if (!/דולר|\$|\busd\b/.test(nameText + ' ' + policyText) && norm(f.currency) !== 'דולר') return {matched: false, score: 0};
        reason = /מנוטרל[^.]*דולר/.test(nameText) ? 'נטרול דולר בשם הקרן'
          : /נקוב[^.]*דולר|נקוב[^.]*\$/.test(nameText) ? 'נקובה בדולר לפי השם' : 'דולר בשם / בנתונים';
      } else if (!hay.includes(token)) return {matched: false, score: 0};
    }
    if (f.number === p.raw && p.raw) {score += 1000; reason = 'מספר קרן מדויק';}
    else if (title === p.text && p.text) {score += 300; reason ||= 'שם קרן מדויק';}
    else if (manager.includes(p.text) && p.text) {score += 100; reason ||= 'מנהל הקרן';}
    else if (p.tokens.every(t => title.includes(t))) score += 30;
    return {matched: true, score, reason: reason || (p.raw ? 'התאמה בשם / בפרטי הקרן' : '')};
  }
  const api = {norm, fields, parse, match, durationOf};
  host.FundSearch = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);