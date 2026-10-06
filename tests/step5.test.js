// Step 5: description-independent IDs + fill-only preparePlanExerciseIds. Synthetic data only.
const REPO = require('path').resolve(__dirname, '..');
const H = require('./harness');
let fail = 0; const T = (n, ok, x) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const J = JSON.stringify;
const h = H(REPO);

T('PLAN IDs returned unchanged by exerciseId', h.run(`(function(){let bad=0;Object.keys(PLAN).forEach(d=>{const p=PLAN[d];[p.ex].concat(p.variants?[p.variants.A,p.variants.B]:[]).forEach(l=>l.forEach((e,i)=>{if(exerciseId(d,i,e)!==e[4])bad++;}));});return bad;})()`) === 0);
T('preparePlanExerciseIds(clonePlan(PLAN)) byte-identical', h.run('(function(){const c=clonePlan(PLAN),b=JSON.stringify(c);preparePlanExerciseIds(c);return JSON.stringify(c)===b;})()') === true);

// Saved userPlan with OLD description-based IDs: must not be rewritten
const oldPlan = { 'Giorno 1': { t: 'x', ex: [['Pull-up', '3 x 4-8 · tecnica pulita', 3, 'skill', 'giorno-1__pull-up__3-x-4-8-tecnica-pulita'], ['Hip Abduction Seated', 'pre-attivazione', 2, null, 'giorno-1__hip-abduction-seated__activation']] },
  'Giorno 2': { t: 'y', ex: [['Machine Hip Thrust', '3 x 6-8', 3, null, 'giorno-2__machine-hip-thrust__3-x-6-8-rir-1-hold-2-sec'], ['Hip Abduction Seated', '3 x 15', 3, null, 'giorno-2__hip-abduction-seated__working']] } };
T('old-ID userPlan byte-identical after prepare', h.run(`(function(){const p=${J(oldPlan)},b=JSON.stringify(p);preparePlanExerciseIds(p);return JSON.stringify(p)===b;})()`) === true);

// Coach-added exercises (no ID): description-free, same ID regardless of description
[['Giorno 1', 'Pull-up', 'giorno-1__pull-up'], ['Giorno 2', 'Bulgarian Split Squat', 'giorno-2__bulgarian-split-squat'], ['Giorno 3', 'Dumbbell Lateral Raise', 'giorno-3__dumbbell-lateral-raise'],
 ['Giorno 4', 'Bayesian Cable Curl', 'giorno-4__bayesian-cable-curl'], ['Giorno 3', 'Machine Hip Thrust', 'giorno-3__machine-hip-thrust'], ['Giorno 4', 'Barbell / DB RDL', 'giorno-4__barbell-db-rdl'], ['Giorno 5', 'Pin Squat', 'giorno-5__pin-squat']].forEach(c => {
  const a = h.run(`exerciseId(${J(c[0])},0,[${J(c[1])},"3 x 8-12 · RIR 1",3,null,null])`);
  const b = h.run(`exerciseId(${J(c[0])},0,[${J(c[1])},"4 x 5 · RIR 2 · 180 sec",4,null,null])`);
  T('new ID description-free: ' + c[1], a === c[2] && b === c[2], a + ' / ' + b);
});
T('Day N label normalised in new IDs', h.run('exerciseId("Day 2",0,["Seated Leg Curl","x",3])') === 'giorno-2__seated-leg-curl');

// Duplicates in the same day get __2, __3; canonical keeps the suffix; no cross-talk
{ const r = JSON.parse(h.run(`(function(){const p={"Giorno 3":{ex:[["Face Pull","a",2,null,"giorno-3__face-pull"],["Face Pull","b",2,null,null],["Face Pull","c",2,null,null]]}};preparePlanExerciseIds(p);return JSON.stringify(p["Giorno 3"].ex.map(e=>[e[4],canonicalExerciseId(e[4])]));})()`));
  T('duplicates get __2/__3 (canonical preserves suffix)', J(r) === J([['giorno-3__face-pull', 'giorno-3__face-pull'], ['giorno-3__face-pull__2', 'giorno-3__face-pull__2'], ['giorno-3__face-pull__3', 'giorno-3__face-pull__3']]), J(r));
  const v = h.run(`(function(){const e1=["Face Pull","a",2,null,"giorno-3__face-pull"],e2=["Face Pull","b",2,null,"giorno-3__face-pull__2"];const rec={day:"Giorno 3",sets:{"Giorno 3|giorno-3__face-pull|1":{kg:"5",r:"15"}},done:{"Giorno 3|giorno-3__face-pull|1":true}};return JSON.stringify([getSetValue(rec,"Giorno 3",1,e2,1),getDoneValue(rec,"Giorno 3",1,e2,1),getSetValue(rec,"Giorno 3",0,e1,1)]);})()`);
  T('duplicate __2 does not read the first duplicate history', v === J([null, false, { kg: '5', r: '15' }]), v); }
