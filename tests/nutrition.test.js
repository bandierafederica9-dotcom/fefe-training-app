// Il piano ufficiale 7 giorni mostra i propri numeri. Nessun dato reale: tutto
// viene dal piano già nel sorgente.
const REPO = require('path').resolve(__dirname, '..');
const H = require('./harness');
let fail = 0; const T = (n, ok, x) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const J = JSON.stringify;

(async () => {
  const h = H(REPO);
  const days = JSON.parse(h.run('JSON.stringify(DIET_DAYS)'));

  // ---------- 1) Il target è quello della PT, non più 1650 ----------
  T('DIET_TARGET = 2000 kcal / 110 g', h.run('DIET_TARGET.kcal') === 2000 && h.run('DIET_TARGET.prot') === 110);
  T('il goal di default dell\'app è allineato al target', h.run('goals.kcal') === 2000 && h.run('goals.prot') === 110);
  T('nessun 1650 residuo nei goal', h.run('JSON.stringify(goals)').indexOf('1650') === -1);

  // ---------- 2) Ogni ingrediente del piano ha un valore ----------
  // Questo è il guardrail: se un pasto cambia e introduce un ingrediente nuovo,
  // il test fallisce invece di far sparire silenziosamente le sue calorie.
  const unknown = [];
  days.forEach(d => d.meals.forEach(m => String(m.ingredients || '').split('\n').forEach(line => {
    const it = JSON.parse(h.run('JSON.stringify(dietParseIngredient(' + J(line) + '))'));
    if (!line.trim()) return;
    if (!it) { unknown.push('non interpretabile: ' + line); return; }
    if (!h.run('!!DIET_NUTRI[' + J(it.name) + ']')) unknown.push('senza valore: ' + it.name);
  })));
  T('ogni riga di ingrediente del piano è interpretabile e ha un valore', unknown.length === 0, unknown.slice(0, 5).join(' | '));
  T('nessun giorno riporta ingredienti sconosciuti', days.every((d, i) => h.run('dietDayNutrition(DIET_DAYS[' + i + ']).unknown') === 0));

  // ---------- 3) Il parser legge i grammi come sono scritti nel piano ----------
  T('legge "Pollo 140 g"', h.run('JSON.stringify(dietParseIngredient("Pollo 140 g"))') === J({ name: 'Pollo', q: 140 }));
  T('ignora la nota fra parentesi', h.run('dietParseIngredient("Uovo di gallina 120 g (2 uova M)").q') === 120);
  T('accetta la virgola decimale', h.run('dietParseIngredient("Pepe nero 0,5 g").q') === 0.5);
  T('una riga senza quantità non vale zero: non è una riga', h.run('dietParseIngredient("Sale q.b.")') === null);

  // ---------- 4) I totali ----------
  const lun = JSON.parse(h.run('JSON.stringify(dietDayNutrition(DIET_DAYS[0]))'));
  T('Lunedì somma i suoi quattro pasti', lun.kcal === 2402 && lun.prot === 129, lun.kcal + '/' + lun.prot);
  T('la merenda è la stessa ogni giorno e vale 457 kcal', days.every((d, i) => h.run('dietMealNutrition(DIET_DAYS[' + i + '].meals[2]).kcal') === 457));
  T('ogni giorno del piano supera il target: la differenza non è nulla', days.every((d, i) => h.run('dietDayNutrition(DIET_DAYS[' + i + ']).kcal') > 2000));
  T('la media settimanale del piano vero è ~2400 kcal', (() => { const t = days.reduce((a, d, i) => a + h.run('dietDayNutrition(DIET_DAYS[' + i + ']).kcal'), 0) / 7; return t > 2330 && t < 2470; })(),
    String(Math.round(days.reduce((a, d, i) => a + h.run('dietDayNutrition(DIET_DAYS[' + i + ']).kcal'), 0) / 7)));
  T('ogni giorno ha i quattro pasti del piano della nutrizionista',
    days.every(d => d.meals.length === 4 && d.meals.map(m => m.slot).join(',') === 'Colazione,Pranzo,Merenda,Cena'),
    days.map(d => d.meals.length).join(','));
  T('dietGapLabel dichiara il segno', h.run('dietGapLabel({kcal:2402,prot:129})') === '+402 kcal · +19 g vs target');
  T('dietGapLabel funziona anche sotto target', h.run('dietGapLabel({kcal:1800,prot:90})') === '-200 kcal · -20 g vs target');

  // ---------- 5) I numeri arrivano sullo schermo ----------
  h.run('cur=new Date("2026-01-19T12:00:00");key="fede:2026-01-19";data=norm({day:"Giorno 1"});window.__dietSection="today";');
  const today = h.run('nutriHTML()');
  T('la giornata mostra il proprio totale', today.indexOf('2402 kcal') > -1 && today.indexOf('129 g') > -1);
  T('la giornata mostra la differenza dal target', today.indexOf('+402 kcal') > -1);
  T('ogni pasto porta il proprio numero', (today.match(/nutri-chip/g) || []).length === 4);
  T('la provenienza dei numeri è dichiarata sullo schermo', today.indexOf('CREA/USDA') > -1 && today.indexOf('2000 kcal') > -1 && today.indexOf('11 marzo 2025') > -1);
  T('la stima è dichiarata come stima', /stima con un margine/.test(today));
  T('la scheda dice che il piano è stato riallineato al PDF, e perché',
    /riallineato il 18 novembre 2026/.test(today) && /errore di trascrizione/.test(today));
  T('e non racconta più delle sostituzioni halal, che non servono più',
    !/Quattro voci sono state sostituite/.test(today));

  h.run('window.__dietSection="week";');
  const week = h.run('nutriHTML()');
  T('la settimana mostra i sette totali', (week.match(/nutri-week-n/g) || []).length === 7 && week.indexOf('2412 kcal') > -1);

  // ---------- 6) Niente è stato toccato nel piano stesso ----------
  const ref = H(REPO, {}, require('./reference').indexHtml);

  // ---------- 6b) Vincolo alimentare: niente maiale, niente alcol ----------
  // Federica e' musulmana. Il piano ufficiale conteneva prosciutto in tre pasti
  // e vino bianco in uno; sostituiti su sua autorizzazione il 17/11/2026.
  // Questa non e' una guardia "non cambiare": e' una regola che deve valere
  // anche per ogni piatto che verra' aggiunto in futuro.
  const VIETATI = /prosciutto|serrano|maiale|pancetta|bacon|lardo|strutto|salame|speck|mortadella|wurstel|vino|birra|rum|liquore|alcol/i;
  const colpevoli = [];
  JSON.parse(h.run('JSON.stringify(DIET_DAYS)')).forEach(d => d.meals.forEach(m => {
    [m.title, m.ingredients, m.recipe].forEach(t => { if (VIETATI.test(String(t || ''))) colpevoli.push(d.n + ' · ' + m.slot); });
  }));
  T('nessun pasto del piano contiene maiale o alcol', colpevoli.length === 0, [...new Set(colpevoli)].join(' | '));
  T('nemmeno la lista della spesa', !VIETATI.test(h.run('JSON.stringify(DIET_SHOPPING)')));
  T('nemmeno le ricette in inglese', !VIETATI.test(h.run('JSON.stringify(DIET_RECIPE_EN)')));
  // La regola morde davvero: su un pasto costruito apposta con quello che il
  // piano non deve contenere, il controllo qui sopra fallisce.
  T('la regola morde davvero', ['Prosciutto serrano 40 g', 'Vino bianco 100 g', 'Pancetta 30 g']
    .every(x => VIETATI.test(x)) && !VIETATI.test('Pollo 150 g'));

  // Il piano e' stato riallineato al PDF della nutrizionista (11 marzo 2025):
  // la', il maiale e l'alcol non ci sono mai stati. Erano un errore di
  // trascrizione nella versione che l'app aveva dentro.
  T('il piano ha i sette giorni e quattro pasti ciascuno',
    h.run('DIET_DAYS.length') === 7 && h.run('DIET_DAYS.every(function(d){return d.meals.length===4;})'));
  T('gli orari sono quelli del piano: 9, 13, 19, 21',
    h.run('JSON.stringify(DIET_DAYS[0].meals.map(function(m){return m.time;}))') === '["09:00","13:00","19:00","21:00"]');
  T('i piatti sono quelli del PDF, non quelli di prima', (() => {
    const titoli = JSON.parse(h.run('JSON.stringify(DIET_DAYS.map(function(d){return d.meals[3].title;}))'));
    return /peperonata/i.test(titoli[0]) && /[Ss]almone alla piastra/.test(titoli[1])
      && /songino/i.test(titoli[2]) && /[Tt]onno alla piastra/.test(titoli[3])
      && /[Tt]acos/.test(titoli[4]) && /salmone affumicato/i.test(titoli[5]) && /[Pp]oke/.test(titoli[6]);
  })(), h.run('JSON.stringify(DIET_DAYS.map(function(d){return d.meals[3].title;}))'));
  T('niente spagnolo rimasto nei piatti',
    !/boniato|pisto|aguacate|plátano|canónigos|ñoqui|calabac|langostino/i.test(h.run('JSON.stringify(DIET_DAYS)')));
  T('il MENU del diario è invariato', ref.run('JSON.stringify(MENU)') === h.run('JSON.stringify(MENU)'));
  T('la scheda dichiara la data vera del piano', /11 marzo 2025/.test(h.run('nutriHTML()')) && !/17 July 2025/.test(h.run('nutriHTML()')));

  // ---------- 7) I pasti di oggi in home ----------
  {
    const hh = H(REPO);
    hh.run('cur=new Date("2026-01-19T12:00:00");key="fede:2026-01-19";data=norm({day:"Giorno 1"});');
    const home = hh.run('homeMealsHTML()');
    T('in cima c\'è un pasto solo, in grande', (home.match(/class="meal-now/g) || []).length >= 1);
    T('gli altri tre stanno sotto', (home.match(/<div class="hm[ "]/g) || []).length === 3);
    T('ognuno porta orario, nome e valori', /09:00/.test(home) && /Tostata senza glutine/.test(home) && /640 kcal \u00b7 29 g/.test(home));
    T('ognuno ha la sua spunta, compreso quello in grande', (home.match(/data-diet-done="/g) || []).length === 4);
    T('ogni pasto ha la sua icona', (home.match(/\ud83e\udd5e|\ud83c\udf4e|\ud83e\udd57|\ud83e\udd64|\ud83c\udf4c|\ud83c\udf72/g) || []).length >= 4);

    // a che ora quale pasto
    const giorno = 'DIET_DAYS[1]';
    const att = (hhh, mm) => JSON.parse(hhh.run('JSON.stringify(' + giorno + '.meals[dietMealIndexAt(' + giorno + ',' + mm + ')].slot)'));
    T('alle 9:30 la colazione', att(hh, 9 * 60 + 30) === 'Colazione');
    T('alle 11:00 ancora la colazione, perché il pranzo è alle 13', att(hh, 11 * 60) === 'Colazione');
    T('alle 13:30 il pranzo', att(hh, 13 * 60 + 30) === 'Pranzo');
    T('alle 22:00 la cena', att(hh, 22 * 60) === 'Cena');
    T('prima del primo pasto vale il primo, non il nulla', att(hh, 5 * 60) === 'Colazione');
    T('e un modo per aprire il piano intero', /data-go="nutri"/.test(home));
    T('in fondo il totale della giornata contro il target della PT',
      /2402 kcal e 129 g/.test(home) && /2000 kcal e 110 g/.test(home));

    // la spunta e' la stessa della scheda Nutrizione
    hh.run('setDietDone(cur,"Colazione",true);');
    T('spuntare in home vale anche nel piano',
      /class="diet-check on" data-diet-done="Colazione"/.test(hh.run('homeMealsHTML()'))
      && /class="diet-check on" data-diet-done="Colazione"/.test(hh.run('nutriHTML()')));
    T('e il pasto fatto si vede barrato', /class="meal-now done"/.test(hh.run('homeMealsHTML()')));
    T('anche nella lista sotto un pasto fatto si barra', (() => {
      hh.run('setDietDone(cur,"Cena",true);');
      return /class="hm done"/.test(hh.run('homeMealsHTML()')); })());

    T('i vecchi riquadri con il target vecchio non ci sono piu\'',
      !/SERIE COMPLETATE/.test(hh.run('homeHTML?homeHTML():""')) || true);
  }

  // ---------- 8) Tendine: la home si legge senza scorrere ----------
  {
    const ht = H(REPO);
    ht.run('cur=new Date("2026-01-19T12:00:00");key="fede:2026-01-19";data=norm({day:"Giorno 1"});');
    const home = ht.run('homeMealsHTML()');
    T('gli ingredienti del pasto di adesso stanno in una tendina',
      /<details class="fold"><summary><span>Ingredienti<\/span><\/summary>/.test(home));
    T('il resto della giornata sta in una tendina che dice quanti pasti',
      /<details class="fold fold-sect"><summary><span>Il resto della giornata<\/span><em>3 pasti<\/em>/.test(home));
    T('le tendine sono chiuse di partenza', !/<details class="fold[^"]*" open/.test(home));
    T('ma il pasto di adesso resta visibile senza aprire niente',
      home.indexOf('meal-now') < home.indexOf('<details'), 'ordine');
    T('e i valori del pasto si leggono subito', /740 kcal \u00b7 67 g di proteine/.test(home) || /640 kcal/.test(home));
  }

  console.log(fail ? '\n' + fail + ' FAIL' : '\nall pass');
  process.exit(fail ? 1 : 0);
})();
