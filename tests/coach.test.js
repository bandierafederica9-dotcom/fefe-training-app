// Il coach a regole: aritmetica sui dati, nessuna chiamata, niente che cambia da solo.
const REPO = require('path').resolve(__dirname, '..');
const H = require('./harness');
let fail = 0; const T = (n, ok, x) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const J = JSON.stringify;

const seed = (h, giorni) => {
  const ids = JSON.parse(h.run('JSON.stringify(PLAN["Giorno 1"].ex.map(function(e){return e[4];}))'));
  giorni.forEach(([d, kg, reps]) => {
    const sets = {};
    ids.forEach((id, i) => { for (let s = 1; s <= 3; s++) sets['Giorno 1|' + id + '|' + s] = { kg: String(i === 1 ? kg : 20 + i), r: String(i === 1 ? reps : 10) }; });
    h.run('localStorage.setItem("fede:' + d + '",' + J(J({ day: 'Giorno 1', sets })) + ')');
  });
  h.run('cur=new Date("2026-01-21T12:00:00");key="fede:2026-01-21";data=norm({day:"Giorno 1"});');
};
const OTTO = ['2026-01-02', '2026-01-05', '2026-01-07', '2026-01-09', '2026-01-12', '2026-01-14', '2026-01-16', '2026-01-19'];

