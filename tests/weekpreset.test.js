// Weekly presets (Clessidra / Clessidra + Calisthenics), planner day list, home «Oggi» preview. Synthetic data only.
const REPO = require('path').resolve(__dirname, '..');
const H = require('./harness');
let fail = 0; const T = (n, ok, x) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const J = JSON.stringify;
const prof = J({ name: 'Test', goal: 'Forma a clessidra', days: 5, duration: '', level: '', location: '', equipment: '', avoid: '', notes: '', setupComplete: true });
{
  const h = H(REPO, { 'fede:profile': prof });
  h.run('profile=getProfile();ensureUserPlan();');
  const keys = h.run('JSON.stringify(schedDayKeys())');
  T('planner hides Nuoto, Casa and the Lab day', !/Nuoto|Casa|Lab Calisthenics/.test(keys), keys);
  T('planner still offers the five days', /Giorno 1.*Giorno 5/.test(keys));
  const before = h.run('dayPlan("Giorno 3").ex.length');
  T('calisthenics on by default: skill row present', h.run('dayPlan("Giorno 3").ex[0][3]') === 'skill');
  h.run('key="2026-11-18";data=Object.assign(data||{},{day:"Giorno 2",sets:{},done:{},food:{},warm:{}});applyWeekPreset("clessidra");flushSave();');
  T('Clessidra: no skill rows in Giorno 1/3/4', h.run('["Giorno 1","Giorno 3","Giorno 4"].every(function(d){return dayPlan(d).ex.every(function(e){return e[3]!=="skill";});})'));
  T('Clessidra: Giorno 3 lost exactly one row', h.run('dayPlan("Giorno 3").ex.length') === before - 1);
  T('Clessidra: 3 lower + 2 upper + 2 rest', h.run('JSON.stringify([1,2,3,4,5,6,0].map(function(d){return goals.sched[d];}))') === J(['Giorno 2','Giorno 1','Giorno 4','Riposo','Giorno 3','Giorno 5','Riposo']));
  T('Clessidra: persisted', /"calisthenics":false/.test(h.store['fede:goals'] || ''), h.store['fede:goals']);
  T('doneCount total follows the hidden skill', h.run('doneCount({sets:{},done:{}},"Giorno 3").tot') === h.run('dayPlan("Giorno 3").ex.reduce(function(a,e){return a+(Number(e[2])||0);},0)'));
  h.run('applyWeekPreset("calisthenics")');
  T('Calisthenics: skill rows back', h.run('dayPlan("Giorno 3").ex[0][3]') === 'skill' && h.run('dayPlan("Giorno 3").ex.length') === before);
  T('Calisthenics: schedule Giorno 1..5 with Thu/Sun rest', h.run('goals.sched[4]+"|"+goals.sched[0]+"|"+goals.sched[1]') === 'Riposo|Riposo|Giorno 1');
  // Home preview
  const home = h.run('homeHTML()');
  T('home: «Oggi» card is the first section', home.indexOf('<div class="sect">Oggi</div>') > -1 && home.indexOf('<div class="sect">Oggi</div>') < home.indexOf('Idratazione'));
  T('home: exercise preview lists the day\'s exercises', (home.match(/class="today-row/g) || []).length === h.run('dayPlan("Giorno 2").ex.length'));
  T('home: Skill Lab blocks removed', home.indexOf('Skill Lab') < 0 && home.indexOf('Calisthenics skills') < 0);
  const agenda = h.run('agView="sett";agenda=[];agendaHTML()');
  T('agenda: both presets offered', agenda.indexOf('data-preset="clessidra"') > -1 && agenda.indexOf('data-preset="calisthenics"') > -1);
}
// ---------- Spostare una giornata sposta il menu, senza avvisi da leggere ----------
// L'avviso "calendario e pasti non si parlano" e' stato tolto: ora la regola e'
// dentro dietMapping(), quindi il disallineamento non puo' piu' formarsi.
{
  const h2 = H(REPO);
  h2.run('cur=new Date("2026-11-19T12:00:00");key="fede:2026-11-19";data=norm({day:"Riposo"});');
  T('l’avviso non esiste piu’', h2.run('typeof syncNoticeHTML') === 'undefined');
  T('e in Agenda non ne resta traccia', !/sync-notice/.test(h2.run('(function(){view="agenda";return agendaHTML();})()')));

  const kcalDi = w => h2.run('dietDayNutrition(dietMenuForWeekday(' + w + ')).kcal');
  ['clessidra', 'calisthenics', 'weekend'].forEach(id => {
    h2.run('applyWeekPreset(' + J(id) + ');');
    const sched = JSON.parse(h2.run('JSON.stringify(goals.sched)'));
    const kcal = {}; for (let w = 0; w < 7; w++) kcal[w] = kcalDi(w);
    const ordinati = Object.keys(kcal).sort((a, b) => kcal[b] - kcal[a]).map(Number);
    const gambe = [0, 1, 2, 3, 4, 5, 6].filter(w => sched[w] === 'Giorno 2' || sched[w] === 'Giorno 4');
    T(id + ': i due menu piu ricchi cadono sui giorni di gambe',
      gambe.every(w => ordinati.slice(0, 2).indexOf(w) > -1), 'gambe=' + gambe + ' ricchi=' + ordinati.slice(0, 2));
  });

  // cambiando schema cambia anche dove cade il menu ricco, senza toccare altro
  h2.run('applyWeekPreset("calisthenics");');
  const prima = [0, 1, 2, 3, 4, 5, 6].map(kcalDi).join(',');
  h2.run('applyWeekPreset("weekend");');
  const dopo = [0, 1, 2, 3, 4, 5, 6].map(kcalDi).join(',');
  T('cambiato lo schema, i menu si ridispongono', prima !== dopo, prima + ' -> ' + dopo);
  T('ma restano sempre gli stessi sette', (() => {
    const a = prima.split(',').map(Number).sort((x, y) => x - y).join(',');
    const b = dopo.split(',').map(Number).sort((x, y) => x - y).join(',');
    return a === b;
  })());
}

// ---------- Se sposti una giornata, l'app dice cosa non torna ----------
{
  const h5 = H(REPO);
  const set = sched => h5.run('__schedIssueOff=false;goals.sched=' + J(sched) + ';');
  h5.run('cur=new Date("2026-11-19T12:00:00");key="fede:2026-11-19";data=norm({day:"Riposo"});');

  // settimana sana: nessun avviso
  set({ 0: 'Riposo', 1: 'Giorno 1', 2: 'Giorno 2', 3: 'Giorno 3', 4: 'Giorno 4', 5: 'Giorno 5', 6: 'Riposo' });
  T('la settimana giusta non genera avvisi', h5.run('schedIssueHTML()') === '');

  // due giornate di gambe attaccate
  set({ 0: 'Riposo', 1: 'Giorno 1', 2: 'Giorno 2', 3: 'Giorno 4', 4: 'Giorno 3', 5: 'Giorno 5', 6: 'Riposo' });
  const a = h5.run('schedIssueHTML()');
  T('due giornate di gambe attaccate vengono viste', /gambe attaccate/.test(a));
  T('e dice quali, con i giorni veri', /Giovedì/.test(a) === false && /Mercoledì/.test(a) && /Martedì/.test(a), a.replace(/<[^>]*>/g, ' ').slice(0, 110));
  T('propone dove spostarla, su un riposo lontano dalle gambe', /data-schedfix="6"/.test(a), a.match(/data-schedfix="\d"/) || '');
  T('e lascia la via d’uscita', /data-schedoff/.test(a));

  // domenica e lunedi sono attaccati: la settimana e' un cerchio
  set({ 0: 'Giorno 2', 1: 'Giorno 4', 2: 'Giorno 1', 3: 'Riposo', 4: 'Giorno 3', 5: 'Riposo', 6: 'Riposo' });
  T('anche domenica-lunedi conta come attaccato', /gambe attaccate/.test(h5.run('schedIssueHTML()')));

  // la stessa giornata due volte
  set({ 0: 'Riposo', 1: 'Giorno 1', 2: 'Giorno 2', 3: 'Giorno 1', 4: 'Riposo', 5: 'Giorno 4', 6: 'Riposo' });
  const d = h5.run('schedIssueHTML()');
  T('una giornata ripetuta viene vista', /compare due volte/.test(d), d.replace(/<[^>]*>/g, ' ').slice(0, 100));
  T('senza proporre uno spostamento a caso', !/data-schedfix/.test(d));

  // una giornata sparita
  set({ 0: 'Riposo', 1: 'Giorno 1', 2: 'Giorno 2', 3: 'Giorno 3', 4: 'Riposo', 5: 'Giorno 4', 6: 'Riposo' });
  const m = h5.run('schedIssueHTML()');
  T('una giornata sparita viene vista', /non compare in nessun giorno/.test(m), m.replace(/<[^>]*>/g, ' ').slice(0, 100));
  T('e propone un giorno libero dove metterla', /data-schedfix=/.test(m));

  // "lascia così" tace fino alla prossima apertura
  h5.run('__schedIssueOff=true;');
  T('scelto "Lascia così" l’avviso tace', h5.run('schedIssueHTML()') === '');
  T('e non salva niente sul telefono', !('fede:schedoff' in h5.store));

  // guardare non scrive
  h5.run('__schedIssueOff=false;');
  const prima = J(h5.store);
  h5.run('schedIssueHTML();schedIssue();');
  T('controllare la settimana non scrive niente', J(h5.store) === prima);
}

process.exit(fail ? 1 : 0);