// Old plan with an old-style duplicate __2 (after description) keeps distinction
T('old dup "x__desc__2" canonical keeps __2', h.run('canonicalExerciseId("giorno-1__face-pull__2-x-15-20__2")') === 'giorno-1__face-pull__2');

// Hip abduction: activation distinct; working matches old __working history
T('activation new ID distinct', h.run('exerciseId("Giorno 1",0,["Hip Abduction Seated","2 x 15 · pre-attivazione",2])') === 'giorno-1__hip-abduction-seated__activation');
T('working new ID keeps __working (as before)', h.run('exerciseId("Giorno 1",0,["Hip Abduction Seated","3 x 15-25 · RIR 1",3])') === 'giorno-1__hip-abduction-seated__working');
T('__working and plain PLAN abduction resolve to same canonical', h.run('canonicalExerciseId(exerciseId("Giorno 2",0,["Hip Abduction Seated","x",3]))') === 'giorno-2__hip-abduction-seated');
T('__activation never merges with working', h.run('canonicalExerciseId("giorno-2__hip-abduction-seated__activation")') !== 'giorno-2__hip-abduction-seated');
T('coach-added 2nd abduction in Giorno 2 gets a distinct ID', h.run('(function(){const p={"Giorno 2":{ex:[PLAN["Giorno 2"].ex[4].slice(),["Hip Abduction Seated","3 x 20",3,null,null]]}};preparePlanExerciseIds(p);return canonicalExerciseId(p["Giorno 2"].ex[1][4]);})()') === 'giorno-2__hip-abduction-seated__2');
// Legacy old-algorithm IDs map onto the new fallback (same canonical) -> no history detached
[['Giorno 3', 'Face Pull', '2 x 15-20 · RIR 1-2', 'giorno-3__face-pull__2-x-15-20-rir-1-2'], ['Giorno 1', 'Pull-up', '3 x 4-8 · tecnica pulita', 'giorno-1__pull-up__3-x-4-8-tecnica-pulita'], ['Giorno 2', 'Hip Abduction Seated', '3 x 15', 'giorno-2__hip-abduction-seated__working']].forEach(c => {
  T('old ID and new fallback share canonical: ' + c[1], h.run(`canonicalExerciseId(${J(c[3])})===canonicalExerciseId(exerciseId(${J(c[0])},0,[${J(c[1])},${J(c[2])},3]))`) === true); });
// Day 5 variant lists keep PLAN IDs; Bulgarian Day 5 + unilateral IDs untouched
// Step-5 property only (setupDay5Variants' own A/B switching bug is pre-existing and handled in the Day 5 area).
T('Day 5 A list: prepare keeps Bulgarian Day 5 ID + variants', h.run('(function(){const c=clonePlan(PLAN),b=JSON.stringify(c["Giorno 5"]);preparePlanExerciseIds(c);return JSON.stringify(c["Giorno 5"])===b&&c["Giorno 5"].ex[0][4]==="giorno-5__bulgarian-split-squat";})()') === true);
T('Day 5 B list: prepare keeps all B IDs + variants', h.run('(function(){const c=clonePlan(PLAN);c["Giorno 5"].ex=JSON.parse(JSON.stringify(c["Giorno 5"].variants.B));const b=JSON.stringify(c["Giorno 5"]);preparePlanExerciseIds(c);return JSON.stringify(c["Giorno 5"])===b;})()') === true);
T('working sets match old __working history', h.run('(function(){const rec={day:"Giorno 2",sets:{"Giorno 2|giorno-2__hip-abduction-seated__working|1":{kg:"40",r:"15"}}};return getSetValue(rec,"Giorno 2",4,PLAN["Giorno 2"].ex[4],1).kg;})()') === '40');
T('Hip Abduction and Hip Adduction stay distinct IDs', h.run('exerciseId("Giorno 2",0,["Hip Adduction","x",3])') === 'giorno-2__hip-adduction' && h.run('canonicalExerciseId("giorno-2__hip-adduction")') !== h.run('canonicalExerciseId("giorno-2__hip-abduction-seated")'));
T('preparePlanExerciseIds skips malformed entries (no crash)', h.run('(function(){const p={"Giorno 1":{ex:[null,"x",["A","b",1]]},"Bad":null};preparePlanExerciseIds(p);return p["Giorno 1"].ex[2][4];})()') === 'giorno-1__a');
T('no storage writes', Object.keys(h.store).length === 0);
console.log(fail === 0 ? '\nALL STEP-5 CHECKS PASSED' : '\nFAILURES: ' + fail); process.exit(fail ? 1 : 0);
