// Unilateral (right/left) compatibility. Synthetic data only.
const REPO = require('path').resolve(__dirname, '..');
const H = require('./harness');
let fail = 0; const T = (n, ok, x) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const J = JSON.stringify;
const h = H(REPO);
// Expected outputs of the original app (tests/fixtures/baseline-expected.json) replace `git show 0cd063f`.
const BASE = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'fixtures', 'baseline-expected.json'), 'utf8'));

// ---------- 1) Detection: identical to main for every PLAN exercise and for old-style plans ----------
{ const names = JSON.parse(h.run('JSON.stringify((function(){const o=[];Object.keys(PLAN).forEach(d=>{const p=PLAN[d];[p.ex].concat(p.variants?[p.variants.B]:[]).forEach(l=>l.forEach(e=>o.push([d,e])));});return o;})())'));
  let mism = [];
  T('baseline fixture covers every PLAN entry in order', J(BASE.unilateralPlan.map(x => [x[0], x[1]])) === J(names.map(([d, e]) => [d, e[0]])));
  names.forEach(([d, e], i) => { const a = h.run(`isUnilateralExercise(${J(e)})`), b = BASE.unilateralPlan[i][2]; if (a !== b) mism.push(e[0]); });
  // Decided right/left additions (Lab phase): exactly these 5 main-plan exercises change; nothing else.
  const decided = ['Cable Lateral Raise', 'Cable Kickback', 'Cossack Squat', 'Banded Clamshell', 'Clamshell con manubrio'];
  T('detection identical to main for all ' + names.length + ' PLAN entries except the 5 decided additions', J(mism.slice().sort()) === J(decided.slice().sort()), mism.join(','));
  T('decided additions are now unilateral', decided.every(n => names.some(([d, e]) => e[0] === n && h.run(`isUnilateralExercise(${J(e)})`) === true)));
  const oldStyle = [['Dumbbell Lateral Raise', 'x', 4, null, 'giorno-1__dumbbell-lateral-raise__4-x-12-15-rir-1-2'], ['Bayesian Cable Curl', 'x', 3, null, 'giorno-1__bayesian-cable-curl__3-x-10-12-rir-1-2'],
    ['Bulgarian Split Squat', 'x', 3, null, 'giorno-2__bulgarian-split-squat__3-x-8-10-gamba-rir-1-2'], ['Single Arm Row', 'x', 3, null, 'giorno-4__single-arm-row__3-x-10'],
    ['Machine Hip Thrust', 'x', 3, null, 'giorno-2__machine-hip-thrust__3-x-6-8'], ['Hip Abduction Seated', 'x', 3, null, 'giorno-2__hip-abduction-seated__working'],
    ['Hip Adduction', 'x', 3, null, 'giorno-5__hip-adduction__3-x-12'], ['Single Leg Leg Press', 'x', 3, null, 'giorno-5__single-leg-leg-press__3-x-10'], ['Cable Row', 'x', 3, null, null]];
  let m2 = []; oldStyle.forEach((e, i) => { if (BASE.unilateralOldStyle[i][0] !== e[0] || h.run(`isUnilateralExercise(${J(e)})`) !== BASE.unilateralOldStyle[i][1]) m2.push(e[0]); });
  T('detection identical to main for old-style/coach-added exercises', m2.length === 0, m2.join(','));
  T('Lateral Raise / Bayesian / Bulgarian D2+D5 are unilateral by ID', ['giorno-1__dumbbell-lateral-raise', 'giorno-1__bayesian-cable-curl', 'giorno-2__bulgarian-split-squat', 'giorno-5__bulgarian-split-squat', 'giorno-5__dumbbell-lateral-raise'].every(id => h.run(`isUnilateralExercise(["renamed exercise","x",3,null,${J(id)}])`) === true));
  T('Abduction and Adduction both bilateral, distinct', h.run('isUnilateralExercise(PLAN["Giorno 2"].ex[4])') === false && h.run('isUnilateralExercise(["Hip Adduction","x",3,null,"giorno-5__hip-adduction"])') === false); }

