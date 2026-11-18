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
process.exit(fail ? 1 : 0);
