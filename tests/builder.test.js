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

  // ---------- 8) Non scrive mai ----------
  const prima = J(h.store);
  h.run('buildHTML();buildToggle("veg","Broccoli");buildHTML();buildTotals();buildAdviceText();');
  T('costruire una cena non tocca lo storico né nient\'altro', J(h.store) === prima);

  // ---------- 9) La schermata ----------
  h.run('buildSel={prot:"Pollo",carb:"Riso basmati crudo",fat:["Olio di oliva"],veg:["Zucchine"]};');
  const html = h.run('buildHTML()');
  T('mostra il piatto scelto', /Il tuo piatto/.test(html) && /Pollo/.test(html) && /175 g/.test(html));
  T('mostra i due totali con i rispettivi obiettivi', /obiettivo \d+/.test(html) && (html.match(/build-total/g) || []).length >= 1);
  T('ogni riga è un pulsante grande', (html.match(/class="build-row/g) || []).length === Object.keys(roles).reduce((a, r) => a + roles[r].items.length, 0));
  T('dichiara da dove vengono le porzioni', /valori del piano/.test(html));
  T('dice come si fa per due', /raddoppia/.test(html));
  const nutri = h.run('nutriHTML()');
  T('la scheda è raggiungibile dalla nutrizione', /data-diet-section="build"/.test(nutri));

  console.log(fail ? '\n' + fail + ' FAIL' : '\nall pass');
  process.exit(fail ? 1 : 0);
})();
