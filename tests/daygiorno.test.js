// Day/Giorno export compatibility + translation safety. Synthetic/anonymised data only.
const REPO = require('path').resolve(__dirname, '..');
const H = require('./harness');
let fail = 0; const T = (n, ok, x) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const J = JSON.stringify;

// ---------- 1) Translation never touches textarea/input/[data-no-i18n] ----------
{ const h = H(REPO, { 'fede:lang': 'en' });
  h.run(`(function(){
    globalThis.NodeFilter={SHOW_TEXT:4,FILTER_ACCEPT:1,FILTER_REJECT:2};
    function el(tag,attrs,kids){const e={nodeType:1,nodeName:tag,attrs:attrs||{},childNodes:[],parentNode:null,placeholder:(attrs||{}).placeholder||'',hasAttribute:function(a){return Object.prototype.hasOwnProperty.call(this.attrs,a);}};(kids||[]).forEach(k=>{k.parentNode=e;e.childNodes.push(k);});return e;}
    function tx(v){return {nodeType:3,nodeValue:v,parentNode:null};}
    globalThis.__t={label:tx("Glutei · Giorno 1 · Nuoto"),note:tx("Note: Giorno 1 Glutei pesante, Nuoto 30 min"),json:tx('{"fede:2026-01-01":"{\\"day\\":\\"Giorno 2\\",\\"sets\\":{\\"Giorno 2|giorno-2__bulgarian-split-squat|1\\":{}}}","n":"Hip Abduction Seated /gamba"}'),keep:tx("Giorno 3 Glutei")};
    const ta1=el("TEXTAREA",{},[__t.note]), ta2=el("TEXTAREA",{"data-no-i18n":""},[__t.json]), nb=el("DIV",{"data-no-i18n":""},[el("SPAN",{},[__t.keep])]), inp=el("INPUT",{placeholder:"Note"});
    const root=el("DIV",{},[el("B",{},[__t.label]),ta1,ta2,nb,inp]);
    root.querySelectorAll=function(){return [inp,ta1,ta2];};
    document.getElementById=function(id){return id==="page"?root:null;};
    document.createTreeWalker=function(r,what,filter){const list=[];(function walk(n){(n.childNodes||[]).forEach(c=>{if(c.nodeType===3){if(!filter||filter.acceptNode(c)===NodeFilter.FILTER_ACCEPT)list.push(c);}else walk(c);});})(r);let i=-1;return {currentNode:null,nextNode:function(){i++;this.currentNode=list[i]||null;return !!list[i];}};};
    globalThis.__inp=inp;
  })()`);
  const before = { note: h.run('__t.note.nodeValue'), json: h.run('__t.json.nodeValue'), keep: h.run('__t.keep.nodeValue') };
  h.run('applyLanguage()');
  T('display text IS translated', h.run('__t.label.nodeValue') === 'Glutes · Day 1 · Swimming', h.run('__t.label.nodeValue'));
  T('user note in textarea untouched (byte-exact)', h.run('__t.note.nodeValue') === before.note);
  T('backup JSON textarea untouched (byte-exact)', h.run('__t.json.nodeValue') === before.json);
  T('[data-no-i18n] subtree untouched', h.run('__t.keep.nodeValue') === before.keep);
  T('placeholder still translated (not user content)', h.run('__inp.placeholder') === 'Notes'); }

// ---------- 2) Export built from storage, byte-exact, language-independent ----------
{ const store = { 'fede:2026-01-05': J({ day: 'Day 2', sets: { 'Day 2|giorno-2__machine-hip-thrust__3-x-6-8|1': { kg: '30', r: '8' }, 'Giorno 2|giorno-2__machine-hip-thrust|1': { kg: '31', r: '8' } }, done: {}, note: 'Glutei ok · Giorno 2' }),
    'fede:exnote:giorno-1__pull-up': 'Nota: Glutei Giorno 1', 'fede:lang': 'en', 'other:key': 'not exported' };
  const h = H(REPO, store);
  const b = JSON.parse(h.run('JSON.stringify(buildBackupObject())'));
  T('export contains every fede:* key', J(Object.keys(b.localStorage).sort()) === J(Object.keys(store).filter(k => k.startsWith('fede:')).sort()));
  T('export values byte-exact in EN mode (incl. mixed Day/Giorno + conflict)', Object.keys(b.localStorage).every(k => b.localStorage[k] === store[k]));
  T('non fede:* keys not exported', !('other:key' in b.localStorage));
  T('export did not write storage', J(h.store) === J(store));
  const html = (function () { h.run('profile=getProfile();evoTab="backup";'); return h.run('evoHTML()'); })();
  T('backup textarea is marked data-no-i18n', /<textarea id="exp" data-no-i18n/.test(html)); }

