// Regression for Steps 1-3 (canonicalExerciseId, getSetValue alias, getDoneValue/doneCount/exDone). Synthetic data only.
const REPO = require('path').resolve(__dirname, '..');
const H = require('./harness');
let fail = 0; const T = (n, ok, x) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const J = JSON.stringify;
const h = H(REPO);
// Step 1
[['giorno-1__pull-up__4-x-4-6-rir-1-2-180-sec', 'giorno-1__pull-up'], ['giorno-2__bulgarian-split-squat__3-x-8-10-leg-rir-1-2', 'giorno-2__bulgarian-split-squat'],
 ['giorno-2__hip-abduction-seated__working', 'giorno-2__hip-abduction-seated'], ['giorno-1__hip-abduction-seated__activation', 'giorno-1__hip-abduction-seated__activation'],
 ['giorno-1__face-pull__2-x-15-20__2', 'giorno-1__face-pull__2'], ['Pull-up', 'Pull-up'], ['0', '0']].forEach(c => T('S1 canonical ' + c[0], h.run(`canonicalExerciseId(${J(c[0])})`) === c[1]));
// Step 2
const legacy = [['Giorno 1', 0, 'giorno-1__pull-up__4-x-4-6-rir-1-2-180-sec'], ['Giorno 2', 3, 'giorno-2__bulgarian-split-squat__3-x-8-10-gamba-rir-1-2'], ['Giorno 5', 0, 'giorno-5__bulgarian-split-squat__3-x-8-10-leg-rir-1-2'],
 ['Giorno 1', 3, 'giorno-1__dumbbell-lateral-raise__4-x-12-15-rir-1-2'], ['Giorno 5', 3, 'giorno-5__dumbbell-lateral-raise__3-x-12-15-rir-1-2'], ['Giorno 1', 5, 'giorno-1__bayesian-cable-curl__3-x-10-12-rir-1-2'],
 ['Giorno 2', 0, 'giorno-2__machine-hip-thrust__3-x-6-8-rir-1-hold-2-sec'], ['Giorno 2', 1, 'giorno-2__barbell-db-rdl__3-x-6-8-rir-1-2']];
legacy.forEach(c => { const rec = { day: c[0], sets: { [c[0] + '|' + c[2] + '|2']: { kg: '11', r: '7' } }, done: { [c[0] + '|' + c[2] + '|2']: true } };
  T('S2 getSetValue legacy ' + c[2].split('__')[1], (JSON.parse(h.run(`JSON.stringify(getSetValue(${J(rec)},${J(c[0])},${c[1]},PLAN[${J(c[0])}].ex[${c[1]}],2))`)) || {}).kg === '11');
  T('S3 getDoneValue legacy ' + c[2].split('__')[1], h.run(`getDoneValue(${J(rec)},${J(c[0])},${c[1]},PLAN[${J(c[0])}].ex[${c[1]}],2)`) === true); });
T('S2 exact wins', h.run('getSetValue({sets:{"Giorno 1|giorno-1__pull-up__old|1":{r:"4"},"Giorno 1|giorno-1__pull-up|1":{r:"6"}}},"Giorno 1",0,PLAN["Giorno 1"].ex[0],1).r') === '6');
T('S2 side keys not matched', h.run('getSetValue({sets:{"Giorno 2|giorno-2__bulgarian-split-squat__x|1|right":{r:"4"}}},"Giorno 2",3,PLAN["Giorno 2"].ex[3],1)') === null);
T('S2 positional fallback priority', h.run('getSetValue({sets:{"Giorno 2|giorno-2__machine-hip-thrust__old|1":{kg:"1"},"Giorno 2|0|1":{kg:"40"}}},"Giorno 2",0,PLAN["Giorno 2"].ex[0],1).kg') === '40');
T('S3 exact false wins', h.run('getDoneValue({done:{"Giorno 1|giorno-1__pull-up__old|1":true,"Giorno 1|giorno-1__pull-up|1":false}},"Giorno 1",0,PLAN["Giorno 1"].ex[0],1)') === false);
// Step 3 regression vs original main doneCount/exDone
// Expected original-app outputs (tests/fixtures/baseline-expected.json) replace `git show 0cd063f`.
const BASE = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'fixtures', 'baseline-expected.json'), 'utf8'));
let mism = 0, n = 0;
['Giorno 1', 'Giorno 2', 'Giorno 3', 'Giorno 4', 'Giorno 5', 'Core', 'Casa'].forEach((day, di) => {
  const exs = JSON.parse(h.run(`JSON.stringify(PLAN[${J(day)}].ex)`));
  for (let v = 0; v < 3; v++) { const done = {}; exs.forEach((e, i) => { for (let s = 1; s <= e[2]; s++) { const r = (i * 7 + s * 3 + v + di) % 4;
      if (r === 0) done[day + '|' + e[4] + '|' + s] = true; else if (r === 1) done[day + '|' + i + '|' + s] = true; else if (r === 2) done[day + '|' + e[4] + '|' + s] = false; } });
    const rec = J({ day, done }); n++;
    const exp = BASE.doneCount[n - 1]; if (!exp || exp[0] !== day || exp[1] !== v || h.run(`JSON.stringify(doneCount(${rec},${J(day)}))`) !== J(exp[2])) mism++; } });
T('S3 doneCount identical to main for exact/positional records (' + n + ')', mism === 0, mism + ' mismatches');
T('no storage writes', Object.keys(h.store).length === 0);
console.log(fail === 0 ? '\nALL STEP 1-3 REGRESSION CHECKS PASSED' : '\nFAILURES: ' + fail); process.exit(fail ? 1 : 0);
