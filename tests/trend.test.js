// Andamento: sedute per settimana e volume per seduta. Solo dati sintetici.
const REPO = require('path').resolve(__dirname, '..');
const H = require('./harness');
let fail = 0; const T = (n, ok, x) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const J = JSON.stringify;

const sets = n => { const o = {}; for (let i = 1; i <= n; i++) o['Giorno 1|g1-ex' + i + '|1'] = { kg: 40, r: 10 }; return o; };
const put = (h, date, n) => h.run('localStorage.setItem("fede:' + date + '",' + J(J({ day: 'Giorno 1', sets: sets(n) })) + ')');

(async () => {
  const h = H(REPO);
  h.run('cur=new Date("2026-01-21T12:00:00");key="fede:2026-01-21";data=norm({day:"Giorno 1"});evoTab="andamento";');

  // ---------- 1) La settimana comincia di lunedì ----------
  T('weekStartOf(mercoledì 21/1) = lunedì 19/1', h.run('weekStartOf(new Date("2026-01-21T12:00:00")).getDate()') === 19);
  T('weekStartOf(lunedì) resta lo stesso giorno', h.run('weekStartOf(new Date("2026-01-19T12:00:00")).getDate()') === 19);
  T('weekStartOf(domenica 25/1) torna al 19', h.run('weekStartOf(new Date("2026-01-25T12:00:00")).getDate()') === 19);

  // ---------- 2) Che cosa conta come seduta ----------
  put(h, '2026-01-19', 3);
  put(h, '2026-01-21', 4);
  h.run('localStorage.setItem("fede:2026-01-20",' + J(J({ day: 'Giorno 2', sets: {} })) + ')'); // aperto e chiuso a vuoto
  const sess = JSON.parse(h.run('JSON.stringify(sessionSummaries(recentRecords(90)).map(function(x){return{k:x.key,s:x.series,v:x.volume};}))'));
  T('un giorno senza serie segnate non è una seduta', sess.length === 2 && sess.every(x => x.k !== '2026-01-20'), J(sess.map(x => x.k)));
  T('le sedute sono in ordine cronologico', sess[0].k === '2026-01-19' && sess[1].k === '2026-01-21');
  T('conta le serie davvero registrate', sess[0].s === 3 && sess[1].s === 4);
  T('il volume è kg × ripetizioni', sess[0].v === 3 * 400 && sess[1].v === 4 * 400, sess[0].v + '/' + sess[1].v);

  // ---------- 3) Le settimane ----------
  let w = JSON.parse(h.run('JSON.stringify(weeklySessions(recentRecords(90),8,cur))'));
  T('restituisce sempre otto settimane, anche vuote', w.length === 8);
  T('solo l\'ultima è marcata come corrente', w.filter(x => x.current).length === 1 && w[7].current === true);
  T('entrambe le sedute cadono nella settimana corrente', w[7].sessions === 2 && w[6].sessions === 0);
  T('la settimana somma le serie', w[7].series === 7);

  put(h, '2026-01-12', 2); // settimana precedente
  w = JSON.parse(h.run('JSON.stringify(weeklySessions(recentRecords(90),8,cur))'));
  T('una seduta della settimana prima finisce nel secchio giusto', w[6].sessions === 1 && w[7].sessions === 2);

  // ---------- 4) Il confronto fra mesi non parte troppo presto ----------
  T('senza otto settimane piene non c\'è confronto', h.run('trendDelta(weeklySessions(recentRecords(90),8,cur))') === null);
  // nove settimane di storico: otto piene più quella corrente
  for (const d of ['2025-12-01', '2025-12-08', '2025-12-15', '2025-12-22', '2025-12-29', '2026-01-05']) put(h, d, 2);
  const d9 = JSON.parse(h.run('JSON.stringify(trendDelta(weeklySessions(recentRecords(90),9,cur)))'));
  T('con nove settimane il confronto compare', d9 !== null && typeof d9.diff === 'number', J(d9));
  T('il confronto esclude la settimana in corso', (() => {
    const ws = JSON.parse(h.run('JSON.stringify(weeklySessions(recentRecords(90),9,cur))'));
    const full = ws.filter(x => !x.current);
    return d9.recent === full.slice(-4).reduce((a, x) => a + x.sessions, 0);
  })());

  // ---------- 5) Il disegno ----------
  const bars = h.run('weeklyBarsHTML(weeklySessions(recentRecords(90),8,cur))');
  T('una barra per settimana', (bars.match(/tb-bar/g) || []).length === 8);
  T('la settimana corrente è distinta', (bars.match(/tb-bar now/g) || []).length === 1);
  T('una settimana a zero non disegna una barra alta', (() => {
    const hz = H(REPO);
    hz.run('cur=new Date("2026-01-21T12:00:00");');
    put(hz, '2026-01-21', 3); // solo la settimana corrente ha una seduta
    const b = hz.run('weeklyBarsHTML(weeklySessions(recentRecords(90),8,cur))');
    return (b.match(/height:0px/g) || []).length === 7;
  })());
  T('nessun colore scritto a mano nelle barre: solo i token', !/#[0-9a-fA-F]{6}/.test(bars));

  const line = h.run('sessionVolumeHTML(sessionSummaries(recentRecords(90)))');
  T('la linea usa una tinta sola', (line.match(/var\(--chart\)/g) || []).length >= 2 && !/#[0-9a-fA-F]{6}/.test(line));
  T('ogni punto ha la sua etichetta al passaggio', (line.match(/<title>/g) || []).length === (line.match(/<circle/g) || []).length);
  T('i punti sono grandi almeno 8px di diametro', /r="4.5"/.test(line));
  T('la linea dichiara a voce cosa mostra', /aria-label="Volume per seduta/.test(line));

  // ---------- 6) Lo stato vuoto non inventa numeri ----------
  const h2 = H(REPO);
  h2.run('cur=new Date("2026-01-21T12:00:00");key="fede:2026-01-21";data=norm({day:"Giorno 1"});evoTab="andamento";');
  const empty = h2.run('trendHTML()');
  T('senza storico non disegna grafici', !/trend-bars|trend-line/.test(empty));
  T('senza storico lo dice invece di mostrare zero', /appena registri la prima seduta/.test(empty));
  T('con una sola seduta non traccia ancora una linea', (() => {
    put(h2, '2026-01-21', 3);
    const one = h2.run('trendHTML()');
    return /trend-bars/.test(one) && !/trend-line/.test(one);
  })());

  // ---------- 7) Niente scritture ----------
  const before = h.run('localStorage.length');
  h.run('trendHTML();weeklySessions(recentRecords(90),8,cur);sessionSummaries(recentRecords(90));');
  T('leggere l\'andamento non scrive niente', h.run('localStorage.length') === before);

  // ---------- 8) La scheda è quella che si apre per prima ----------
  const h3 = H(REPO);
  T('Progressi apre sull\'andamento', h3.run('evoTab') === 'andamento');
  T('le cinque schede ci sono tutte', (() => {
    h3.run('cur=new Date("2026-01-21T12:00:00");key="fede:2026-01-21";data=norm({day:"Giorno 1"});');
    const html = h3.run('evoHTML()');
    return ['andamento', 'metriche', 'carichi', 'obiettivi', 'backup'].every(t => html.indexOf('data-evo="' + t + '"') > -1);
  })());

  // ---------- 9) I grafici si toccano, e il periodo si sceglie ----------
{
  const h9 = H(REPO);
  h9.run('cur=new Date("2026-01-21T12:00:00");key="fede:2026-01-21";data=norm({day:"Giorno 1"});evoTab="andamento";');
  // storico su quattro mesi
  const put2 = (d, n) => h9.run('localStorage.setItem("fede:' + d + '",' + J(J({ day: 'Giorno 1', sets: sets(n) })) + ')');
  ['2025-10-07', '2025-10-14', '2025-11-04', '2025-11-18', '2025-12-02', '2026-01-07', '2026-01-14', '2026-01-21'].forEach(d => put2(d, 3));

  const html = h9.run('trendHTML()');
  T('ogni barra e\' un pulsante con la sua settimana', (html.match(/data-trendweek="/g) || []).length === 8,
    String((html.match(/data-trendweek="/g) || []).length));
  T('le barre dicono a voce cosa sono', /aria-label="Settimana del/.test(html));
  T('niente title: su un telefono non esiste il passaggio del mouse', !/<div class="tb-col"[^>]*title=/.test(html));
  T('il selettore di periodo c\'e\'', /data-trendrange="8"/.test(html) && /data-trendrange="26"/.test(html) && /data-trendrange="0"/.test(html));

  // la settimana toccata
  const iso = (html.match(/data-trendweek="(\d{4}-\d{2}-\d{2})"/g) || []).pop().match(/"([\d-]+)"/)[1];
  h9.run('trendSel={kind:"week",id:' + J(iso) + '};');
  const conSel = h9.run('trendHTML()');
  T('toccata una barra si apre il dettaglio della settimana', /trend-detail/.test(conSel) && /Settimana del/.test(conSel));
  T('il dettaglio elenca le sedute di quella settimana', /trend-line-row/.test(conSel) && /data-trendsess="2026-01-21"/.test(conSel), '');
  T('e la barra scelta resta evidenziata', /class="tb-col sel"/.test(conSel));
  T('con una riga per chiudere', /data-trendclose/.test(conSel));

  // la seduta toccata
  h9.run('trendSel={kind:"sess",id:"2026-01-21"};');
  const sessHtml = h9.run('trendHTML()');
  T('toccato un punto si apre quella seduta', /trend-detail/.test(sessHtml) && /trend-ex/.test(sessHtml));
  T('e mostra gli esercizi con carichi e ripetizioni', /40 kg × 10 rip/.test(sessHtml), sessHtml.replace(/<[^>]*>/g, ' ').slice(0, 120));

  // il cardio si legge in minuti, non in kg
  h9.run('localStorage.setItem("fede:2026-01-19",' + J(J({ day: 'Giorno 1', sets: { 'Giorno 1|giorno-1__tapis-roulant-inclinato|1': { min: '25', inc: '10', kcal: '180' } } })) + ');trendSel={kind:"sess",id:"2026-01-19"};');
  const card = h9.run('trendHTML()');
  T('una seduta di cardio si legge in minuti e calorie', /25 min/.test(card) && /180 kcal/.test(card), card.replace(/<[^>]*>/g, ' ').slice(0, 120));

  // periodo
  h9.run('trendSel={kind:"",id:""};trendRange=0;');
  const tutto = h9.run('trendHTML()');
  T('su "Tutto" le barre diventano mesi, non settimane strette', /data-trendmonth="/.test(tutto) && !/data-trendweek="/.test(tutto));
  T('e il titolo lo dice', /Sedute per mese/.test(tutto));
  T('i mesi sono quelli davvero coperti dallo storico', (tutto.match(/data-trendmonth="/g) || []).length === 4,
    String((tutto.match(/data-trendmonth="/g) || []).length));
  h9.run('trendSel={kind:"month",id:"2025-11-01"};');
  T('toccato un mese si aprono le sue settimane', /trend-detail/.test(h9.run('trendHTML()')) && /settimana del/.test(h9.run('trendHTML()')));

  // il confronto non dipende da quanto storico stai guardando
  h9.run('trendSel={kind:"",id:""};trendRange=8;');
  const a8 = /Ultime 4 settimane piene/.test(h9.run('trendHTML()'));
  h9.run('trendRange=0;');
  const a0 = /Ultime 4 settimane piene/.test(h9.run('trendHTML()'));
  T('il confronto fra mesi compare in entrambi i periodi', a8 === a0, 'a8=' + a8 + ' a0=' + a0);

  // niente scritture
  h9.run('trendRange=8;trendSel={kind:"",id:""};');
  const prima = JSON.stringify(h9.store);
  h9.run('trendHTML();trendSel={kind:"week",id:' + J(iso) + '};trendHTML();');
  T('guardare i grafici non scrive niente', JSON.stringify(h9.store) === prima);
}

console.log(fail ? '\n' + fail + ' FAIL' : '\nall pass');
  process.exit(fail ? 1 : 0);
})();
