(function (host) {
  'use strict';
  // Normalize complete investment terms, never strip arbitrary Hebrew suffixes.
  const termForms=new Map();
  for(const forms of [
    ['מעורבת','מעורב','מעורבות','מעורבים'],['קרן','קרנות'],['כספית','כספיות'],['גמישה','גמיש','גמישים','גמישות'],
    ['מניות','מניה','מנייתי','מנייתית','מנייתיים','מנייתיות'],
    ['אגח','אגחים','אגחי','אגחית','אגחיות'],['שקלית','שקלי','שקליים','שקליות'],
    ['צמודה','צמוד','צמודים','צמודות'],['מנוטרלת','מנוטרל','מנוטרלים','מנוטרלות'],
    ['חשופה','חשוף','חשופות','חשופים','חשופת'],['מוגבלת','מוגבל','מוגבלים','מוגבלות'],
    ['נקובה','נקוב','נקובים','נקובות'],['מחקה','מחקות'],['עוקבת','עוקב','עוקבות','עוקבים'],
    ['אקטיבית','אקטיבי','אקטיביות','אקטיביים'],['פסיבית','פסיבי','פסיביות','פסיביים'],
    ['קונצרני','קונצרנית','קונצרניים','קונצרניות'],['ממשלתי','ממשלתית','ממשלתיים','ממשלתיות'],
    ['ארוך','ארוכה','ארוכים','ארוכות'],['קצר','קצרה','קצרים','קצרות'],
    ['בינוני','בינונית','בינוניים','בינוניות'],['גבוה','גבוהה','גבוהים','גבוהות'],
    ['נמוך','נמוכה','נמוכים','נמוכות'],['דירוג','דירוגים'],['השקעה','השקעות'],
    ['סולידית','סולידי','סולידיות','סולידיים'],['משולבת','משולב','משולבות','משולבים']
  ])for(const form of forms)termForms.set(form,forms[0]);
  function norm(value) {
    return String(value ?? '').normalize('NFKC').toLowerCase()
      .replace(/["'׳״’]/g, '').replace(/[\u200e\u200f\u202a-\u202e]/g, '')
      .replace(/\\/g, '/').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim().replace(/[א-ת]+/g,word=>termForms.get(word)||word);
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
  let managerNames=[];
  function setCatalog(rows){managerNames=[...new Set(rows.map(x=>norm(x.manager)).filter(Boolean))].sort((a,b)=>b.length-a.length);parsedQueries.clear();}
  function parseUncached(query) {
    const raw = norm(query).replace(/בדירוג/g,'דירוג').replace(/בדמי ניהול/g,'דמי ניהול').replace(/כספיות/g,'כספית').replace(/דירוג(?:י)?(?:\s+דיסקונט)?\s+גבוה(?:ה|ים|ות)?/g,'דירוג 3,4,5');
    const text = raw.replace(/\b(?:nasdaq|nasdac)\b|נאסדאק|נסדאק|נאסדק|נסדק/g, 'nasdaq')
      .replace(/s\s*(?:&|and)\s*p\s*500|סנופי(?:\s*500)?|סנופי500/g, 's&p 500')
      .replace(/\busd\b|\bdollar\b|דולרי(?:ות|ת)?/g, 'דולר')
      .replace(/\b90\s*\/\s*10\b|\b10\s*\/\s*90\b/g, 'ratio10').replace(/\b80\s*\/\s*20\b|\b20\s*\/\s*80\b/g,'ratio20').replace(/(\d{1,2})\s*\/\s*(\d{1,2})/g,(all,a,b)=>Number(a)+Number(b)===100?'ratio'+Math.min(Number(a),Number(b)):all);
    const duration = text.match(/מחמ\s*(?:(לפחות|מעל|בדיוק|סביב|עד|מתחת ל)\s*)?(\d+(?:\.\d+)?)/);
    const longDuration = /מחמ\s*ארו[ךכ]/.test(text);
    const ratingMatch=text.match(/דירוג(?:י)?(?:\s+דיסקונט)?\s*[:=]?\s*([1-5](?:\s*(?:,|ו|או|\/)\s*[1-5])*)(?![\d.])/);
    const ratings=ratingMatch?[...new Set(ratingMatch[1].match(/[1-5]/g).map(Number))]:[];
    let remaining = ratingMatch?text.replace(ratingMatch[0],' '):text;
    remaining=remaining.replace(/ללא\s+דמי\s+ניהול/g,'דמי ניהול בדיוק 0');
    remaining=remaining.replace(/(עד|לכל היותר|מתחת ל|פחות מ|מעל|לפחות|בדיוק)\s+(דמי\s*ניהול|דמנ)/g,'$2 $1');
    const mixed=/(?:^|\s)מעורבת(?=\s|$)/.test(remaining);remaining=remaining.replace(/(?:^|\s)מעורבת(?=\s|$)/g,' ');
    const feeMatch=remaining.match(/(?:דמי\s*ניהול|דמנ)\s*(?:של\s*)?(עד|לכל היותר|לא יותר מ|מתחת ל|פחות מ|מעל|לפחות|בדיוק)?\s*[-:=]?\s*(\d+(?:\.\d+)?)\s*(?:%|אחוז(?:ים)?)?/);
    const fee=feeMatch?{value:Number(feeMatch[2]),mode:feeMatch[1]||'בדיוק'}:null;
    if(feeMatch)remaining=remaining.replace(feeMatch[0],' ');
    let cashType=null;
    if(/(?:^|\s)כספית(?=\s|$)/.test(remaining)){
      for(const [pattern,value] of [[/נקובה\s*(?:ב)?דולר/,'usd'],[/חשופה\s*(?:ל)?מטח/,'fx'],[/שקלית/,'ils']])if(pattern.test(remaining)){cashType=value;remaining=remaining.replace(pattern,' ');break;}
    }
    let currency=null;
    for(const [pattern,value] of [[/מנוטרל(?:ת|ות|ים)?\s*(?:מטח|מטבע(?:\s*חוץ)?)/,'מנוטרלת'],[/ללא\s*חשיפ(?:ה|ת)\s*(?:ל)?(?:מטח|מטבע\s*חוץ)/,'מנוטרלת'],[/חשופ(?:ה|ת|ות|ים)?\s*(?:ל)?מטח/,'חשופה'],[/נקוב(?:ה|ת|ות|ים)?\s*(?:ב)?דולר/,'דולר']]){if(pattern.test(remaining)){currency=value;remaining=remaining.replace(pattern,' ');break}}
    const unsupported=/תשוא(?:ה|ות)|סטיית\s+תקן|סיכון|לא\s+מנוטרל/.test(remaining);
    const managers=[];
    for(const name of managerNames){const parts=remaining.split(/\s+/);const index=parts.join(' ').indexOf(name);if(index>=0){const before=remaining[index-1],after=remaining[index+name.length];if((!before||/\s/.test(before))&&(!after||/\s/.test(after))){managers.push(name);remaining=remaining.slice(0,index)+' '+remaining.slice(index+name.length);}}}
    if(managers.length)remaining=remaining.replace(/מנהל(?:ת)?(?:\s+קרן|\s+קרנות)?/g,' ');
    remaining=remaining.replace(/(?:^|\s)(?:אני|מחפש|מחפשת|רוצה|קרן|קרנות|של|עם|שהיא|שהן|לי|בבקשה|להשקיע|השקעה)(?=\s|$)/g,' ').replace(/\s+/g,' ').trim();
    if (duration) remaining = remaining.replace(duration[0], '').replace(/שנים/g, '');
    if (longDuration) remaining = remaining.replace(/מחמ\s*ארו[ךכ](?:ה|ות|ים)?/, '');
    return {raw, text, ratings, fee, currency, managers, unsupported, mixed, cashType, tokens: remaining.trim().split(/\s+/).filter(Boolean), duration: duration ? Number(duration[2]) : null,
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
    if(p.cashType){const currency=norm(f.currency),name=norm(f.name),usd=/דולר|\$|\busd\b/.test(norm(f.name));const fits=p.cashType==='ils'?(currency==='שקל'||/(?:^|\s)שקלית(?=\s|$)/.test(name)):p.cashType==='fx'?currency==='חשופה':row.denomination==='כן'&&usd;if(!fits)return {matched:false,score:0};}
    if(p.mixed){const ratios=[...nameText.matchAll(/(\d{1,2})\s*\/\s*(\d{1,2})/g)];const exposure=nameText.match(/עד\s*(\d+(?:\.\d+)?)\s*%\s*מניות/);if(!/מעורב/.test(norm(f.category))&&!ratios.some(r=>Number(r[1])+Number(r[2])===100)&&!(exposure&&Number(exposure[1])>0&&Number(exposure[1])<100))return {matched:false,score:0};}
    if(p.unsupported)return {matched:false,score:0};
    if(p.managers?.length&&!p.managers.includes(manager))return {matched:false,score:0};
    if(p.currency){const actual=norm(f.currency);if(actual!==norm(p.currency))return {matched:false,score:0};}
    if(p.fee){if(!Number.isFinite(row.fee))return {matched:false,score:0};const v=row.fee,t=p.fee.value,m=p.fee.mode;const fits=['עד','לכל היותר','לא יותר מ'].includes(m)?v<=t:['מתחת ל','פחות מ'].includes(m)?v<t:m==='מעל'?v>t:m==='לפחות'?v>=t:Math.abs(v-t)<1e-9;if(!fits)return {matched:false,score:0};}
    if(p.ratings?.length){if(!Number.isFinite(row.discountRating)||!p.ratings.includes(row.discountRating))return {matched:false,score:0};reason='דירוג דיסקונט היסטורי: '+row.discountRating;}
    if (p.duration !== null || p.longDuration) {
      const d = durationOf(f);
      if (p.duration !== null) {
        if (!d) return {matched: false, score: 0};
        const fits = p.durationMode === 'בדיוק' ? Math.abs(d.value - p.duration) < 0.001
          : p.durationMode === 'לפחות' ? d.value >= p.duration
          : p.durationMode === 'מעל' ? d.value > p.duration : p.durationMode === 'עד' ? d.value <= p.duration : p.durationMode === 'מתחת ל' ? d.value < p.duration : Math.abs(d.value - p.duration) <= 1;
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
      if(token==='ratio20'){
        if(!/(?:80\s*\/\s*20|20\s*\/\s*80)/.test(nameText)&&!/עד\s*20\s*%?\s*מניות/.test(nameText+' '+policyText))return {matched:false,score:0};reason='יחס 80/20 או עד 20% מניות לפי הנתונים';score+=40;
      } else if (/^ratio\d+$/.test(token)&&token!=='ratio10'){const cap=Number(token.slice(5)),ratios=[...nameText.matchAll(/(\d{1,2})\s*\/\s*(\d{1,2})/g)];if(!ratios.some(r=>Number(r[1])+Number(r[2])===100&&Math.min(Number(r[1]),Number(r[2]))===cap))return {matched:false,score:0};reason='הרכב '+(100-cap)+'/'+cap+' מפורש';score+=40;
      } else if (token === 'ratio10') {
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
  function describe(query){const p=parse(query),parts=[];if(p.unsupported)parts.push('נדרש נתון שאינו נתמך בחיפוש');if(p.cashType)parts.push('סוג כספית: '+({ils:'שקלית',fx:'חשופת מט״ח',usd:'נקובה בדולר'}[p.cashType]));if(p.mixed)parts.push('קרנות מעורבות לפי סיווג או הרכב מפורש');if(p.managers.length)parts.push('מנהל: '+p.managers.join(' או '));if(p.ratings.length)parts.push('דירוג דיסקונט: '+p.ratings.join(' או '));if(p.fee)parts.push('דמי ניהול '+p.fee.mode+' '+p.fee.value+'%');if(p.currency)parts.push('סיווג מטבעי: '+p.currency);if(p.duration!==null)parts.push('מח״מ '+p.durationMode+' '+p.duration);if(p.longDuration)parts.push('מח״מ ארוך מפורש');if(p.tokens.length)parts.push('מאפייני חיפוש: '+p.tokens.map(x=>/^ratio\d+$/.test(x)?(100-Number(x.slice(5)))+'/'+Number(x.slice(5)):x).join(' · '));return parts.join(' · ');}
  function conditions(query){const p=parse(query),out=[];const add=(id,label,query)=>out.push({id,label,query});if(p.cashType)add('cashType',({ils:'שקלית',fx:'חשופת מט״ח',usd:'נקובה בדולר'}[p.cashType]),({ils:'שקלית',fx:'חשופה מטח',usd:'נקובה בדולר'}[p.cashType]));if(p.mixed)add('mixed','קרנות מעורבות','מעורבות');if(p.managers.length)add('managers','מנהל: '+p.managers.join(' או '),p.managers.join(' '));if(p.ratings.length)add('ratings','דירוג '+p.ratings.join(' או '),'דירוג '+p.ratings.join(','));if(p.fee)add('fee','דמי ניהול '+p.fee.mode+' '+p.fee.value+'%','דמי ניהול '+p.fee.mode+' '+p.fee.value);if(p.currency)add('currency',p.currency==='דולר'?'נקובה בדולר':p.currency+' מט״ח',p.currency==='דולר'?'נקובה בדולר':p.currency+' מטח');if(p.duration!==null)add('duration','מח״מ '+p.durationMode+' '+p.duration,'מחמ '+p.durationMode+' '+p.duration);if(p.longDuration)add('longDuration','מח״מ ארוך','מחמ ארוך');if(p.tokens.length){const q=p.tokens.map(x=>/^ratio\d+$/.test(x)?(100-Number(x.slice(5)))+'/'+Number(x.slice(5)):x).join(' ');add('text',q,q)}return out;}
  const api = {norm, fields, parse, match, durationOf, setCatalog, describe, conditions};
  host.FundSearch = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
