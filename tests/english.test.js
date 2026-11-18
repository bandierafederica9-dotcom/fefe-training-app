// Inglese completo: con la lingua su EN nessuna schermata deve lasciare testo
// italiano a video. Dati sintetici, nessun dato reale.
const REPO = require('path').resolve(__dirname, '..');
const H = require('./harness');
let fail = 0; const T = (n, ok, x) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const J = JSON.stringify;

// Parole che in inglese non esistono: se restano, la schermata non e' tradotta.
// Niente "per", "come", "la": sono inglesi a loro volta.
const IT = /(?<![\p{L}\-])(il|lo|gli|dei|delle|degli|della|dello|nel|nella|nelle|dal|dalla|col|un|uno|una|che|non|sono|sei|hai|tuo|tua|tuoi|questo|questa|questi|queste|quando|dove|oggi|ieri|domani|giorno|giorni|giornata|settimana|settimane|serie|seduta|sedute|ripetizioni|peso|esercizio|esercizi|allenamento|pasto|pasti|piano|scheda|salva|aggiungi|togli|chiudi|apri|vedi|nessun|nessuna|ancora|senza|anche|tutti|tutte|ogni|oppure|quindi|mentre|prima|dopo|sopra|sotto|verdura|verdure|pollo|riso|uova|uovo|pane|olio|mela|cena|pranzo|colazione|merenda)(?![\p{L}\-])|[àèéìòù]/iu;