// ---------- 3) Read-time Day N == Giorno N for sets/done/sides ----------
const h = H(REPO);
const GS = (rec, d, i, s) => JSON.parse(h.run(`JSON.stringify(getSetValue(${J(rec)},${J(d)},${i},PLAN[${J(d)}].ex[${i}],${s}))`));
const GD = (rec, d, i, s) => h.run(`getDoneValue(${J(rec)},${J(d)},${i},PLAN[${J(d)}].ex[${i}],${s})`);
const GSS = (rec, d, i, s, side) => JSON.parse(h.run(`JSON.stringify(getSideSetValue(${J(rec)},${J(d)},${i},PLAN[${J(d)}].ex[${i}],${s},${J(side)}))`));
const GSD = (rec, d, i, s, side) => h.run(`getSideDoneValue(${J(rec)},${J(d)},${i},PLAN[${J(d)}].ex[${i}],${s},${J(side)})`);
T('Day N + legacy desc ID resolves', (GS({ sets: { 'Day 1|giorno-1__pull-up__4-x-4-6-rir-1-2-180-sec|1': { r: '5' } } }, 'Giorno 1', 0, 1) || {}).r === '5');
T('Day N + canonical ID resolves', (GS({ sets: { 'Day 2|giorno-2__machine-hip-thrust|2': { kg: '40' } } }, 'Giorno 2', 0, 2) || {}).kg === '40');
T('Day N + EN-corrupted ID segment (leg) resolves', (GS({ sets: { 'Day 2|giorno-2__bulgarian-split-squat__3-x-8-10-leg-rir-1-2|1': { kg: '12' } } }, 'Giorno 2', 3, 1) || {}).kg === '12');
T('Day N positional key resolves', (GS({ sets: { 'Day 2|0|1': { kg: '41' } } }, 'Giorno 2', 0, 1) || {}).kg === '41');
T('Day N name key resolves', (GS({ sets: { 'Day 2|Machine Hip Thrust|1': { kg: '42' } } }, 'Giorno 2', 0, 1) || {}).kg === '42');
T('Day N done resolves (alias + positional)', GD({ done: { 'Day 1|giorno-1__pull-up__x|1': true } }, 'Giorno 1', 0, 1) === true && GD({ done: { 'Day 1|0|2': true } }, 'Giorno 1', 0, 2) === true);
T('Day N side value + done resolve (Bulgarian D5)', (GSS({ sets: { 'Day 5|giorno-5__bulgarian-split-squat__3-x-8-10-leg|1|left': { kg: '10' } } }, 'Giorno 5', 0, 1, 'left') || {}).kg === '10' && GSD({ done: { 'Day 5|giorno-5__bulgarian-split-squat__x|1|left': true } }, 'Giorno 5', 0, 1, 'left') === true);
T('Day N side (Lateral Raise / Bayesian)', (GSS({ sets: { 'Day 1|giorno-1__dumbbell-lateral-raise__4-x-12-15|1|right': { kg: '7' } } }, 'Giorno 1', 3, 1, 'right') || {}).kg === '7' && (GSS({ sets: { 'Day 1|giorno-1__bayesian-cable-curl__3-x-10-12|2|left': { kg: '9' } } }, 'Giorno 1', 5, 2, 'left') || {}).kg === '9');
// conflicts: canonical Giorno wins; no silent overwrite; record unchanged
{ const rec = { sets: { 'Day 1|giorno-1__pull-up|1': { r: '4' }, 'Giorno 1|giorno-1__pull-up|1': { r: '6' } }, done: { 'Day 1|giorno-1__pull-up|1': true, 'Giorno 1|giorno-1__pull-up|1': false } };
  const b = J(rec);
  T('conflict: canonical Giorno value wins', GS(rec, 'Giorno 1', 0, 1).r === '6');
  T('conflict: canonical Giorno done=false wins', GD(rec, 'Giorno 1', 0, 1) === false);
  T('conflict: both originals still present (no overwrite)', J(rec) === b); }
