// End-to-end with the ANONYMISED fixture (synthetic data shaped like legacy exports):
// import into an empty device, read history through every path, verify nothing is lost or rewritten.
const REPO = require('path').resolve(__dirname, '..');
const fs = require('fs');
const H = require('./harness');
let fail = 0; const T = (n, ok, x) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const J = JSON.stringify;
const fixtureText = fs.readFileSync(__dirname + '/fixtures/anonymized-backup.json', 'utf8');
const fixture = JSON.parse(fixtureText);

(async () => {
  const h = H(REPO); h.run('profile=getProfile();');
  const res = JSON.parse(h.run(`JSON.stringify((function(){const r=analyzeBackup(parseBackupText(${J(fixtureText)}).backup);delete r.items;return r;})())`));
  T('fixture validates and analyses', res.add.length > 0 && res.invalid.length === 0, J(res.add));
  const out = JSON.parse(h.run(`JSON.stringify(applyBackupImport(analyzeBackup(parseBackupText(${J(fixtureText)}).backup),{}))`));
  T('fixture imported into empty device (verified)', out.ok === true, J(out));
  const userKeys = Object.keys(fixture.localStorage).filter(k => !['fede:lang', 'fede:planVersion'].includes(k));
  T('every user key stored byte-exact (no rewrite on import)', userKeys.every(k => h.store[k] === fixture.localStorage[k]));
  T('device-local lang/planVersion not imported', h.store['fede:lang'] === undefined && h.store['fede:planVersion'] === undefined);

  // Boot like the app does (load), then read history through all paths; storage must not change.
  h.run('cur=new Date("2026-01-20T12:00:00");render=function(){};loadWeek=async function(){};loadAgenda=async function(){};');
  await h.run('load()');
  const afterBoot = J(Object.fromEntries(Object.entries(h.store).filter(([k]) => !/^fede:autobackup:/.test(k))));
  T('legacy plan stays stored but unused (personalised:false, pre-v9)', h.run('userPlan===null') && h.store['fede:userPlan'] === fixture.localStorage['fede:userPlan']);
  T('history records untouched by boot', ['fede:2026-01-05', 'fede:2026-01-06', 'fede:2026-01-07', 'fede:2026-01-12'].every(k => h.store[k] === fixture.localStorage[k]));
  T('schedule labels canonical, choices kept', J(JSON.parse(h.store['fede:goals']).sched) === J({ 0: 'Riposo', 1: 'Giorno 1', 2: 'Giorno 2', 3: 'Giorno 3', 4: 'Riposo', 5: 'Giorno 4', 6: 'Giorno 5' }));

  await h.run('loadLastSession("Giorno 1",0,"Pull-up")');
  T('Pull-up last session from Day-1 / description-ID record', h.run('JSON.stringify(lastEx)') === J({ 1: { kg: '', r: '4' }, 2: { kg: '', r: '5' } }), h.run('JSON.stringify(lastEx)'));
  await h.run('loadLastSession("Giorno 2",3,"Bulgarian Split Squat")');
  T('Bulgarian last session: newest right/left entries', h.run('JSON.stringify(lastEx)') === J({ '1-right': { kg: '12', r: '8' }, '1-left': { kg: '12', r: '7' } }), h.run('JSON.stringify(lastEx)'));
  await h.run('loadLastSession("Giorno 2",4,"Hip Abduction Seated")');
  T('Abduction found via Day prefix + __working + translated dayEx', h.run('JSON.stringify(lastEx)') === J({ 1: { kg: '35', r: '15' } }), h.run('JSON.stringify(lastEx)'));
  await h.run('loadStrengthHist("Machine Hip Thrust")');
  T('Hip Thrust chart: legacy ID record + positional key record', h.run('JSON.stringify(strengthHist.map(x=>x.kg))') === '[30,32]', h.run('JSON.stringify(strengthHist.map(x=>x.kg))'));
  await h.run('loadStrengthHist("Dumbbell Lateral Raise")');
  T('Lateral Raise chart from legacy bilateral entry', h.run('JSON.stringify(strengthHist.map(x=>x.kg))') === '[6]');
  await h.run('loadLastSession("Nuoto",0,"Nuoto")');
  T('Nuoto found in Swimming record', h.run('JSON.stringify(lastEx)') === J({ 1: { kg: '', r: '25' } }));
  T('Bulgarian D2 set 1 complete (both sides)', h.run('exDone(JSON.parse(localStorage.getItem("fede:2026-01-12")),"Giorno 2",3).n') === 1);
  T('Pull-up set 1 done via Day-1 legacy key', h.run('getDoneValue(JSON.parse(localStorage.getItem("fede:2026-01-05")),"Giorno 1",0,PLAN["Giorno 1"].ex[0],1)') === true);
  T('diagnostic counts legacy Day keys', h.run('countLegacyDayKeys()') === 7);
  T('no storage change from any history read', J(Object.fromEntries(Object.entries(h.store).filter(([k]) => !/^fede:autobackup:/.test(k)))) === afterBoot);

  // Export after all of this: still byte-exact, even in English mode.
  h.run('localStorage.setItem("fede:lang","en")');
  const exp = JSON.parse(h.run('JSON.stringify(buildBackupObject())'));
  T('export in English mode is byte-exact for every history key', ['fede:2026-01-05', 'fede:2026-01-06', 'fede:2026-01-07', 'fede:2026-01-12', 'fede:exnote:giorno-1__pull-up'].every(k => exp.localStorage[k] === fixture.localStorage[k]));
  console.log(fail === 0 ? '\nALL FIXTURE CHECKS PASSED' : '\nFAILURES: ' + fail); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL harness error: ' + (e && e.stack || e)); process.exit(1); });