const strip = html => String(html)
  .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<textarea[\s\S]*?<\/textarea>/gi, ' ')      // contenuto dell'utente: mai tradotto
  .replace(/<[^>]*data-no-i18n[^>]*>[\s\S]*?<\/[a-z]+>/gi, ' ')
  .replace(/<[^>]+>/g, '\n')
  .replace(/&[a-z]+;|&#\d+;/gi, ' ');

(async () => {
  const seedStore = {};
  {   // otto sedute sintetiche: fanno parlare anche il coach
    const h0 = H(REPO);
    const ids = JSON.parse(h0.run('JSON.stringify(PLAN["Giorno 1"].ex.map(function(e){return e[4];}))'));
    ['2026-01-02','2026-01-05','2026-01-07','2026-01-09','2026-01-12','2026-01-14','2026-01-16','2026-01-19']
      .forEach(d => { const sets = {}; ids.forEach((id, i) => { for (let s = 1; s <= 3; s++) sets['Giorno 1|' + id + '|' + s] = { kg: String(20 + i), r: '8' }; });
        seedStore['fede:' + d] = J({ day: 'Giorno 1', sets }); });
  }

  const render = (lang, setup) => {
    const h = H(REPO, Object.assign({}, seedStore, { 'fede:lang': lang }));
    h.run('cur=new Date("2026-01-21T12:00:00");key="fede:2026-01-21";data=norm({day:"Giorno 1"});profile=getProfile();');
    if (setup) h.run(setup);
    return h;
  };

  // ---------- 1) Ogni schermata, in inglese, senza italiano ----------
  const SCHERMATE = [
    ['home', 'topHTML()+homeHTML()'], ['agenda', 'agendaHTML()'], ['warmup', 'warmupHTML()'], ['warmup giorno 3', 'data.day="Giorno 3";warmupHTML()'],
    ['workout', 'workoutHTML()'], ['esercizio', 'exIdx=1;exerciseHTML()'], ['diario', 'diarioHTML()'],
    ['video', 'videoHTML()'], ['coach', 'coachHTML()'], ['catalogo', 'catalogHTML()'],
    ['profilo', 'profileHTML()'], ['calisthenics', 'calisthenicsHTML()'], ['mobility', 'mobilityHTML()'],
    ['power', 'powerHTML()'], ['finishers', 'finishersHTML()'], ['accessori', 'accessoriesHTML()'],
    ['setup', 'setupStart();setupHTML()'],
    ['nutri oggi', 'window.__dietSection="today";nutriHTML()'],
    ['nutri settimana', 'window.__dietSection="week";nutriHTML()'],
    ['nutri ricette', 'window.__dietSection="recipes";nutriHTML()'],
    ['nutri spesa', 'window.__dietSection="shopping";nutriHTML()'],
    ['nutri allergeni', 'window.__dietSection="allergens";nutriHTML()'],
    ['nutri costruisci', 'window.__dietSection="build";buildSel={prot:"Pollo",carb:["Patata"],fat:["Olio di oliva"],veg:["Zucchine"]};nutriHTML()'],
    ['nutri diario', 'window.__dietSection="diary";nutriHTML()'],
    ['progressi andamento', 'evoTab="andamento";evoHTML()'],
    ['progressi metriche', 'evoTab="metriche";evoHTML()'],
    ['progressi carichi', 'evoTab="carichi";evoHTML()'],
    ['progressi obiettivi', 'evoTab="obiettivi";evoHTML()'],
    ['progressi backup', 'evoTab="backup";evoHTML()'],
    ['coach avvisi', 'coachNoticesHTML()'],
    ['barra in basso', 'navHTML()'],
    ['intestazione', 'topHTML()'],
  ];
  const residui = {};
  SCHERMATE.forEach(function ([nome, code]) {
    const h = render('en');
    let html; try { html = h.run(code); } catch (e) { T(nome + ': la schermata si disegna', false, String(e).slice(0, 90)); return; }
    // la traduzione vera, non una sua imitazione: la stessa i18nText dell'app
    const righe = strip(html).split('\n').map(x => x.trim()).filter(Boolean)
      .map(x => h.run('i18nText(' + J(x) + ')'))
      .filter(x => IT.test(x));
    if (righe.length) residui[nome] = righe.slice(0, 4);
    T(nome + ': tutto in inglese', righe.length === 0, righe.slice(0, 2).join(' | ').slice(0, 150));
  });

  // ---------- 2) L'italiano resta italiano ----------
  {
    const it = render('it'), en = render('en');
    T('in italiano la home resta italiana', /Il tuo allenamento|Oggi/.test(it.run('topHTML()+homeHTML()')));
    T('e le due lingue non danno lo stesso testo', it.run('profileHTML()') !== en.run('profileHTML()'));
    T('la lingua di sistema di default e\' italiano', H(REPO).run('getAppLanguage()') === 'it');
  }

  // ---------- 3) Le date seguono la lingua ----------
  {
    const it = render('it'), en = render('en');
    T('in italiano la data e\' italiana', it.run('fmtLong(new Date("2026-01-21T12:00:00"))').indexOf('gennaio') > -1,
      it.run('fmtLong(new Date("2026-01-21T12:00:00"))'));
    T('in inglese la data e\' inglese', /January/.test(en.run('fmtLong(new Date("2026-01-21T12:00:00"))')),
      en.run('fmtLong(new Date("2026-01-21T12:00:00"))'));
    T('il formato non e\' americano (21 January, non January 21)', /^\w+ 21 January$/.test(en.run('fmtLong(new Date("2026-01-21T12:00:00"))')),
      en.run('fmtLong(new Date("2026-01-21T12:00:00"))'));
  }

  // ---------- 4) Il dizionario non rovina i dati ----------
  {
    const h = render('en');
    T('tradurre non tocca il piano in memoria', h.run('PLAN["Giorno 1"].ex[0][0]') === 'Pull-up');
    T('le chiavi di salvataggio restano italiane', /^Giorno 1\|/.test(h.run('setKey("Giorno 1",0,PLAN["Giorno 1"].ex[0],1)')));
    T('il backup esce identico in inglese', (() => {
      const b = JSON.parse(h.run('JSON.stringify(buildBackupObject())'));
      return Object.keys(seedStore).every(k => b.localStorage[k] === seedStore[k]);
    })());
    T('nessuna voce del dizionario e\' vuota', (() => {
      const d = JSON.parse(h.run('JSON.stringify(APP_EN)'));
      return Object.keys(d).every(k => k && typeof d[k] === 'string' && d[k].length > 0);
    })());
    T('nessuna voce traduce in italiano', (() => {
      const d = JSON.parse(h.run('JSON.stringify(APP_EN)'));
      return Object.keys(d).filter(k => d[k] !== k && IT.test(d[k])).length === 0;
    })(), (() => { const d = JSON.parse(h.run('JSON.stringify(APP_EN)')); return Object.keys(d).filter(k => d[k] !== k && IT.test(d[k])).slice(0, 3).map(k => d[k]).join(' | '); })());
    T('le chiavi piu\' lunghe vengono sostituite per prime', (() => {
      const k = JSON.parse(h.run('JSON.stringify(APP_EN_KEYS())'));
      return k.every((x, i) => i === 0 || k[i - 1].length >= x.length);
    })());
  }

  // ---------- 5) Una passata sola: il tradotto non viene ritradotto ----------
  {
    const h = render('en');
    T('"Progressione" non diventa "Progresson"', h.run('i18nText("Progressione")') === 'Progression', h.run('i18nText("Progressione")'));
    T('la chiave piu\' lunga vince su quella corta che le sta dentro',
      h.run('i18nText("Progressi")') === 'Progress' && h.run('i18nText("Progressione")') === 'Progression');
    T('tradurre due volte non cambia il risultato', (() => {
      const uno = h.run('i18nText("Tonno alla piastra con peperonata e chips di patata")');
      return h.run('i18nText(' + J(uno) + ')') === uno;
    })());
    T('un testo gia\' inglese resta intatto', h.run('i18nText("Pull-up and Lat Pulldown")') === 'Pull-up and Lat Pulldown');
    T('una chiave non morde dentro una parola piu\' lunga',
      h.run('i18nText("Progression")') === 'Progression' && h.run('i18nText("Progressi")') === 'Progress',
      h.run('i18nText("Progression")'));
    T('ne\' attaccata a sinistra', h.run('i18nText("xxUova")') === 'xxUova', h.run('i18nText("xxUova")'));
    T('ma una parola intera viene tradotta anche fra la punteggiatura',
      h.run('i18nText("(Uova) · Pollo, Patata.")') === '(Eggs) \u00b7 Chicken, Potato.', h.run('i18nText("(Uova) · Pollo, Patata.")'));
    T('il testo vuoto non rompe niente', h.run('i18nText("")') === '' && h.run('i18nText(null)') === '');
  }

  if (Object.keys(residui).length) console.log('\nresidui:\n' + J(residui, null, 1));
  console.log(fail ? '\n' + fail + ' FAIL' : '\nall pass');
  process.exit(fail ? 1 : 0);
})();