T('empty legacy values ignored', GS({ sets: { 'Day 1|giorno-1__pull-up__x|1': null, 'Day 1|0|1': '' } }, 'Giorno 1', 0, 1) === null && GD({ done: { 'Day 1|giorno-1__pull-up__x|1': false } }, 'Giorno 1', 0, 1) === false);
T('Day 1 does NOT match Giorno 2', GS({ sets: { 'Day 1|giorno-2__machine-hip-thrust|1': { kg: '1' } } }, 'Giorno 2', 0, 1) === null);
T('existing canonical-only data unchanged', GS({ sets: { 'Giorno 3|giorno-3__frog-stand|1': { r: '20' } } }, 'Giorno 3', 0, 1).r === '20');
T('Swimming/Nuoto read equivalence', h.run('sameWorkoutDay("Swimming","Nuoto")&&!sameWorkoutDay("Swimming","Core")&&readWorkoutDay("Day 3")==="Giorno 3"&&readWorkoutDay("Casa")==="Casa"') === true);
T('canonicalWorkoutDay unchanged (persisted path): Swimming stays Swimming', h.run('canonicalWorkoutDay("Swimming")') === 'Swimming' && h.run('canonicalWorkoutDay("Day 4")') === 'Giorno 4');

// ---------- 4) Completion of a whole day recorded with Day N prefix ----------
{ const rec = { done: {} }; JSON.parse(h.run('JSON.stringify(PLAN["Giorno 2"].ex)')).forEach((e, i) => { for (let s = 1; s <= e[2]; s++) { const k = 'Day 2|' + e[4] + '__old-desc|' + s; if (h.run(`isUnilateralExercise(${J(e)})`)) { rec.done[k + '|right'] = true; rec.done[k + '|left'] = true; } else rec.done[k] = true; } });
  const dc = JSON.parse(h.run(`JSON.stringify(doneCount(${J(rec)},"Giorno 2"))`));
  T('whole Giorno 2 recorded as Day 2 (legacy IDs, sides) reaches 100%', dc.done === dc.tot && dc.tot === 16, dc.done + '/' + dc.tot); }

// ---------- 5) canonicalPlanKeys never drops a plan day ----------
{ const A = { t: 'A', ex: [['Pull-up', 'a', 3]] }, B = { t: 'B', ex: [['Face Pull', 'b', 2]] };
  const r1 = JSON.parse(h.run(`JSON.stringify(canonicalPlanKeys({"Day 1":${J(B)},"Giorno 1":${J(A)}}))`));
  T('Day 1 before Giorno 1: Giorno 1 keeps its own payload, Day 1 kept', J(r1['Giorno 1']) === J(A) && J(r1['Day 1']) === J(B));
  const r2 = JSON.parse(h.run(`JSON.stringify(canonicalPlanKeys({"Giorno 1":${J(A)},"Day 1":${J(B)}}))`));
  T('Giorno 1 before Day 1: same result', J(r2['Giorno 1']) === J(A) && J(r2['Day 1']) === J(B));
  const r3 = JSON.parse(h.run(`JSON.stringify(canonicalPlanKeys({"Day 1":${J(B)},"Day 2":${J(A)},"Riposo":{"ex":[]}}))`));
  T('pure legacy plan renamed (as before), original order kept', J(Object.keys(r3)) === J(['Giorno 1', 'Giorno 2', 'Riposo']), J(Object.keys(r3)));
  // Expected outputs of the original app (tests/fixtures/baseline-expected.json) replace `git show 0cd063f`.
  const BASE = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'fixtures', 'baseline-expected.json'), 'utf8'));
  const plans = [{ 'Day 1': B, 'Day 2': A, 'Core': A, 'Swimming': B, 'Riposo': { ex: [] } }, { 'Giorno 1': A, 'Giorno 5': B }, { 'Riposo': {}, 'Day 3': A }];
  T('identical to main for non-colliding plans (keys, order, payload)', plans.every((p, i) => h.run(`JSON.stringify(canonicalPlanKeys(${J(p)}))`) === J(BASE.canonicalPlanKeysNonColliding[i])));
  T('main DROPPED a colliding day; new keeps both', J(BASE.canonicalPlanKeysLegacyCollisionKeys) === J(['Giorno 1']) && J(Object.keys(r1).sort()) === J(['Day 1', 'Giorno 1']));
  T('canonicalPlanKeys idempotent', h.run(`(function(){const a=canonicalPlanKeys({"Day 1":${J(B)},"Giorno 1":${J(A)}});return JSON.stringify(canonicalPlanKeys(a))===JSON.stringify(a);})()`) === true); }

