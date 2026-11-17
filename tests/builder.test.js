// "Costruisci la cena": porzioni calcolate dal piano, nessuna scrittura.
const REPO = require('path').resolve(__dirname, '..');
const H = require('./harness');
let fail = 0; const T = (n, ok, x) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const J = JSON.stringify;

(async () => {
  const h = H(REPO);
  h.run('cur=new Date("2026-01-21T12:00:00");key="fede:2026-01-21";data=norm({day:"Giorno 1"});window.__dietSection="build";');
  const roles = JSON.parse(h.run('JSON.stringify(BUILD_ROLES)'));
  const tot = (r, n) => JSON.parse(h.run('JSON.stringify(buildItemTotals(' + J(r) + ',' + J(n) + '))'));

  // ---------- 1) Solo alimenti del piano ----------
  const fuori = [];
  Object.keys(roles).forEach(r => roles[r].items.forEach(n => { if (!h.run('!!DIET_NUTRI[' + J(n) + ']')) fuori.push(r + ':' + n); }));
  T('ogni voce proposta esiste nel piano', fuori.length === 0, fuori.join(', '));
  T('niente maiale e niente alcol fra le voci',
    !/prosciutto|serrano|maiale|vino|birra/i.test(J(roles)));

  // ---------- 2) Le righe di una colonna si equivalgono ----------
  const prot = roles.prot.items.map(n => tot('prot', n).prot);
  T('ogni proteina porta circa 40 g di proteine', prot.every(v => Math.abs(v - 40) <= 2), prot.join(','));
  const carb = roles.carb.items.map(n => tot('carb', n).kcal);
  T('ogni carboidrato porta circa 230 kcal', carb.every(v => Math.abs(v - 230) <= 12), carb.join(','));
  const fat = roles.fat.items.map(n => tot('fat', n).kcal);
  T('ogni grasso porta circa 130 kcal', fat.every(v => Math.abs(v - 130) <= 12), fat.join(','));
  T('le verdure hanno tutte la stessa porzione', roles.veg.items.every(n => tot('veg', n).g === 200));

  // ---------- 3) Le porzioni sono pesabili ----------
  const tutte = [].concat(...Object.keys(roles).map(r => roles[r].items.map(n => tot(r, n).g)));
  T('le porzioni grandi sono arrotondate a 5 g, le piccole al grammo',
    tutte.every(g => g < 50 ? Number.isInteger(g) : g % 5 === 0), tutte.filter(g => g >= 50 && g % 5).join(','));
  T('nessuna porzione assurda', tutte.every(g => g >= 15 && g <= 450), tutte.filter(g => g < 15 || g > 450).join(','));
  T('il pollo torna 175 g', tot('prot', 'Pollo').g === 175);
  T('la patata torna 300 g', tot('carb', 'Patata').g === 300);
  T('l\'olio torna 15 g', tot('fat', 'Olio di oliva').g === 15);

  // ---------- 4) La scelta ----------
  h.run('buildSel={prot:"",carb: [],fat:[],veg:[]};buildGym=false;');
  h.run('buildToggle("prot","Pollo");buildToggle("prot","Manzo magro");');
  T('la proteina resta a scelta singola: la seconda sostituisce la prima', h.run('buildSel.prot') === 'Manzo magro');
  T('i carboidrati invece si sommano, perché una cena può averne due', (() => {
    h.run('buildSel.carb=[];buildToggle("carb","Patata");buildToggle("carb","Pane di mais");');
    return h.run('buildSel.carb.length') === 2; })());
  h.run('buildToggle("prot","Manzo magro");');
  T('ritoccare la stessa la deseleziona', h.run('buildSel.prot') === '');
  h.run('buildToggle("fat","Noci");buildToggle("fat","Olio di oliva");');
  T('i grassi sono a scelta multipla', h.run('buildSel.fat.length') === 2);
  h.run('buildToggle("fat","Noci");');
  T('e si tolgono uno per uno', h.run('JSON.stringify(buildSel.fat)') === J(['Olio di oliva']));

  // ---------- 5) I totali ----------
  h.run('buildSel={prot:"Manzo magro",carb: ["Patata"],fat:["Olio di oliva","Noci"],veg:["Melanzane","Funghi"]};');
  const t = JSON.parse(h.run('JSON.stringify(buildTotals())'));
  const atteso = ['prot|Manzo magro', 'carb|Patata', 'fat|Olio di oliva', 'fat|Noci', 'veg|Melanzane', 'veg|Funghi']
    .reduce((a, k) => { const [r, n] = k.split('|'); const x = tot(r, n); return { kcal: a.kcal + x.kcal, prot: a.prot + x.prot }; }, { kcal: 0, prot: 0 });
  T('il totale è la somma delle righe scelte', t.kcal === atteso.kcal && t.prot === atteso.prot, J(t) + ' vs ' + J(atteso));
  T('una cena così sta intorno alle 850 kcal', t.kcal > 780 && t.kcal < 920, String(t.kcal));
  T('e supera le 50 g di proteine', t.prot >= 50, String(t.prot));

  // ---------- 6) Il consiglio dice la cosa giusta ----------
  h.run('buildGym=true;buildSel={prot:"Manzo magro",carb:["Patata","Riso basmati crudo"],fat:["Olio di oliva"],veg:["Melanzane"]};');
  T('con le porzioni giuste dice che la cena è completa',
    h.run('buildAdviceText()') === 'Cena completa per un giorno di palestra.', h.run('buildAdviceText()'));
  h.run('buildSel={prot:"",carb: [],fat:[],veg:[]};');
  T('a mani vuote spiega come si usa, in porzioni', /una porzione per colonna/i.test(h.run('buildAdviceText()')), h.run('buildAdviceText()'));
  h.run('buildSel={prot:"",carb: ["Patata"],fat:[],veg:[]};');
  T('senza proteina lo dice subito, contando in porzioni',
    /Manca 1 proteina/.test(h.run('buildAdviceText()')), h.run('buildAdviceText()'));
  h.run('buildGym=false;buildSel={prot:"Tonno al naturale",carb: [],fat:[],veg:[]};');
  T('quel che manca lo elenca in porzioni, una per una',
    h.run('buildAdviceText()') === 'Per una sera normale aggiungi: +1 carboidrato, +1 grasso, +1 verdura.', h.run('buildAdviceText()'));
  h.run('buildSel={prot:"Uova",carb:["Patata"],fat:["Olio di oliva","Noci","Avocado"],veg:["Zucchine"]};buildGym=false;');
  T('e quel che avanza allo stesso modo',
    h.run('buildAdviceText()') === 'Più ricca del necessario: togli −2 grassi.', h.run('buildAdviceText()'));
  T('il plurale è giusto: 2 grassi, non 2 grasso', /2 grassi/.test(h.run('buildAdviceText()')));
  T('e al singolare resta singolare', (() => {
    h.run('buildSel={prot:"Uova",carb:["Patata"],fat:["Olio di oliva","Noci"],veg:["Zucchine"]};');
    return /1 grasso(?!i)/.test(h.run('buildAdviceText()')); })(), h.run('buildAdviceText()'));

  // ---------- 7) Il bersaglio cambia col giorno ----------
  h.run('buildGym=false;'); const n1 = JSON.parse(h.run('JSON.stringify(buildTarget())'));
  h.run('buildGym=true;'); const g1 = JSON.parse(h.run('JSON.stringify(buildTarget())'));
  T('il giorno di palestra chiede una porzione in più, non calorie astratte',
    g1.carb === n1.carb + 1 && g1.prot === n1.prot, J(n1) + ' -> ' + J(g1));

  // ---------- 8) Costruire non scrive; salvare sì, ed è l'unico che scrive ----------
  const giorniPrima = Object.keys(h.store).filter(k => /^fede:\d{4}-/.test(k)).length;
  h.run('buildHTML();buildToggle("veg","Broccoli");buildHTML();buildTotals();buildAdviceText();buildDish();');
  T('scegliere e guardare la ricetta non tocca nessun giorno',
    Object.keys(h.store).filter(k => /^fede:\d{4}-/.test(k)).length === giorniPrima);
  T('l\'unica cosa che scrive \u00e8 la cena in costruzione',
    Object.keys(h.store).every(k => /^fede:\d{4}-/.test(k) || k === 'fede:build' || k === 'fede:profile'),
    Object.keys(h.store).join(','));

  {
    const hs = H(REPO);
    hs.run('cur=new Date("2026-01-21T12:00:00");key="fede:2026-01-21";data=norm({day:"Giorno 1"});');
    T('senza proteina non si salva', JSON.parse(hs.run('JSON.stringify(buildSaveToDiary())')).ok === false);
    hs.run('buildSel={prot:"Manzo magro",carb: ["Patata"],fat:["Olio di oliva"],veg:["Melanzane"]};');
    const r = JSON.parse(hs.run('JSON.stringify(buildSaveToDiary())'));
    T('salva una voce per ingrediente', r.ok === true && r.n === 4, J(r));
    const cena = JSON.parse(hs.run('JSON.stringify(data.food.Cena)'));
    T('ogni voce porta nome, grammi, kcal e proteine nei campi giusti',
      cena.length === 4 && cena.every(v => v.n && !/\d+ g$/.test(v.n) && v.g > 0
        && typeof v.kcal === 'number' && typeof v.p === 'number'), J(cena[0]));
    T('i grammi stanno nel campo grammi, non nascosti nel nome',
      cena[0].n === 'Manzo magro' && cena[0].g === 190, J(cena[0]));
    T('i totali del diario corrispondono alla ricetta',
      JSON.parse(hs.run('JSON.stringify(tot(data))')).kc === JSON.parse(hs.run('JSON.stringify(buildTotals())')).kcal);
    T('finisce nella cena, non in un pasto a caso',
      hs.run('(data.food.Colazione||[]).length') === 0 && hs.run('(data.food.Pranzo||[]).length') === 0);
    hs.run('doSaveNow&&doSaveNow();');
    T('una volta scaricato, il salvataggio finisce nel giorno corrente',
      Object.keys(hs.store).some(k => k === 'fede:2026-01-21'), Object.keys(hs.store).join(','));
    T('e il giorno riletto contiene la cena',
      (JSON.parse(hs.store['fede:2026-01-21'] || '{}').food || {}).Cena.length === 4);
    T('e non tocca nessun altro giorno', Object.keys(hs.store).filter(k => /^fede:\d{4}-/.test(k)).length === 1);
    // salvare due volte aggiunge, non sostituisce: il diario e' un registro
    hs.run('buildSaveToDiary();');
    T('un secondo salvataggio aggiunge invece di sovrascrivere', hs.run('data.food.Cena.length') === 8);
  }

  // ---------- 9) La schermata ----------
  h.run('buildGym=false;buildSel={prot:"Pollo",carb:["Riso basmati crudo"],fat:["Olio di oliva"],veg:["Zucchine"]};');
  const html = h.run('buildHTML()');
  T('mostra gli ingredienti scelti dentro la ricetta', /Ingredienti/.test(html) && /Pollo/.test(html) && /175 g/.test(html));
  T('in cima mostra la cena contata in porzioni', /La tua cena/.test(html) && /1 proteina/.test(html));
  T('e accanto il bersaglio in porzioni', /per una sera normale: 1 proteina/.test(html));
  T('le calorie restano come riferimento, non come bersaglio', /di riferimento/.test(html));
  T('ogni ingrediente porta la sua etichetta di porzione', (html.match(/class="build-tag"/g) || []).length === 4);
  T('ogni riga è un pulsante grande', (html.match(/class="build-row/g) || []).length === Object.keys(roles).reduce((a, r) => a + roles[r].items.length, 0));
  T('dichiara da dove vengono le porzioni', /valori del piano/.test(html));
  T('la scheda dichiara per quante persone sono i grammi', /sono per una persona/.test(html));
  T('la lista degli ingredienti non e\' piu\' duplicata fuori dalla ricetta',
    (html.match(/Ingredienti/g) || []).length === 1 && !/Il tuo piatto/.test(html));
  const nutri = h.run('nutriHTML()');
  T('la scheda è raggiungibile dalla nutrizione', /data-diet-section="build"/.test(nutri));

  // ---------- 10) Dalla scelta al piatto ----------
  const dish = sel => { h.run('buildSel=' + J(sel) + ';'); return JSON.parse(h.run('JSON.stringify(buildDish())')); };
  T('senza proteina non propone nessun piatto', h.run('buildSel={prot:"",carb: ["Patata"],fat:[],veg:[]};buildDish()') === null);
  T('ma lo dice invece di mostrare il vuoto', (() => {
    h.run('buildSel={prot:"",carb: ["Patata"],fat:[],veg:["Melanzane"]};');
    const v = h.run('buildDishHTML()');
    return /Che cena fare/.test(v) && /Scegli una <b>proteina<\/b>/.test(v);
  })());

  const d1 = dish({ prot: 'Manzo magro', carb: ['Patata'], fat: ['Olio di oliva', 'Noci'], veg: ['Melanzane', 'Funghi'] });
  T('il nome dice come si cuoce, non elenca la spesa',
    d1.titolo === 'Padellata di manzo con melanzane e funghi, patata al forno', d1.titolo);
  T('il nome perde le parole da etichetta (magro, fresco, al naturale, petto di)', (() => {
    const n = [
      dish({ prot: 'Petto di tacchino', carb: [], fat: [], veg: [] }).titolo,
      dish({ prot: 'Bacca\u006c\u00e0 fresco', carb: [], fat: [], veg: [] }).titolo,
      dish({ prot: 'Tonno al naturale', carb: [], fat: [], veg: [] }).titolo].join(' | ');
    return !/magro|fresco|al naturale|Petto di/.test(n); })());
  T('ogni tipo di proteina ha la sua forma', (() => {
    const f = k => dish({ prot: k, carb: [], fat: [], veg: [] }).titolo;
    return /^Padellata di/.test(f('Manzo magro')) && /alla piastra$/.test(f('Pesce spada'))
      && /^Uova in padella$/.test(f('Uova')) && /^Saltato di/.test(f('Tofu'))
      && /^Insalata di/.test(f('Tonno al naturale')); })());
  T('i passi citano le grammature scelte', /190 g/.test(J(d1.passi)) && /300 g/.test(J(d1.passi)));
  T('la carne si sigilla, non si lessa', /sigillarlo/.test(J(d1.passi)));
  T('le noci vanno a crudo, non in padella', /Noci 20 g: a crudo/.test(J(d1.passi)));

  const d2 = dish({ prot: 'Uova', carb: ['Patata dolce'], fat: [], veg: ['Peperone rosso'] });
  T('con le uova il metodo cambia: conche e coperchio', /conche/.test(J(d2.passi)) && /Coperchio/.test(J(d2.passi)));

  const d3 = dish({ prot: 'Tonno al naturale', carb: ['Ceci cotti'], fat: ['Olio di oliva'], veg: ['Lattuga'] });
  T('il tonno in scatola non si cuoce', /non cuocerlo/.test(J(d3.passi)));
  T('e i ceci non finiscono in forno', !/Forno/.test(J(d3.passi)));

  const d4 = dish({ prot: 'Bacca\u006c\u00e0 fresco', carb: ['Riso basmati crudo'], fat: [], veg: ['Broccoli'] });
  T('il pesce si fa per lato', /per lato/.test(J(d4.passi)));
  T('nel titolo il riso si legge come a tavola, senza "crudo"',
    /riso basmati(?! crudo)/.test(d4.titolo) && !/crudo/.test(d4.titolo), d4.titolo);

  const d5 = dish({ prot: 'Tofu', carb: [], fat: [], veg: [] });
  T('il tofu si rosola', /rosolato/.test(J(d5.passi)));
  T('senza contorni resta comunque un piatto', d5.passi.length >= 1 && !!d5.titolo);

  // lo stesso tipo si cucina allo stesso modo
  const pollo = dish({ prot: 'Pollo', carb: [], fat: [], veg: [] });
  const tacchino = dish({ prot: 'Petto di tacchino', carb: [], fat: [], veg: [] });
  T('due carni diverse condividono il metodo', pollo.passi[0].replace(/Pollo \d+ g/, 'X') === tacchino.passi[0].replace(/Petto di tacchino \d+ g/, 'X'));

  T('ogni proteina del costruttore sa come si cucina',
    JSON.parse(h.run('JSON.stringify(BUILD_ROLES.prot.items)')).every(n => !!h.run('buildKind(' + J(n) + ')')),
    JSON.parse(h.run('JSON.stringify(BUILD_ROLES.prot.items)')).filter(n => !h.run('buildKind(' + J(n) + ')')).join(','));

  h.run('buildSel={prot:"Pollo",carb: ["Patata"],fat:[],veg:["Zucchine"]};');
  const dishHtml = h.run('buildDishHTML()');
  T('si legge come una ricetta: nome, resa, ingredienti, procedimento',
    /La ricetta di stasera/.test(dishHtml) && /Ingredienti/.test(dishHtml)
    && /Procedimento/.test(dishHtml) && (dishHtml.match(/<li>/g) || []).length >= 3);
  T('la resa e\' dichiarata a persona', /kcal \u00b7 \d+ g di proteine \u00b7 a persona/.test(dishHtml), (dishHtml.match(/build-dish-meta">[^<]*/) || [''])[0]);
  T('gli ingredienti portano le grammature', /<b>300 g<\/b>/.test(dishHtml));
  T('dichiara per quante persone sono i grammi, invece di dire "raddoppia"',
    /I grammi qui sopra sono per una persona/.test(dishHtml) && !/raddoppia/.test(dishHtml), (dishHtml.match(/In porzioni[^<]*/) || [''])[0]);

  // ---------- 11) Per quante persone ----------
  {
    const hp = H(REPO);
    hp.run('cur=new Date("2026-01-21T12:00:00");key="fede:2026-01-21";data=norm({day:"Giorno 1"});');
    hp.run('buildSel={prot:"Manzo magro",carb:["Patata"],fat:["Olio di oliva"],veg:["Melanzane"]};buildGym=false;buildPeople=1;');
    const uno = JSON.parse(hp.run('JSON.stringify(buildTotals())'));
    const g1 = hp.run('buildGramsFor("prot","Manzo magro")');
    hp.run('buildPeople=3;');
    T('i grammi si moltiplicano per le persone', hp.run('buildGramsFor("prot","Manzo magro")') === g1 * 3);
    T('kcal e proteine restano a testa: il bersaglio \u00e8 suo, non della tavola',
      J(JSON.parse(hp.run('JSON.stringify(buildTotals())'))) === J(uno));
    T('le porzioni contate non cambiano con le persone',
      hp.run('buildCountsText()') === '1 proteina \u00b7 1 carboidrato \u00b7 1 grasso \u00b7 1 verdura');
    T('e nemmeno il consiglio', /Cena completa/.test(hp.run('buildAdviceText()')), hp.run('buildAdviceText()'));

    const passi = JSON.parse(hp.run('JSON.stringify(buildDish().passi)'));
    T('i passi della ricetta citano i grammi della pentola', /570 g/.test(J(passi)), J(passi).slice(0, 120));

    const html = hp.run('buildDishHTML()');
    T('la lista mostra il totale e, accanto, quanto tocca a testa',
      /570 g/.test(html) && /190 g a testa/.test(html));
    T('e dichiara per quante persone sono i grammi', /per 3 persone/.test(html));

    // quello che finisce nel diario e' la SUA porzione, non la pentola
    hp.run('buildSaveToDiary();doSaveNow&&doSaveNow();');
    const cena = JSON.parse(hp.run('JSON.stringify(data.food.Cena)'));
    T('nel diario finisce la porzione a testa, non il totale della pentola',
      cena[0].g === 190 && cena[0].kcal === uno.kcal - 0 + 0 - (uno.kcal - cena[0].kcal), J(cena[0]));
    T('i valori salvati sono quelli di una persona',
      cena.reduce((a, v) => a + v.kcal, 0) === uno.kcal, cena.reduce((a, v) => a + v.kcal, 0) + ' vs ' + uno.kcal);

    hp.run('buildPeople=1;');
    T('con una persona non compare la riga "a testa"', !/a testa<\/em>/.test(hp.run('buildDishHTML()')));
    const sel = hp.run('buildHTML()');
    T('il selettore offre da 1 a 4 persone', (sel.match(/data-buildpeople="/g) || []).length === 4);
  }

  // ---------- 12) Dove si rivede il piatto ----------
  {
    const hd = H(REPO);
    hd.run('cur=new Date("2026-01-21T12:00:00");key="fede:2026-01-21";data=norm({day:"Giorno 1"});');
    hd.run('buildSel={prot:"",carb:[],fat:[],veg:[]};buildPeople=2;buildGym=false;');
    ['prot|Manzo magro','carb|Patata','fat|Olio di oliva','veg|Melanzane'].forEach(k => {
      const [r, n] = k.split('|'); hd.run('buildToggle(' + J(r) + ',' + J(n) + ');'); });
    const titolo = JSON.parse(hd.run('JSON.stringify(buildDish())')).titolo;
    hd.run('buildSaveToDiary();doSaveNow&&doSaveNow();');
    T('il nome del piatto resta col giorno, non solo gli ingredienti',
      JSON.parse(hd.run('JSON.stringify(data.dishLog)'))[0].t === titolo, titolo);
    T('e viaggia nel backup del giorno', (JSON.parse(hd.store['fede:2026-01-21'] || '{}').dishLog || []).length === 1);
    hd.run('view="diario";');
    const diario = hd.run('diarioHTML()');
    T('il diario mostra il piatto sopra i suoi ingredienti', diario.indexOf(titolo) > -1 && /diary-dish/.test(diario));
    T('e dice per quante persone era', /dosi per 2/.test(diario));
    T('il titolo sta sotto Cena, non sotto Colazione',
      diario.indexOf(titolo) > diario.indexOf('Cena'), 'posizione');

    // la selezione sopravvive alla chiusura dell'app
    T('la cena in costruzione viene salvata', !!hd.store['fede:build'], Object.keys(hd.store).join(','));
    const hr = H(REPO, { 'fede:build': hd.store['fede:build'] });
    T('riaprendo l\'app la ricetta \u00e8 ancora l\u00ec',
      hr.run('buildSel.prot') === 'Manzo magro' && hr.run('buildPeople') === 2, hr.run('JSON.stringify(buildSel)'));
    T('e non porta con s\u00e9 nessun dato datato', !/\d{4}-\d{2}-\d{2}/.test(hd.store['fede:build']));
  }

  console.log(fail ? '\n' + fail + ' FAIL' : '\nall pass');
  process.exit(fail ? 1 : 0);
})();