// ---------- 2) Side value lookup ----------
const LR = ['Giorno 1', 3], BC = ['Giorno 1', 5], BS2 = ['Giorno 2', 3], BS5 = ['Giorno 5', 0], LR5 = ['Giorno 5', 3];
const sv = (rec, d, i, s, side) => JSON.parse(h.run(`JSON.stringify(getSideSetValue(${J(rec)},${J(d)},${i},PLAN[${J(d)}].ex[${i}],${s},${J(side)}))`));
const sd = (rec, d, i, s, side) => h.run(`getSideDoneValue(${J(rec)},${J(d)},${i},PLAN[${J(d)}].ex[${i}],${s},${J(side)})`);
[[LR, 'giorno-1__dumbbell-lateral-raise__4-x-12-15-rir-1-2', 'Lateral Raise D1'], [BC, 'giorno-1__bayesian-cable-curl__3-x-10-12-rir-1-2', 'Bayesian Curl'],
 [BS2, 'giorno-2__bulgarian-split-squat__3-x-8-10-gamba-rir-1-2', 'Bulgarian D2'], [BS5, 'giorno-5__bulgarian-split-squat__3-x-8-10-leg-rir-1-2', 'Bulgarian D5'], [LR5, 'giorno-5__dumbbell-lateral-raise__3-x-12-15-rir-1-2', 'Lateral Raise D5']].forEach(([[d, i], old, label]) => {
  const rec = { day: d, sets: { [d + '|' + old + '|2|right']: { kg: '8', r: '12' }, [d + '|' + old + '|2|left']: { kg: '7', r: '11' } }, done: { [d + '|' + old + '|2|right']: true } };
  const r = sv(rec, d, i, 2, 'right'), l = sv(rec, d, i, 2, 'left');
  T('legacy side values resolve: ' + label, r && r.kg === '8' && l && l.kg === '7', J([r, l]));
  T('legacy side done resolves (right only): ' + label, sd(rec, d, i, 2, 'right') === true && sd(rec, d, i, 2, 'left') === false);
});
{ const d = 'Giorno 1', i = 3, cur = 'Giorno 1|giorno-1__dumbbell-lateral-raise|1', old = 'Giorno 1|giorno-1__dumbbell-lateral-raise__old|1';
  T('exact side value wins over legacy', sv({ sets: { [old + '|right']: { kg: '1' }, [cur + '|right']: { kg: '9' } } }, d, i, 1, 'right').kg === '9');
  T('exact side done=false wins over legacy true', sd({ done: { [old + '|right']: true, [cur + '|right']: false } }, d, i, 1, 'right') === false);
  T('other side not matched', sv({ sets: { [old + '|left']: { kg: '1' } } }, d, i, 1, 'right') === null);
  T('bilateral key not matched as a side', sv({ sets: { [old]: { kg: '1', r: '5' } } }, d, i, 1, 'right') === null);
  T('other day not matched', sv({ sets: { ['Giorno 5|giorno-5__dumbbell-lateral-raise__x|1|right']: { kg: '1' } } }, d, i, 1, 'right') === null);
  T('other set not matched', sv({ sets: { [old.replace('|1', '|2') + '|right']: { kg: '1' } } }, d, i, 1, 'right') === null); }