(async () => {
  // ---------- 1) Il cancello ----------
  {
    const h = H(REPO);
    seed(h, OTTO.slice(0, 5).map(d => [d, 40, 8]));
    const n = JSON.parse(h.run('JSON.stringify(coachNotices())'));
    T('sotto le otto sedute il coach non parla', n.ready === false && n.items.length === 0);
    T('e dice quante ne mancano', n.mancano === 3 && n.valide === 5, J({ m: n.mancano, v: n.valide }));
    T('lo dice anche a schermo', /Ancora pochi dati/.test(h.run('coachNoticesHTML()')) && /ne mancano 3/.test(h.run('coachNoticesHTML()')));
    T('e il bollino resta spento', h.run('coachUnreadCount()') === 0);
  }

  // ---------- 2) I tre filtri ----------
  {
    const h = H(REPO);
    seed(h, OTTO.map(d => [d, 40, 8]));
    const base = h.run('coachValidSessions(recentRecords(120)).length');
    T('otto sedute pulite sono otto', base === 8, String(base));

    // giornata vuota
    h.run('localStorage.setItem("fede:2026-01-20",' + J(J({ day: 'Giorno 2', sets: {} })) + ')');
    T('una giornata vuota non conta', h.run('coachValidSessions(recentRecords(120)).length') === base);

    // seduta doppia: esercizi di due giornate nello stesso record
    h.run('localStorage.setItem("fede:2026-01-18",' + J(J({ day: 'Giorno 2',
      sets: { 'Giorno 1|giorno-1__pull-up|1': { kg: '0', r: '5' }, 'Giorno 2|giorno-2__machine-hip-thrust|1': { kg: '40', r: '8' } } })) + ')');
    T('una seduta con esercizi di due giornate non conta', h.run('coachValidSessions(recentRecords(120)).length') === base);

    // valori impossibili: la serie viene scartata, non la seduta
    h.run('localStorage.setItem("fede:2026-01-17",' + J(J({ day: 'Giorno 1',
      sets: { 'Giorno 1|giorno-1__pull-up|1': { kg: '5', r: '55' }, 'Giorno 1|giorno-1__face-pull|1': { kg: '12', r: '10' } } })) + ')');
    const v = JSON.parse(h.run('JSON.stringify(coachValidSessions(recentRecords(120)).filter(function(s){return s.key==="2026-01-17";}))'));
    T('una serie impossibile viene scartata ma la seduta resta', v.length === 1 && v[0].serie === 1 && v[0].scartate === 1, J(v[0] || {}));
    T('55 ripetizioni sono impossibili, 10 no', v[0].scartate === 1);
  }

  // ---------- 3) Lo stallo ----------
  {
    const h = H(REPO);
    seed(h, OTTO.map(d => [d, 40, 8]));
    const n = JSON.parse(h.run('JSON.stringify(coachNotices())'));
    const stalli = n.items.filter(x => x.kind === 'stallo');
    T('tre sedute identiche fanno uno stallo', stalli.length > 0);
    T('lo stallo dice il peso e le ripetizioni', /40 kg × 8-8-8/.test(stalli[0].text), stalli[0].text);
    T('e da quali date viene', /gen/.test(stalli[0].why), stalli[0].why);
    T('mai più di tre stalli insieme', stalli.length <= 3, String(stalli.length));
    T('il tapis non va in stallo di carico: è a tempo', !/Tapis/.test(J(n.items)));

    // cambiando il carico lo stallo sparisce
    const h2 = H(REPO);
    seed(h2, OTTO.map((d, i) => [d, i >= 6 ? 42.5 : 40, 8]));
    T('se il carico cambia, niente stallo',
      !JSON.parse(h2.run('JSON.stringify(coachNotices())')).items.some(x => x.kind === 'stallo' && /Lat Pulldown/.test(x.text)));
  }

  // ---------- 4) Quanti avvisi ----------
  {
    const h = H(REPO);
    seed(h, OTTO.map(d => [d, 40, 8]));
    const n = JSON.parse(h.run('JSON.stringify(coachNotices())'));
    T('al massimo cinque avvisi a schermo', n.items.length <= 5, n.items.length + ' su ' + n.totale);
    T('più di due giornate saltate diventano un avviso solo',
      n.items.filter(x => x.kind === 'saltato').length <= 1, J(n.items.filter(x => x.kind === 'saltato').map(x => x.text)));
    T('gli avvisi sono ordinati per urgenza', n.items.every((x, i) => i === 0 || n.items[i - 1].urgenza <= x.urgenza));
  }

  // ---------- 5) Il suggerimento di carico ----------
  {
    const h = H(REPO);
    seed(h, OTTO.map(d => [d, 40, 8]));
    h.run('data=norm({day:"Giorno 1"});exIdx=1;');
    T('a serie non chiuse non suggerisce niente', h.run('coachLoadHint("Giorno 1",1,dayPlan("Giorno 1").ex[1])') === '');
    // chiudo tutte le serie dell'esercizio
    h.run('(function(){const e=dayPlan("Giorno 1").ex[1];for(var s=1;s<=e[2];s++)data.done[setKey("Giorno 1",1,e,s)]=true;})();');
    const hint = h.run('coachLoadHint("Giorno 1",1,dayPlan("Giorno 1").ex[1])');
    T('a serie chiuse suggerisce il carico successivo', /42.5 kg/.test(hint), hint.replace(/<[^>]*>/g, ' ').trim());
    T('e dice da quali tre sedute viene', (hint.match(/gen/g) || []).length === 3);
    T('non è rosso: usa l\'accento come il resto', !/red|#f00|var\(--err\)/.test(hint));
    T('sulle macchine pesanti il passo è 5 kg', h.run('coachLoadStep("Hip Abduction Seated",110)') === 5);
    T('altrove è 2,5 kg', h.run('coachLoadStep("Lat Pulldown",40)') === 2.5);
    T('su un esercizio a tempo non suggerisce carichi',
      h.run('coachLoadHint("Giorno 1",6,dayPlan("Giorno 1").ex[6])') === '');
  }

  // ---------- 6) Il bollino ----------
  {
    const h = H(REPO);
    seed(h, OTTO.map(d => [d, 40, 8]));
    const prima = h.run('coachUnreadCount()');
    T('il bollino conta gli avvisi non letti', prima > 0, String(prima));
    h.run('var n=coachNotices();coachMarkSeen(n.items.map(function(x){return x.id;}));');
    T('letti una volta, si spegne', h.run('coachUnreadCount()') === 0);
    T('e non si riaccende da solo', h.run('coachUnreadCount()') === 0);
    T('la chiave è solo la lista dei letti, nessun dato di allenamento',
      !/\d{4}-\d{2}-\d{2}/.test(h.store['fede:coachseen'] || ''), h.store['fede:coachseen']);
  }

  // ---------- 7) Non cambia niente da solo ----------
  {
    const h = H(REPO);
    seed(h, OTTO.map(d => [d, 40, 8]));
    const prima = J(h.store);
    h.run('coachNotices();coachNoticesHTML();coachUnreadCount();coachLoadHint("Giorno 1",1,dayPlan("Giorno 1").ex[1]);');
    T('leggere il coach non scrive niente', J(h.store) === prima);
    T('il piano non viene toccato', h.run('JSON.stringify(PLAN["Giorno 1"].ex.length)') === '7');
    T('e lo dice a schermo', /non cambio niente da solo/.test(h.run('coachNoticesHTML()')));
  }

  // ---------- 8) Risponde a chi chiede un consiglio ----------
  {
    const h = H(REPO);
    seed(h, OTTO.map(d => [d, 40, 8]));
    const consiglio = h.run('coachAdviceReply().text');
    T('a "che consigli mi dai" risponde coi suoi numeri', /kg/.test(consiglio) && /42,5|42\.5/.test(consiglio), consiglio.replace(/<[^>]*>/g, ' ').slice(0, 90));
    T('e dice da dove viene', /tre sedute/.test(consiglio));
    T('e ripete che non cambia niente da solo', /non cambio niente da solo/.test(consiglio));

    const prog = h.run('coachProgressionOverview().text');
    T('la progressione risponde anche senza un esercizio in contesto', /kg/.test(prog) && /Lat Pulldown/.test(prog));
    T('e spiega la regola, non solo il numero', /limite alto del range/.test(prog));

    const r1 = await h.run('coachHandleMessage("Any recomendation?")');
    T('la domanda in inglese arriva alla risposta giusta', /kg/.test(r1.text), r1.text.replace(/<[^>]*>/g, ' ').slice(0, 80));
    const r2 = await h.run('coachHandleMessage("Progressione")');
    T('"Progressione" da sola non cade piu\' sull\'aiuto generico', /kg/.test(r2.text) && !/Posso aiutarti con/.test(r2.text), r2.text.replace(/<[^>]*>/g, ' ').slice(0, 80));
    const r3 = await h.run('coachHandleMessage("che consigli mi dai")');
    T('e lo stesso in italiano', /kg/.test(r3.text));
  }

  // ---------- 8bis) "Come sono andata oggi" ----------
  {
    const h = H(REPO);
    seed(h, OTTO.map(d => [d, 40, 8]));
    const vuoto = h.run('coachTodayReply().text');
    T('senza serie segnate oggi non inventa un resoconto', /non hai ancora segnato/.test(vuoto), vuoto.replace(/<[^>]*>/g, '').slice(0, 70));
    h.run('(function(){const e=dayPlan("Giorno 1").ex[1];for(var s=1;s<=3;s++)data.sets[setKey("Giorno 1",1,e,s)]={kg:"40",r:"8"};})();');
    const pieno = h.run('coachTodayReply().text');
    T('con le serie di oggi dice serie e volume', /3\/19/.test(pieno) && /960 kg/.test(pieno), pieno.replace(/<[^>]*>/g, ' ').slice(0, 90));
    T('e quante ne mancano', /mancano 16/.test(pieno));
    T('e confronta con l\'ultima volta che hai fatto la stessa giornata', /ultima volta/.test(pieno), pieno.replace(/<[^>]*>/g, ' ').slice(0, 160));
    T('e dice cos\'e\' il volume, per non farlo leggere come un voto', /non a dare un voto/.test(pieno));
    const r = await h.run('coachHandleMessage("Come sono andata oggi")');
    T('"Come sono andata oggi" arriva al resoconto, non all\'aiuto generico',
      /960 kg/.test(r.text) && !/Non ho capito/.test(r.text), r.text.replace(/<[^>]*>/g, ' ').slice(0, 80));
    const r2 = await h.run('coachHandleMessage("how did i do today?")');
    T('e lo stesso in inglese', /960 kg/.test(r2.text), r2.text.replace(/<[^>]*>/g, ' ').slice(0, 60));
  }

  // ---------- 9) Sotto soglia dice cosa manca, non numeri inventati ----------
  {
    const h = H(REPO);
    seed(h, OTTO.slice(0, 4).map(d => [d, 40, 8]));
    const c = h.run('coachAdviceReply().text');
    T('con pochi dati non inventa consigli', !/kg \u2192/.test(c) && /4/.test(c), c.slice(0, 90));
    T('e dice quante sedute mancano', /ne mancano 4/.test(c), c.slice(0, 90));
  }

  // ---------- 9bis) La sfera resta attaccata allo schermo ----------
  {
    const css = require('fs').readFileSync(REPO + '/assets/css/app.css', 'utf8');
    const blocchi = css.match(/\.minicoach-fab[^{]*\{[^}]*\}/g) || [];
    const posizioni = blocchi.map(b => (b.match(/position:\s*([a-z]+)/) || [])[1]).filter(Boolean);
    T('la sfera del coach e\' dichiarata fixed', posizioni.indexOf('fixed') > -1, posizioni.join(','));
    T('e nessuna regola successiva la stacca dallo schermo',
      posizioni.every(x => x === 'fixed'), posizioni.join(','));
  }

  // ---------- 10) Niente chiamate esterne ----------
  {
    const src = require('fs').readFileSync(REPO + '/index.html', 'utf8');
    const i = src.indexOf('const COACH_MIN_SESSIONS'), j = src.indexOf('function coachHTML()');
    const blocco = src.slice(i, j);
    T('il coach non fa nessuna chiamata di rete', !/fetch\(|XMLHttpRequest|api\.|https?:\/\//.test(blocco));
  }

  console.log(fail ? '\n' + fail + ' FAIL' : '\nall pass');
  process.exit(fail ? 1 : 0);
})();