// ---------- 6) Translated names in stored dayEx: read-only reverse mapping ----------
T('reverse: Seated Hip Abduction -> Hip Abduction Seated', h.run('originalExerciseName("Seated Hip Abduction")') === 'Hip Abduction Seated');
T('reverse: Wide-Grip Lat Pulldown -> Lat Pulldown presa larga', h.run('originalExerciseName("Wide-Grip Lat Pulldown")') === 'Lat Pulldown presa larga');
T('reverse: Swimming -> Nuoto ; Pull-up identity', h.run('originalExerciseName("Swimming")') === 'Nuoto' && h.run('originalExerciseName("Pull-up")') === 'Pull-up');
T('no reverse target is itself a real exercise name', h.run('(function(){originalExerciseName("x");return Object.keys(__enExerciseNameReverse).filter(k=>EXDB[k]||MUSCLE_DB[k]).length;})()') === 0);
T('Abduction and Adduction never equated', h.run('sameExerciseName("Hip Abduction Seated","Hip Adduction")||sameExerciseName("Seated Hip Abduction","Hip Adduction")') === false);

// ---------- 7) Anonymised record shaped like a corrupted EN export: history found, storage unchanged ----------
(async () => {
  const corrupt = { day: 'Day 2', sets: { 'Day 2|giorno-2__machine-hip-thrust__3-x-6-8-rir-1-hold-2-sec|1': { kg: '25', r: '10' }, 'Day 2|giorno-2__hip-abduction-seated__working|1': { kg: '35', r: '15' } },
    done: {}, dayEx: ['Machine Hip Thrust', 'Barbell / DB RDL', 'Seated Leg Curl', 'Seated Hip Abduction', 'Bulgarian Split Squat'], dayExIds: [] };
  const store = { 'fede:2026-01-05': J(corrupt), 'fede:2026-01-06': J({ day: 'Swimming', sets: { 'Swimming|nuoto__nuoto__minuti-vasche|1': { kg: '', r: '20' } }, done: {} }) };
  const hh = H(REPO, store); const snap = J(hh.store);
  hh.run('cur=new Date("2026-01-20T12:00:00");data=blank();');
  T('get() resolves Day 2 -> Giorno 2 in memory', (await hh.run('get(new Date("2026-01-05T12:00:00"))')).day === 'Giorno 2');
  T('get() resolves Swimming -> Nuoto in memory', (await hh.run('get(new Date("2026-01-06T12:00:00"))')).day === 'Nuoto');
  await hh.run('loadStrengthHist("Machine Hip Thrust")');
  T('Carichi finds Hip Thrust in Day-2 record', hh.run('JSON.stringify(strengthHist.map(x=>x.kg))') === '[25]');
  await hh.run('loadLastSession("Giorno 2",4,"Hip Abduction Seated")');
  T('last session finds abduction (Day prefix + __working + translated dayEx)', hh.run('JSON.stringify(lastEx)') === J({ 1: { kg: '35', r: '15' } }), hh.run('JSON.stringify(lastEx)'));
  await hh.run('loadLastSession("Nuoto",0,"Nuoto")');
  T('last session finds Nuoto in Swimming record', hh.run('JSON.stringify(lastEx)') === J({ 1: { kg: '', r: '20' } }), hh.run('JSON.stringify(lastEx)'));
  T('diagnostic counts legacy Day keys (read-only)', hh.run('countLegacyDayKeys()') === 2);
  T('no storage writes during any read', J(hh.store) === snap);
  // Exercise screen + edit on a Day-prefixed record: canonical write only, legacy untouched
  hh.run('globalThis.__els={}; document.querySelectorAll=function(sel){return (__els[sel]||[]);};');
  const html = hh.run('(function(){data=norm(JSON.parse(localStorage.getItem("fede:2026-01-05")));data.day="Giorno 2";key="fede:2026-01-05";exIdx=0;lastExLoading=false;lastEx=null;exerciseTab="video";return exerciseHTML();})()');
  T('screen shows Day-prefixed legacy value', /data-set="Giorno 2\|giorno-2__machine-hip-thrust\|1" data-f="kg"[^>]*value="25"/.test(html));
  hh.run('(function(){const inp={dataset:{set:"Giorno 2|giorno-2__machine-hip-thrust|1",f:"r"},value:"11"};__els["[data-set]"]=[inp];__els["[data-done]"]=[];bind();inp.oninput();clearTimeout(saveT);})()');
  T('edit writes canonical Giorno key seeded from legacy', hh.run('JSON.stringify(data.sets["Giorno 2|giorno-2__machine-hip-thrust|1"])') === J({ kg: '25', r: '11' }));
  T('legacy Day key untouched in memory', hh.run('JSON.stringify(data.sets["Day 2|giorno-2__machine-hip-thrust__3-x-6-8-rir-1-hold-2-sec|1"])') === J({ kg: '25', r: '10' }));
  console.log(fail === 0 ? '\nALL DAY/GIORNO + TRANSLATION CHECKS PASSED' : '\nFAILURES: ' + fail); process.exit(fail ? 1 : 0);
})();