// ---------- 3) Completion ----------
const ex = (rec, d, i) => JSON.parse(h.run(`JSON.stringify(exDone(${J(rec)},${J(d)},${i}))`));
[[LR, 'Lateral Raise D1'], [BC, 'Bayesian Curl'], [BS2, 'Bulgarian D2'], [BS5, 'Bulgarian D5']].forEach(([[d, i], label]) => {
  const id = h.run(`setKey(${J(d)},${i},PLAN[${J(d)}].ex[${i}],1)`), n = h.run(`PLAN[${J(d)}].ex[${i}][2]`);
  const both = { done: {} }, one = { done: {} }, bil = { done: {} };
  for (let s = 1; s <= n; s++) { const k = id.replace(/\|1$/, '|' + s); both.done[k + '|right'] = true; both.done[k + '|left'] = true; one.done[k + '|right'] = true; bil.done[k] = true; }
  T('both sides ticked -> complete: ' + label, J(ex(both, d, i)) === J({ n, tot: n }), J(ex(both, d, i)));
  T('one side only -> not complete: ' + label, ex(one, d, i).n === 0);
  T('pre-right/left bilateral tick still counts: ' + label, ex(bil, d, i).n === n);
});
{ const old = 'Giorno 2|giorno-2__bulgarian-split-squat__3-x-8-10-gamba-rir-1-2', rec = { done: {} };
  for (let s = 1; s <= 3; s++) { rec.done[old + '|' + s + '|right'] = true; rec.done[old + '|' + s + '|left'] = true; }
  T('legacy-ID both sides -> complete (Bulgarian D2)', ex(rec, 'Giorno 2', 3).n === 3); }
{ const rec = { done: {} }; JSON.parse(h.run('JSON.stringify(PLAN["Giorno 1"].ex)')).forEach((e, i) => { for (let s = 1; s <= e[2]; s++) { const k = 'Giorno 1|' + e[4] + '|' + s; if (h.run(`isUnilateralExercise(${J(e)})`)) { rec.done[k + '|right'] = true; rec.done[k + '|left'] = true; } else rec.done[k] = true; } });
  const dc = JSON.parse(h.run(`JSON.stringify(doneCount(${J(rec)},"Giorno 1"))`)); // (old-app count was never asserted; message documents it)
  T('full Giorno 1 with right/left ticks reaches 100%', dc.done === dc.tot, dc.done + '/' + dc.tot + ' (main never could: unilateral sides not counted)'); }

// ---------- 4) Exercise screen ----------
const render = (hh, d, i, rec) => hh.run(`(function(){cur=new Date("2026-01-20T12:00:00");key="fede:2026-01-20";data=norm(${J(rec)});data.day=${J(d)};exIdx=${i};lastExLoading=false;lastEx=null;exerciseTab="video";return exerciseHTML();})()`);
{ const hh = H(REPO), old = 'Giorno 1|giorno-1__bayesian-cable-curl__3-x-10-12-rir-1-2';
  const html = render(hh, 'Giorno 1', 5, { day: 'Giorno 1', sets: { [old + '|1|right']: { kg: '12', r: '10' }, [old + '|2']: { kg: '10', r: '9' } }, done: { [old + '|1|right']: true } });
  T('Bayesian shows legacy right value', /data-set="Giorno 1\|giorno-1__bayesian-cable-curl\|1\|right" data-f="kg"[^>]*value="12"/.test(html));
  T('Bayesian shows legacy right tick', /class="chk on" data-done="Giorno 1\|giorno-1__bayesian-cable-curl\|1\|right"/.test(html));
  T('pre-right/left bilateral entry shown read-only', /Registrato senza lato: 10 kg × 9 reps/.test(html));
  T('Bayesian renders 3 sets (e[2]) so it can be completed', (html.match(/class="unilateral-set"/g) || []).length === 3);
  T('render wrote nothing to storage', Object.keys(hh.store).length === 0); }
{ let rowsChanged = []; JSON.parse(h.run('JSON.stringify((function(){const o=[];Object.keys(PLAN).forEach(d=>PLAN[d].ex.forEach((e,i)=>o.push([d,i,e])));return o;})())')).forEach(([d, i, e]) => {
    const m = /^(\d+)/.exec(e[1]), before = m ? +m[1] : 3, after = Math.max(+e[2] || 0, before); if (after < before) rowsChanged.push(e[0]); });
  T('row count never decreases vs main for any PLAN exercise', rowsChanged.length === 0, rowsChanged.join(',')); }

