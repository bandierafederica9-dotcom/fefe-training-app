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
  h.run('buildSel={prot:"",carb:"",fat:[],veg:[]};buildGym=false;');
  h.run('buildToggle("prot","Pollo");buildToggle("prot","Manzo magro");');
  T('la proteina è a scelta singola: la seconda sostituisce la prima', h.run('buildSel.prot') === 'Manzo magro');
  h.run('buildToggle("prot","Manzo magro");');
  T('ritoccare la stessa la deseleziona', h.run('buildSel.prot') === '');
  h.run('buildToggle("fat","Noci");buildToggle("fat","Olio di oliva");');
  T('i grassi sono a scelta multipla', h.run('buildSel.fat.length') === 2);
  h.run('buildToggle("fat","Noci");');
  T('e si tolgono uno per uno', h.run('JSON.stringify(buildSel.fat)') === J(['Olio di oliva']));

  // ---------- 5) I totali ----------
  h.run('buildSel={prot:"Manzo magro",carb:"Patata",fat:["Olio di oliva","Noci"],veg:["Melanzane","Funghi"]};');
  const t = JSON.parse(h.run('JSON.stringify(buildTotals())'));
  const atteso = ['prot|Manzo magro', 'carb|Patata', 'fat|Olio di oliva', 'fat|Noci', 'veg|Melanzane', 'veg|Funghi']
    .reduce((a, k) => { const [r, n] = k.split('|'); const x = tot(r, n); return { kcal: a.kcal + x.kcal, prot: a.prot + x.prot }; }, { kcal: 0, prot: 0 });
  T('il totale è la somma delle righe scelte', t.kcal === atteso.kcal && t.prot === atteso.prot, J(t) + ' vs ' + J(atteso));
  T('una cena così sta intorno alle 850 kcal', t.kcal > 780 && t.kcal < 920, String(t.kcal));
  T('e supera le 50 g di proteine', t.prot >= 50, String(t.prot));

  // ---------- 6) Il consiglio dice la cosa giusta ----------
  h.run('buildGym=true;');
  T('con il piatto pieno dice che è equilibrata', /equilibrata/.test(h.run('buildAdviceText()')), h.run('buildAdviceText()'));
  h.run('buildSel={prot:"",carb:"",fat:[],veg:[]};');
  T('a mani vuote spiega come si usa', /una riga per colonna/i.test(h.run('buildAdviceText()')));
  h.run('buildSel={prot:"",carb:"Patata",fat:[],veg:[]};');
  T('senza proteina lo dice subito', /Manca la proteina/.test(h.run('buildAdviceText()')));
  h.run('buildGym=false;buildSel={prot:"Tonno al naturale",carb:"",fat:[],veg:[]};');
  T('troppo leggera: lo quantifica', /Leggera di \d+ kcal/.test(h.run('buildAdviceText()')), h.run('buildAdviceText()'));
  h.run('buildSel={prot:"Uova",carb:"Patata",fat:["Olio di oliva","Noci","Avocado"],veg:[]};buildGym=false;');
  T('troppo ricca: lo quantifica', /Più ricca/.test(h.run('buildAdviceText()')), h.run('buildAdviceText()'));

  // ---------- 7) Il bersaglio cambia col giorno ----------
  h.run('buildGym=false;'); const n1 = JSON.parse(h.run('JSON.stringify(buildTarget())'));
  h.run('buildGym=true;'); const g1 = JSON.parse(h.run('JSON.stringify(buildTarget())'));
  T('il giorno di palestra chiede di più', g1.kcal > n1.kcal && g1.prot >= n1.prot, J(n1) + ' -> ' + J(g1));

  // ---------- 8) Costruire non scrive; salvare sì, ed è l'unico che scrive ----------
  const prima = J(h.store);
  h.run('buildHTML();buildToggle("veg","Broccoli");buildHTML();buildTotals();buildAdviceText();buildDish();');
  T('scegliere e guardare la ricetta non scrive niente', J(h.store) === prima);

  {
    const hs = H(REPO);
    hs.run('cur=new Date("2026-01-21T12:00:00");key="fede:2026-01-21";data=norm({day:"Giorno 1"});');
    T('senza proteina non si salva', JSON.parse(hs.run('JSON.stringify(buildSaveToDiary())')).ok === false);
    hs.run('buildSel={prot:"Manzo magro",carb:"Patata",fat:["Olio di oliva"],veg:["Melanzane"]};');
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
  h.run('buildSel={prot:"Pollo",carb:"Riso basmati crudo",fat:["Olio di oliva"],veg:["Zucchine"]};');
  const html = h.run('buildHTML()');
  T('mostra gli ingredienti scelti dentro la ricetta', /Ingredienti/.test(html) && /Pollo/.test(html) && /175 g/.test(html));
  T('mostra i due totali con i rispettivi obiettivi', /obiettivo \d+/.test(html) && (html.match(/build-total/g) || []).length >= 1);
  T('ogni riga è un pulsante grande', (html.match(/class="build-row/g) || []).length === Object.keys(roles).reduce((a, r) => a + roles[r].items.length, 0));
  T('dichiara da dove vengono le porzioni', /valori del piano/.test(html));
  T('dice come si fa per due', /raddoppia/.test(html));
  T('la lista degli ingredienti non e\' piu\' duplicata fuori dalla ricetta',
    (html.match(/Ingredienti/g) || []).length === 1 && !/Il tuo piatto/.test(html));
  const nutri = h.run('nutriHTML()');
  T('la scheda è raggiungibile dalla nutrizione', /data-diet-section="build"/.test(nutri));

  // ---------- 10) Dalla scelta al piatto ----------
  const dish = sel => { h.run('buildSel=' + J(sel) + ';'); return JSON.parse(h.run('JSON.stringify(buildDish())')); };
  T('senza proteina non propone nessun piatto', h.run('buildSel={prot:"",carb:"Patata",fat:[],veg:[]};buildDish()') === null);
  T('ma lo dice invece di mostrare il vuoto', (() => {
    h.run('buildSel={prot:"",carb:"Patata",fat:[],veg:["Melanzane"]};');
    const v = h.run('buildDishHTML()');
    return /Che cena fare/.test(v) && /Scegli una <b>proteina<\/b>/.test(v);
  })());

  const d1 = dish({ prot: 'Manzo magro', carb: 'Patata', fat: ['Olio di oliva', 'Noci'], veg: ['Melanzane', 'Funghi'] });
  T('il nome dice come si cuoce, non elenca la spesa',
    d1.titolo === 'Padellata di manzo con melanzane e funghi, patata al forno', d1.titolo);
  T('il nome perde le parole da etichetta (magro, fresco, al naturale, petto di)', (() => {
    const n = [
      dish({ prot: 'Petto di tacchino', carb: '', fat: [], veg: [] }).titolo,
      dish({ prot: 'Bacca\u006c\u00e0 fresco', carb: '', fat: [], veg: [] }).titolo,
      dish({ prot: 'Tonno al naturale', carb: '', fat: [], veg: [] }).titolo].join(' | ');
    return !/magro|fresco|al naturale|Petto di/.test(n); })());
  T('ogni tipo di proteina ha la sua forma', (() => {
    const f = k => dish({ prot: k, carb: '', fat: [], veg: [] }).titolo;
    return /^Padellata di/.test(f('Manzo magro')) && /alla piastra$/.test(f('Pesce spada'))
      && /^Uova in padella$/.test(f('Uova')) && /^Saltato di/.test(f('Tofu'))
      && /^Insalata di/.test(f('Tonno al naturale')); })());
  T('i passi citano le grammature scelte', /190 g/.test(J(d1.passi)) && /300 g/.test(J(d1.passi)));
  T('la carne si sigilla, non si lessa', /sigillarlo/.test(J(d1.passi)));
  T('le noci vanno a crudo, non in padella', /Noci 20 g: a crudo/.test(J(d1.passi)));

  const d2 = dish({ prot: 'Uova', carb: 'Patata dolce', fat: [], veg: ['Peperone rosso'] });
  T('con le uova il metodo cambia: conche e coperchio', /conche/.test(J(d2.passi)) && /Coperchio/.test(J(d2.passi)));

  const d3 = dish({ prot: 'Tonno al naturale', carb: 'Ceci cotti', fat: ['Olio di oliva'], veg: ['Lattuga'] });
  T('il tonno in scatola non si cuoce', /non cuocerlo/.test(J(d3.passi)));
  T('e i ceci non finiscono in forno', !/Forno/.test(J(d3.passi)));

  const d4 = dish({ prot: 'Bacca\u006c\u00e0 fresco', carb: 'Riso basmati crudo', fat: [], veg: ['Broccoli'] });
  T('il pesce si fa per lato', /per lato/.test(J(d4.passi)));
  T('nel titolo il riso si legge come a tavola, senza "crudo"',
    /riso basmati(?! crudo)/.test(d4.titolo) && !/crudo/.test(d4.titolo), d4.titolo);

  const d5 = dish({ prot: 'Tofu', carb: '', fat: [], veg: [] });
  T('il tofu si rosola', /rosolato/.test(J(d5.passi)));
  T('senza contorni resta comunque un piatto', d5.passi.length >= 1 && !!d5.titolo);

  // lo stesso tipo si cucina allo stesso modo
  const pollo = dish({ prot: 'Pollo', carb: '', fat: [], veg: [] });
  const tacchino = dish({ prot: 'Petto di tacchino', carb: '', fat: [], veg: [] });
  T('due carni diverse condividono il metodo', pollo.passi[0].replace(/Pollo \d+ g/, 'X') === tacchino.passi[0].replace(/Petto di tacchino \d+ g/, 'X'));

  T('ogni proteina del costruttore sa come si cucina',
    JSON.parse(h.run('JSON.stringify(BUILD_ROLES.prot.items)')).every(n => !!h.run('buildKind(' + J(n) + ')')),
    JSON.parse(h.run('JSON.stringify(BUILD_ROLES.prot.items)')).filter(n => !h.run('buildKind(' + J(n) + ')')).join(','));

  h.run('buildSel={prot:"Pollo",carb:"Patata",fat:[],veg:["Zucchine"]};');
  const dishHtml = h.run('buildDishHTML()');
  T('si legge come una ricetta: nome, resa, ingredienti, procedimento',
    /La ricetta di stasera/.test(dishHtml) && /Ingredienti/.test(dishHtml)
    && /Procedimento/.test(dishHtml) && (dishHtml.match(/<li>/g) || []).length >= 3);
  T('la resa e\' dichiarata a persona', /kcal \u00b7 \d+ g di proteine \u00b7 a persona/.test(dishHtml), (dishHtml.match(/build-dish-meta">[^<]*/) || [''])[0]);
  T('gli ingredienti portano le grammature', /<b>300 g<\/b>/.test(dishHtml));
  T('dice come si fa per due dentro la ricetta', /raddoppia/.test(dishHtml));

  console.log(fail ? '\n' + fail + ' FAIL' : '\nall pass');
  process.exit(fail ? 1 : 0);
})();
