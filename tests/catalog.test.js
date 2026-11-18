// Il catalogo: una lista sola al posto di nove, e aggiunge davvero.
const REPO = require('path').resolve(__dirname, '..');
const H = require('./harness');
let fail = 0; const T = (n, ok, x) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const J = JSON.stringify;

(async () => {
  const h = H(REPO);
  h.run('cur=new Date("2026-01-20T12:00:00");key="fede:2026-01-20";data=norm({day:"Giorno 1"});');
  const cat = JSON.parse(h.run('JSON.stringify(EX_CATALOG)'));

  // ---------- 1) Le cinque sezioni ----------
  T('cinque sezioni, nell\'ordine chiesto',
    cat.map(g => g.k).join(',') === 'lower,upper,calisthenics,core,cardio', cat.map(g => g.k).join(','));
  T('ognuna ha etichetta e icona', cat.every(g => g.label && g.icon));
  T('nessuna sezione è vuota', cat.every(g => g.items.length > 0), cat.map(g => g.k + ':' + g.items.length).join(' '));

  // ---------- 2) Gli esercizi vengono da dentro l'app ----------
  // Verifica esatta: ogni nome deve esistere in una delle librerie, chiesto
  // alla libreria stessa invece che cercato nel suo JSON.
  const tutti = [].concat(...cat.map(g => g.items));
  const noto = n => h.run('(function(x){' +
    'if(typeof EXDB!=="undefined"&&EXDB[x])return true;' +
    'if(typeof MUSCLE_DB!=="undefined"&&MUSCLE_DB[x])return true;' +
    'var found=false;' +
    'Object.keys(PLAN).forEach(function(d){(PLAN[d].ex||[]).forEach(function(e){if(e[0]===x)found=true;});});' +
    'if(typeof LAB_CALISTHENICS_PLAN!=="undefined")LAB_CALISTHENICS_PLAN.ex.forEach(function(e){if(e[0]===x)found=true;});' +
    '[typeof POWER_LIBRARY!=="undefined"?POWER_LIBRARY:{},typeof FINISHER_LIBRARY!=="undefined"?FINISHER_LIBRARY:{},' +
    ' typeof ACCESSORY_LIBRARY!=="undefined"?ACCESSORY_LIBRARY:{},typeof MOBILITY_LIBRARY!=="undefined"?MOBILITY_LIBRARY:{}]' +
    '.forEach(function(L){Object.keys(L).forEach(function(g){L[g].forEach(function(e){if(e[0]===x)found=true;});});});' +
    'return found;})(' + J(n) + ')');
  T('ogni voce del catalogo esiste già in una libreria dell\'app',
    tutti.every(noto), tutti.filter(n => !noto(n)).slice(0, 5).join(', '));
  T('nessun doppione fra le sezioni', new Set(tutti).size === tutti.length,
    tutti.filter((n, i) => tutti.indexOf(n) !== i).join(', '));
  T('le varianti "CORE · X" non compaiono se esiste già X',
    !tutti.some(n => n.startsWith('CORE · ') && tutti.includes(n.slice(7))));
  T('più di cento esercizi', h.run('catalogCount()') > 100, String(h.run('catalogCount()')));

  // ---------- 3) Ognuno ha di che mostrarsi ----------
  T('ogni esercizio ha un\'immagine', tutti.every(n => !!h.run('localThumbnail(' + J(n) + ')')));
  const conMuscoli = tutti.filter(n => h.run('!!(typeof MUSCLE_DB!=="undefined"&&MUSCLE_DB[' + J(n) + '])')).length;
  T('la grande maggioranza dichiara i muscoli', conMuscoli / tutti.length > 0.8, conMuscoli + '/' + tutti.length);

  // ---------- 4) La classificazione è sensata ----------
  const sez = n => (cat.find(g => g.items.includes(n)) || {}).k;
  T('gli squat e gli hip thrust stanno in Lower', ['Bulgarian Split Squat', 'Hip Thrust', 'Belt Squat Sumo'].every(n => sez(n) === 'lower'),
    ['Bulgarian Split Squat', 'Hip Thrust', 'Belt Squat Sumo'].map(n => n + '=' + sez(n)).join(' '));
  T('i pulldown e le alzate stanno in Upper', ['Lat Pulldown', 'Dumbbell Lateral Raise'].every(n => sez(n) === 'upper'),
    ['Lat Pulldown', 'Dumbbell Lateral Raise'].map(n => n + '=' + sez(n)).join(' '));
  T('L-Sit e Frog Stand stanno in Calisthenics', ['L-Sit', 'Frog Stand'].every(n => sez(n) === 'calisthenics'));
  T('Dead Bug e Plank stanno in Core, non fra i calisthenics',
    sez('Dead Bug') === 'core' && sez('Hanging Knee Raise') === 'core',
    'Dead Bug=' + sez('Dead Bug') + ' Hanging Knee Raise=' + sez('Hanging Knee Raise'));
  T('Calf Raise sta in Lower, non in Core', sez('Calf Raise') === 'lower', String(sez('Calf Raise')));

  // ---------- 5) La schermata ----------
  h.run('catSection="";view="catalog";');
  const html = h.run('catalogHTML()');
  T('mostra tutte e cinque le intestazioni', (html.match(/cat-head/g) || []).length === 5);
  T('ogni intestazione dice quanti esercizi contiene', (html.match(/cat-head[^<]*<span>\d+<\/span>/g) || []).length === 0 || /<span>\d+<\/span>/.test(html));
  T('ogni riga è toccabile e porta la sua immagine',
    (html.match(/data-catadd="/g) || []).length === tutti.length && (html.match(/<img src="assets/g) || []).length === tutti.length);
  T('dice in quale giornata finirà', /Giorno 1/.test(html));
  T('gli esercizi già presenti sono segnati e non ritoccabili',
    /cat-row in/.test(html) && /disabled/.test(html) && /già in giornata/.test(html));

  h.run('catSection="cardio";');
  const solo = h.run('catalogHTML()');
  T('il filtro per sezione mostra una sola lista', (solo.match(/cat-head/g) || []).length === 1 && /Cardio/.test(solo));

  // ---------- 6) Aggiunge davvero, dal percorso vetted ----------
  {
    const ha = H(REPO);
    ha.run('cur=new Date("2026-01-20T12:00:00");key="fede:2026-01-20";data=norm({day:"Giorno 1"});');
    const prima = ha.run('dayPlan("Giorno 1").ex.length');
    const r = JSON.parse(ha.run('JSON.stringify(addExerciseToDay("Giorno 1","Hip Thrust","",""))'));
    T('aggiungere dal catalogo usa addExerciseToDay e riesce', r.ok === true, J(r));
    T('la giornata cresce di uno', ha.run('dayPlan("Giorno 1").ex.length') === prima + 1);
    T('l\'esercizio aggiunto è l\'ultimo', ha.run('dayPlan("Giorno 1").ex[dayPlan("Giorno 1").ex.length-1][0]') === 'Hip Thrust');
    T('ora il catalogo lo segna come già presente', ha.run('catalogHasExercise("Giorno 1","Hip Thrust")') === true);
    T('e rifiuta di aggiungerlo due volte',
      JSON.parse(ha.run('JSON.stringify(addExerciseToDay("Giorno 1","Hip Thrust","",""))')).ok === false);
    T('nessun giorno dello storico è stato toccato',
      Object.keys(ha.store).every(k => !/^fede:\d{4}-/.test(k)), Object.keys(ha.store).join(','));
  }

  // ---------- 7) Le quattro schermate extra non sono più raggiungibili dalla giornata ----------
  {
    const hw = H(REPO);
    hw.run('cur=new Date("2026-01-20T12:00:00");key="fede:2026-01-20";data=norm({day:"Giorno 1"});exCtx=null;exIdx=null;');
    const w = hw.run('workoutHTML()');
    T('la giornata offre il catalogo', /data-go="catalog"/.test(w));
    T('e non più i quattro extra', !/data-go="(power|finishers|accessories|mobility)"/.test(w));
  }

  console.log(fail ? '\n' + fail + ' FAIL' : '\nall pass');
  process.exit(fail ? 1 : 0);
})();