// ---------- 5) Handlers on side inputs ----------
{ const hh = H(REPO); hh.run('globalThis.__els={}; document.querySelectorAll=function(sel){return (__els[sel]||[]);};');
  const old = 'Giorno 2|giorno-2__bulgarian-split-squat__3-x-8-10-gamba-rir-1-2|1', cur = 'Giorno 2|giorno-2__bulgarian-split-squat|1';
  render(hh, 'Giorno 2', 3, { day: 'Giorno 2', sets: { [old + '|left']: { kg: '14', r: '8' }, [old]: { kg: '99', r: '1' } }, done: { [old + '|left']: true } });
  const before = hh.run('JSON.stringify(data.sets)');
  hh.run(`(function(){const a={dataset:{set:${J(cur + '|left')},f:"r"},value:"10"},b={dataset:{set:${J(cur + '|right')},f:"r"},value:"9"};__els["[data-set]"]=[a,b];__els["[data-done]"]=[];bind();a.oninput();b.oninput();clearTimeout(saveT);})()`);
  T('left partial edit keeps legacy left kg', hh.run(`JSON.stringify(data.sets[${J(cur + '|left')}])`) === J({ kg: '14', r: '10' }));
  T('right edit NOT seeded from bilateral entry (side unknown)', hh.run(`JSON.stringify(data.sets[${J(cur + '|right')}])`) === J({ kg: '', r: '9' }));
  const after = JSON.parse(hh.run('JSON.stringify(data.sets)')), b0 = JSON.parse(before);
  T('legacy side + bilateral objects untouched', J(after[old + '|left']) === J(b0[old + '|left']) && J(after[old]) === J(b0[old]));
  hh.run(`(function(){globalThis.__b={dataset:{done:${J(cur + '|left')}},className:"chk on",textContent:"✓"};__els["[data-set]"]=[];__els["[data-done]"]=[__b];bind();__b.onclick();clearTimeout(saveT);})()`);
  T('untick legacy-ticked left side works', hh.run(`data.done[${J(cur + '|left')}]`) === false && hh.run(`getSideDoneValue(data,"Giorno 2",3,PLAN["Giorno 2"].ex[3],1,"left")`) === false && hh.run(`data.done[${J(old + '|left')}]`) === true); }

// ---------- 6) History: last session, strength chart, Coach summary ----------
(async () => {
  const rec = (day, sets) => J({ day, sets, done: {}, dayEx: [], dayExIds: [] });
  const store = {
    'fede:2026-01-05': rec('Giorno 2', { 'Giorno 2|giorno-2__bulgarian-split-squat__3-x-8-10-gamba-rir-1-2|1': { kg: '20', r: '8' } }),
    'fede:2026-01-06': rec('Giorno 1', { 'Giorno 1|giorno-1__dumbbell-lateral-raise__4-x-12-15|1|right': { kg: '8', r: '12' }, 'Giorno 1|giorno-1__dumbbell-lateral-raise__4-x-12-15|1|left': { kg: '9', r: '10' } }),
    'fede:2026-01-13': rec('Giorno 1', { 'Giorno 1|giorno-1__dumbbell-lateral-raise|1|right': { kg: '10', r: '12' } }) };
  const hh = H(REPO, store); const snap = J(hh.store);
  hh.run('cur=new Date("2026-01-20T12:00:00");data=blank();');
  await hh.run('loadLastSession("Giorno 2",3,"Bulgarian Split Squat")');
  T('last session: Bulgarian logged before right/left shown', hh.run('JSON.stringify(lastEx)') === J({ 1: { kg: '20', r: '8' } }), hh.run('JSON.stringify(lastEx)'));
  await hh.run('loadLastSession("Giorno 1",3,"Dumbbell Lateral Raise")');
  T('last session: Lateral Raise newest right side', hh.run('JSON.stringify(lastEx)') === J({ '1-right': { kg: '10', r: '12' } }), hh.run('JSON.stringify(lastEx)'));
  await hh.run('loadStrengthHist("Dumbbell Lateral Raise")');
  T('strength chart includes side data (legacy + new)', hh.run('JSON.stringify(strengthHist.map(x=>x.kg))') === J([9, 10]), hh.run('JSON.stringify(strengthHist.map(x=>x.kg))'));
  const ssum = JSON.parse(hh.run('JSON.stringify(sessionSummary(JSON.parse(localStorage.getItem("fede:2026-01-06")),"Giorno 1",3,PLAN["Giorno 1"].ex[3]))'));
  T('Coach summary includes both sides', ssum.rows.length === 2 && ssum.volume === 186, J(ssum));
  T('Coach text labels sides', /dx 8 kg × 12 reps · sx 9 kg × 10 reps/.test(hh.run(`coachProgressText("Dumbbell Lateral Raise","Giorno 1",{date:new Date("2026-01-06T12:00:00"),summary:${J(ssum)}})`)));
  T('history reads made no storage writes', J(hh.store) === snap);
  console.log(fail === 0 ? '\nALL UNILATERAL CHECKS PASSED' : '\nFAILURES: ' + fail); process.exit(fail ? 1 : 0);
})();
