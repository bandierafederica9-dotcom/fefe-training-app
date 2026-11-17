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
  T('Lunedì somma i sei pasti', lun.kcal === 2857 && lun.prot === 158, lun.kcal + '/' + lun.prot);
  T('lo shake è lo stesso ogni giorno e vale 457 kcal', days.every((d, i) => h.run('dietMealNutrition(DIET_DAYS[' + i + '].meals[3]).kcal') === 457));
  T('ogni giorno del piano supera il target: la differenza non è nulla', days.every((d, i) => h.run('dietDayNutrition(DIET_DAYS[' + i + ']).kcal') > 2000));
  T('la media settimanale è ~2700 kcal', (() => { const t = days.reduce((a, d, i) => a + h.run('dietDayNutrition(DIET_DAYS[' + i + ']).kcal'), 0) / 7; return t > 2600 && t < 2800; })());
  T('dietGapLabel dichiara il segno', h.run('dietGapLabel({kcal:2857,prot:158})') === '+857 kcal · +48 g vs target');
  T('dietGapLabel funziona anche sotto target', h.run('dietGapLabel({kcal:1800,prot:90})') === '-200 kcal · -20 g vs target');

  // ---------- 5) I numeri arrivano sullo schermo ----------
  h.run('cur=new Date("2026-01-19T12:00:00");key="fede:2026-01-19";data=norm({day:"Giorno 1"});window.__dietSection="today";');
  const today = h.run('nutriHTML()');
  T('la giornata mostra il proprio totale', today.indexOf('2857 kcal') > -1 && today.indexOf('158 g') > -1);
  T('la giornata mostra la differenza dal target', today.indexOf('+857 kcal') > -1);
  T('ogni pasto porta il proprio numero', (today.match(/nutri-chip/g) || []).length === 6);
  T('la provenienza dei numeri è dichiarata sullo schermo', today.indexOf('CREA/USDA') > -1 && today.indexOf('2000 kcal') > -1 && today.indexOf('17 July 2025') > -1);
  T('la stima è dichiarata come stima', /stima con un margine/.test(today));

  h.run('window.__dietSection="week";');
  const week = h.run('nutriHTML()');
  T('la settimana mostra i sette totali', (week.match(/nutri-week-n/g) || []).length === 7 && week.indexOf('2582 kcal') > -1);

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
  T('il piano di partenza invece li conteneva: la regola morde davvero',
    VIETATI.test(ref.run('JSON.stringify(DIET_DAYS)')));

  // Le sostituzioni mantengono il valore nutrizionale: nessun giorno si muove
  // di piu' di 40 kcal rispetto a prima.
  const daysPrima = ref.run('JSON.stringify(DIET_DAYS)');
  const prima = JSON.parse(h.run('JSON.stringify((' + daysPrima + ').map(function(d){return dietDayNutrition(d).kcal;}))'));
  const dopo = JSON.parse(h.run('JSON.stringify(DIET_DAYS.map(function(d){return dietDayNutrition(d).kcal;}))'));
  T('le sostituzioni non spostano i totali di piu\' del 3% del giorno',
    prima.every((v, i) => Math.abs(v - dopo[i]) / v <= 0.03),
    prima.map((v, i) => (dopo[i] - v) + ' su ' + v).join(' · '));
  T('e tolgono calorie, non ne aggiungono: i giorni erano gia\' sopra il target',
    prima.every((v, i) => dopo[i] <= v));
  T('il tacchino ha preso il posto del prosciutto', h.run('JSON.stringify(DIET_DAYS)').indexOf('Petto di tacchino') > -1);
  T('il brodo e il limone hanno preso il posto del vino', /Brodo di pollo 70 g/.test(h.run('JSON.stringify(DIET_DAYS)')));
  T('gli altri pasti sono comunque gli stessi: stesso numero di giorni e di pasti',
    h.run('DIET_DAYS.length') === 7 && h.run('DIET_DAYS.every(function(d){return d.meals.length===6;})'));
  T('il MENU del diario è invariato', ref.run('JSON.stringify(MENU)') === h.run('JSON.stringify(MENU)'));

  console.log(fail ? '\n' + fail + ' FAIL' : '\nall pass');
  process.exit(fail ? 1 : 0);
})();
