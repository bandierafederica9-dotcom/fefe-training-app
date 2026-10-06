// Plan / Coach migration safety + Day 5 variants. Synthetic data only.
const REPO = require('path').resolve(__dirname, '..');
const H = require('./harness');
let fail = 0; const T = (n, ok, x) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const J = JSON.stringify;
const keysOf = (store, pre) => Object.keys(store).filter(k => k.indexOf(pre) === 0);
const prof = (o) => J(Object.assign({ name: 'Test', goal: '', days: 4, duration: '', level: '', location: '', equipment: '', avoid: '', notes: '', setupComplete: true, personalised: true }, o || {}));

// A personalised plan with Coach-added exercise, custom fields, extra tuple element, old planVersion.
const customPlan = {
  'Giorno 1': { t: 'Mio giorno 1', em: 'X', custom: 'keep-me', ex: [['Pull-up', '3 x 5', 3, 'skill', 'giorno-1__pull-up', { note: 'extra-element' }], ['Hammer Curl', '3 x 10', 3, null, 'giorno-1__hammer-curl']] },
  'Giorno 2': { t: 'Mio giorno 2', ex: [['Machine Hip Thrust', '4 x 6', 4, null, 'giorno-2__machine-hip-thrust__4-x-6-old-desc'], ['Bulgarian Split Squat', '3 x 8/gamba', 3, null, 'giorno-2__bulgarian-split-squat']] },
  'Giorno 5': { t: 'D5', variant: 'B', ex: [['Pin Squat', '4 x 5', 4, null, 'giorno-5__pin-squat'], ['Goblet Squat', '3 x 10', 3, null, 'giorno-5__goblet-squat']],
    variants: { A: [['Bulgarian Split Squat', '3 x 8', 3, null, 'giorno-5__bulgarian-split-squat'], ['Face Pull', '2 x 15', 2, null, 'giorno-5__face-pull']], B: [['Pin Squat', '4 x 5', 4, null, 'giorno-5__pin-squat']] } },
  'Riposo': { t: 'R', ex: [] }, extraTopLevel: { foo: 1 } };

// ---------- 1) Personalised plan + version change: never regenerated ----------
{ const store = { 'fede:profile': prof(), 'fede:userPlan': J(customPlan), 'fede:planVersion': '7' };
  const h = H(REPO, store); h.run('profile=getProfile();ensureUserPlan();');
  T('personalised plan NOT regenerated on version change', h.run('JSON.stringify(userPlan)') === J(customPlan));
  T('stored fede:userPlan byte-identical', h.store['fede:userPlan'] === J(customPlan));
  T('custom fields, extra tuple element, Coach exercise, Day 5 B preserved', h.run('userPlan["Giorno 1"].custom==="keep-me"&&userPlan["Giorno 1"].ex[0][5].note==="extra-element"&&userPlan["Giorno 1"].ex[1][0]==="Hammer Curl"&&userPlan["Giorno 5"].variant==="B"&&!!userPlan.extraTopLevel'));
  T('existing IDs unchanged (incl. old-style ID)', h.run('userPlan["Giorno 2"].ex[0][4]') === 'giorno-2__machine-hip-thrust__4-x-6-old-desc');
  T('profile.days NOT forced to 5', JSON.parse(h.store['fede:profile']).days === 4);
  T('planVersion marker updated to 9', h.store['fede:planVersion'] === '9');
  T('legacyUserPlanV2 one-time copy is byte-exact', h.store['fede:legacyUserPlanV2'] === J(customPlan));
  T('no snapshot needed (nothing changed)', keysOf(h.store, 'fede:autobackup:').length === 0);
  const s1 = J(h.store); h.run('ensureUserPlan();ensureUserPlan();');
  T('idempotent: re-running writes nothing', J(h.store) === s1); }

// ---------- 2) Already-current plan: zero writes ----------
{ const p = JSON.parse(J(customPlan)); const store = { 'fede:profile': prof(), 'fede:userPlan': J(p), 'fede:planVersion': '9', 'fede:legacyUserPlanV2': 'x' };
  const h = H(REPO, store); h.run('profile=getProfile();ensureUserPlan();');
  T('current plan + version: storage byte-identical', J(h.store) === J(store)); }

// ---------- 3) Legacy Day N keys + missing IDs: snapshot first, payload preserved, idempotent ----------
{ const legacy = { 'Day 1': { t: 'L1', ex: [['Pull-up', '3 x 5', 3, 'skill', 'giorno-1__pull-up__3-x-5'], ['Cable Row', '3 x 10', 3]] }, 'Day 2': { t: 'L2', ex: [['Machine Hip Thrust', '3 x 8', 3, null, null]] }, 'Riposo': { ex: [] } };
  const store = { 'fede:profile': prof(), 'fede:userPlan': J(legacy), 'fede:planVersion': '9' };
  const h = H(REPO, store); h.run('profile=getProfile();ensureUserPlan();');
  const up = JSON.parse(h.store['fede:userPlan']);
  T('Day N renamed to Giorno N, order kept', J(Object.keys(up)) === J(['Giorno 1', 'Giorno 2', 'Riposo']));
  T('existing ID kept, missing IDs filled (description-free)', up['Giorno 1'].ex[0][4] === 'giorno-1__pull-up__3-x-5' && up['Giorno 1'].ex[1][4] === 'giorno-1__cable-row' && up['Giorno 2'].ex[0][4] === 'giorno-2__machine-hip-thrust');
  const snaps = keysOf(h.store, 'fede:autobackup:');
  T('verified snapshot taken before persisting', snaps.length === 1 && JSON.parse(h.store[snaps[0]]).localStorage['fede:userPlan'] === J(legacy), snaps.join());
  const s1 = J(h.store); h.run('ensureUserPlan();');
  T('idempotent: second run changes nothing', J(h.store) === s1); }

// ---------- 4) Duplicate IDs in a stored plan are left as-is ----------
{ const dup = { 'Giorno 3': { ex: [['Face Pull', 'a', 2, null, 'giorno-3__face-pull'], ['Face Pull', 'b', 2, null, 'giorno-3__face-pull']] } };
  const store = { 'fede:profile': prof(), 'fede:userPlan': J(dup), 'fede:planVersion': '9' };
  const h = H(REPO, store); h.run('profile=getProfile();ensureUserPlan();');
  T('duplicate IDs not rewritten (no destructive rename)', h.store['fede:userPlan'] === J(dup) && keysOf(h.store, 'fede:autobackup:').length === 0); }

// ---------- 5) personalised:false ----------
{ const v9b = JSON.parse(J(require('vm') && null || '{}')); }
{ const h0 = H(REPO); const v9 = JSON.parse(h0.run('JSON.stringify(clonePlan(PLAN))'));
  const coachEdited = JSON.parse(J(v9)); coachEdited['Giorno 1'].ex.push(['Hammer Curl', '3 x 8-12 · 90 sec', 3, null, 'giorno-1__hammer-curl']);
  const variantB = JSON.parse(J(v9)); variantB['Giorno 5'].variant = 'B'; variantB['Giorno 5'].ex = JSON.parse(J(v9['Giorno 5'].variants.B));
  const legacySeedLike = { 'Day 1': { t: 'Back', ex: [['Pull-up', 'x', 4, 'skill', 'giorno-1__pull-up__4-x-4-6']] }, 'Swimming': { ex: [['Swimming', 'x', 1]] } };
  [[coachEdited, true, 'v9 plan with Coach edit adopted'], [variantB, true, 'v9 plan with Day 5 B adopted'], [legacySeedLike, false, 'legacy Day-N plan NOT adopted'], [v9, false, 'unmodified v9 clone NOT adopted (default used)']].forEach(([p, expect, label]) => {
    const store = { 'fede:profile': prof({ personalised: false }), 'fede:userPlan': J(p), 'fede:planVersion': '9' };
    const h = H(REPO, store); h.run('profile=getProfile();ensureUserPlan();');
    T('personalised:false: ' + label, (h.run('userPlan!==null') === expect) && h.store['fede:userPlan'] === J(p)); });
  const store = { 'fede:profile': prof({ personalised: false }), 'fede:userPlan': J(legacySeedLike), 'fede:userPlanMeta': J({ customized: true }) };
  const h = H(REPO, store); h.run('profile=getProfile();ensureUserPlan();');
  T('personalised:false + meta.customized: plan used', h.run('userPlan!==null')); }

// ---------- 6) Personalised with missing / unparsable plan ----------
{ const h = H(REPO, { 'fede:profile': prof(), 'fede:userPlan': '{not json' }); h.run('profile=getProfile();ensureUserPlan();');
  const arch = keysOf(h.store, 'fede:archivedUserPlan:').filter(k => !/:reason$/.test(k));
  T('unparsable stored plan archived byte-exact before generating', arch.length === 1 && h.store[arch[0]] === '{not json' && h.run('userPlan!==null'));
  const h2 = H(REPO, { 'fede:profile': prof() }); h2.run('profile=getProfile();ensureUserPlan();');
  T('no stored plan: generated, nothing archived', h2.run('userPlan!==null') && keysOf(h2.store, 'fede:archivedUserPlan:').length === 0); }

// ---------- 7) Coach read paths never write ----------
(async () => {
  { const legacySeedLike = { 'Day 1': { ex: [['Pull-up', 'x', 4, 'skill', 'giorno-1__pull-up__x']] } };
    const store = { 'fede:profile': prof({ personalised: false }), 'fede:userPlan': J(legacySeedLike), 'fede:2026-01-05': J({ day: 'Giorno 1', sets: { 'Giorno 1|giorno-1__pull-up|1': { r: '5' } }, done: {} }) };
    const h = H(REPO, store); h.run('profile=getProfile();ensureUserPlan();cur=new Date("2026-01-20T12:00:00");data=norm({day:"Giorno 1"});key="fede:2026-01-20";');
    const snap = J(h.store);
    for (const q of ['Cosa faccio oggi?', 'Cosa ho fatto l\'ultima volta con Pull-up?', 'Come posso progredire con pull up giorno 1?', 'mostra il piano giorno 2', 'Voglio più calisthenics giorno 3', 'fammi stare nei 45 minuti giorno 2', 'togli pull up giorno 1', 'sostituisci hip thrust con face pull giorno 2'])
      await h.run(`safeCoachHandleMessage(${J(q)})`);
    T('Coach questions/proposals (incl. pending edits) wrote nothing', J(h.store) === snap); }

  // ---------- 8) Coach apply: archive unused stored plan, mark customised, survive reload ----------
  { const legacySeedLike = { 'Day 1': { ex: [['Pull-up', 'x', 4, 'skill', 'giorno-1__pull-up__x']] } };
    const store = { 'fede:profile': prof({ personalised: false }), 'fede:userPlan': J(legacySeedLike) };
    const h = H(REPO, store); h.run('profile=getProfile();ensureUserPlan();data=null;');
    h.run('coachPending={type:"add",day:"Giorno 1",name:"Hammer Curl",awaiting:"confirm"};coachApplyPending();');
    const arch = keysOf(h.store, 'fede:archivedUserPlan:').filter(k => !/:reason$/.test(k));
    T('Coach apply archived the unused stored plan byte-exact', arch.length === 1 && h.store[arch[0]] === J(legacySeedLike));
    T('snapshot taken before replacing', keysOf(h.store, 'fede:autobackup:').length === 1);
    const up = JSON.parse(h.store['fede:userPlan']); const added = up['Giorno 1'].ex[up['Giorno 1'].ex.length - 1];
    T('added exercise has description-free ID', added[0] === 'Hammer Curl' && added[4] === 'giorno-1__hammer-curl');
    T('meta marks plan as Coach-customised', JSON.parse(h.store['fede:userPlanMeta']).customized === true);
    const h2 = H(REPO, h.store); h2.run('profile=getProfile();ensureUserPlan();');
    T('after reload (personalised:false) the Coach plan is still used', h2.run('userPlan!==null&&userPlan["Giorno 1"].ex.some(e=>e[0]==="Hammer Curl")'));
    // replace keeps other IDs; replaced exercise history keys remain in records
    const ids1 = J(JSON.parse(h.store['fede:userPlan'])['Giorno 2'].ex.map(e => e[4]));
    h2.run('coachPending={type:"replace",day:"Giorno 2",index:2,oldName:"Seated Leg Curl",newName:"Leg Curl Machine",awaiting:"confirm"};coachApplyPending();');
    const after = JSON.parse(h2.store['fede:userPlan'])['Giorno 2'].ex.map(e => e[4]);
    T('replace: other exercises keep their IDs; new one gets its own', J(after.filter((x, i) => i !== 2)) === J(JSON.parse(ids1).filter((x, i) => i !== 2)) && after[2] === 'giorno-2__leg-curl-machine', J(after));
    const s2 = J(h2.store);
    h2.run('coachPending={type:"remove",day:"Giorno 2",index:0,name:"Bulgarian Split Squat",awaiting:"confirm"};globalThis.__r=coachApplyPending();');
    T('guard: stale index/name -> nothing modified', J(h2.store) === s2 && /non ho modificato nulla/.test(h2.run('__r')), h2.run('__r')); }

  // ---------- 9) Coach crash fix ----------
  { const h = H(REPO); h.run('profile=getProfile();');
    const r = await h.run('coachPending={type:"replace",awaiting:"day",oldName:"Pull-up",newName:"Face Pull"};safeCoachHandleMessage("giorno 2")');
    T('replace with exercise missing in chosen day: no crash, clear message', /Pull-up non è presente/.test(r.text) && h.run('coachPending===null'), r.text); }

  // ---------- 10) Day 5 variants ----------
  { const h = H(REPO);
    const out = JSON.parse(h.run(`(function(){const p=${J(customPlan)};const g=p["Giorno 5"];
      const b0=JSON.stringify(g.variants.A);
      g.ex.push(["Coach Extra","3 x 8",3,null,"giorno-5__coach-extra",{k:1}]); // edit to active B
      setupDay5Variants(p,"A"); const r1={variant:g.variant,ex:g.ex.map(e=>e[0]),B:g.variants.B.map(e=>e[0]),Aunchanged:JSON.stringify(g.variants.A)===b0};
      g.ex.push(["A Extra","2 x 10",2,null,"giorno-5__a-extra"]);              // edit to active A
      setupDay5Variants(p,"B"); const r2={variant:g.variant,ex:g.ex.map(e=>e[0]),A:g.variants.A.map(e=>e[0]),custom:g.ex[2][5]};
      const snap=JSON.stringify(p); setupDay5Variants(p,"B"); const r3=JSON.stringify(p)===snap;
      setupDay5Variants(p,"Z"); const r4=g.variant;
      setupDay5Variants(p,"A"); const r5=g.ex.map(e=>e[0]);
      return JSON.stringify({r1,r2,r3,r4,r5});})()`));
    T('B->A: B edits saved into variants.B; A restored unchanged', out.r1.variant === 'A' && J(out.r1.B) === J(['Pin Squat', 'Goblet Squat', 'Coach Extra']) && out.r1.Aunchanged === true && J(out.r1.ex) === J(['Bulgarian Split Squat', 'Face Pull']), J(out.r1));
    T('A->B: A edits saved into variants.A; B (with Coach edit + custom field) restored', out.r2.variant === 'B' && J(out.r2.A) === J(['Bulgarian Split Squat', 'Face Pull', 'A Extra']) && J(out.r2.ex) === J(['Pin Squat', 'Goblet Squat', 'Coach Extra']) && out.r2.custom && out.r2.custom.k === 1, J(out.r2));
    T('re-selecting active variant is a no-op', out.r3 === true);
    T('unknown variant keeps current', out.r4 === 'B');
    T('A can be selected again after B (main bug fixed)', J(out.r5) === J(['Bulgarian Split Squat', 'Face Pull', 'A Extra']));
    T('Bulgarian Split Squat stays first in Day 5 A of default PLAN', h.run('PLAN["Giorno 5"].variants.A[0][4]') === 'giorno-5__bulgarian-split-squat' && h.run('PLAN["Giorno 5"].ex[0][4]') === 'giorno-5__bulgarian-split-squat'); }
  // default plan: switch without creating fede:userPlan, re-applied on load
  { const h = H(REPO, { 'fede:profile': prof({ personalised: false }) }); h.run('profile=getProfile();ensureUserPlan();data=null;render=function(){};');
    h.run('setDay5Variant("B")');
    T('default plan: B switch creates no fede:userPlan', h.store['fede:userPlan'] === undefined && h.store['fede:day5Variant'] === 'B');
    const h2 = H(REPO, h.store); h2.run('profile=getProfile();ensureUserPlan();if(!userPlan){const sv=localStorage.getItem("fede:day5Variant");if(sv==="A"||sv==="B")setupDay5Variants(PLAN,sv);}');
    T('default plan: B re-applied after reload', h2.run('PLAN["Giorno 5"].variant') === 'B' && h2.run('PLAN["Giorno 5"].ex[0][0]') === 'Single-Leg Plate Hop to Skater Jump');
    h2.run('render=function(){};data=null;setDay5Variant("A")');
    T('default plan: back to A works', h2.run('PLAN["Giorno 5"].ex[0][4]') === 'giorno-5__bulgarian-split-squat'); }
  // personalised plan: persisted switch, survives reload, other variant intact
  { const store = { 'fede:profile': prof(), 'fede:userPlan': J(customPlan), 'fede:planVersion': '9' };
    const h = H(REPO, store); h.run('profile=getProfile();ensureUserPlan();data=null;render=function(){};setDay5Variant("A");');
    const up = JSON.parse(h.store['fede:userPlan']);
    T('personalised: switch persisted, B list kept in variants.B', up['Giorno 5'].variant === 'A' && J(up['Giorno 5'].variants.B.map(e => e[0])) === J(['Pin Squat', 'Goblet Squat']));
    const h2 = H(REPO, h.store); h2.run('profile=getProfile();ensureUserPlan();');
    T('personalised: variant A survives reload', h2.run('userPlan["Giorno 5"].variant') === 'A'); }

  // ---------- 11) Record exercise map: additive only ----------
  { const h = H(REPO);
    const r = JSON.parse(h.run(`(function(){const a={dayEx:[],dayExIds:[]};syncRecordExerciseMap(a,"Giorno 1");
      const b={dayEx:["Pull-up","Old Ex"],dayExIds:["giorno-1__pull-up__old","giorno-1__old-ex"]};syncRecordExerciseMap(b,"Giorno 1");
      const c={dayEx:["Legacy Name"],dayExIds:[]};syncRecordExerciseMap(c,"Giorno 1");
      const d={dayEx:["A","B"],dayExIds:["x"]};syncRecordExerciseMap(d,"Giorno 1");
      const b2=JSON.parse(JSON.stringify(b));syncRecordExerciseMap(b2,"Giorno 1");
      return JSON.stringify({a,b,c,d,idem:JSON.stringify(b2)===JSON.stringify(b)});})()`));
    T('empty map gets current plan list', r.a.dayExIds.length === 6 && r.a.dayExIds[0] === 'giorno-1__pull-up');
    T('existing map: old entries/positions kept, only missing appended', r.b.dayEx[0] === 'Pull-up' && r.b.dayEx[1] === 'Old Ex' && r.b.dayExIds[0] === 'giorno-1__pull-up__old' && r.b.dayExIds.length === 7 && !r.b.dayExIds.slice(2).includes('giorno-1__pull-up'), J(r.b.dayExIds));
    T('legacy names-only map untouched', J(r.c) === J({ dayEx: ['Legacy Name'], dayExIds: [] }));
    T('misaligned map untouched', J(r.d) === J({ dayEx: ['A', 'B'], dayExIds: ['x'] }));
    T('sync idempotent', r.idem === true); }
  { const h = H(REPO, { 'fede:planVersion': '7' }); h.run('profile=getProfile();key="fede:2026-01-05";data=norm({day:"Giorno 1",dayEx:["Old"],dayExIds:["giorno-1__old"],sets:{}});');
    await h.run('doSave()');
    const rec = JSON.parse(h.store['fede:2026-01-05']);
    T('doSave: old record map extended, not overwritten', rec.dayEx[0] === 'Old' && rec.dayExIds[0] === 'giorno-1__old' && rec.dayExIds.length === 7);
    T('doSave no longer stamps planVersion', h.store['fede:planVersion'] === '7'); }

  // ---------- 12) Schedule: never reset; legacy labels canonical; missing filled; idempotent ----------
  { const goals = { kcal: 1700, prot: 100, wStart: '60', wGoal: '58', custom: 'keep', sched: { 0: 'Nuoto', 1: 'Day 1', 2: 'Casa', 3: 'Giorno 3', 4: 'Core', 5: 'Giorno 4' } };
    const store = { 'fede:profile': prof({ personalised: false }), 'fede:goals': J(goals), 'fede:scheduleVersion': '7' };
    const h = H(REPO, store); h.run('cur=new Date("2026-01-20T12:00:00");render=function(){};loadWeek=async function(){};loadAgenda=async function(){};restoreBundledBackupIfEmpty=async function(){};');
    await h.run('load()');
    const g = JSON.parse(h.store['fede:goals']);
    T('custom schedule kept (not reset), legacy label canonical, missing weekday filled', J(g.sched) === J({ 0: 'Nuoto', 1: 'Giorno 1', 2: 'Casa', 3: 'Giorno 3', 4: 'Core', 5: 'Giorno 4', 6: 'Giorno 5' }), J(g.sched));
    T('unknown goals fields preserved', g.custom === 'keep' && g.kcal === 1700);
    T('snapshot taken before the schedule write', keysOf(h.store, 'fede:autobackup:').length === 1);
    const s1 = J(h.store); await h.run('load()');
    T('schedule reconcile idempotent (2nd load writes nothing)', J(h.store) === s1); }

  // ---------- 13) generatePersonalPlan: cross-day copies get destination-day IDs; PLAN untouched ----------
  { const h = H(REPO); h.run('profile=Object.assign({},DEFAULT_PROFILE,{days:3});');
    const before = h.run('JSON.stringify(PLAN)');
    const p = JSON.parse(h.run('JSON.stringify(preparePlanExerciseIds(generatePersonalPlan()))'));
    const bad = []; Object.keys(p).forEach(d => (p[d].ex || []).forEach(e => { if (e[4] && e[4].indexOf(d.toLowerCase().replace(' ', '-') + '__') !== 0) bad.push(d + ':' + e[4]); }));
    T('3-day plan: every ID belongs to its own day', bad.length === 0, bad.join(','));
    T('PLAN not mutated by generation', h.run('JSON.stringify(PLAN)') === before); }

  // ---------- 14) replaceUserPlanSafely aborts if archive cannot be written ----------
  { const store = { 'fede:userPlan': J(customPlan) }; const h = H(REPO, store);
    h.run('(function(){const orig=localStorage.setItem;localStorage.setItem=function(k,v){if(String(k).indexOf("fede:archivedUserPlan:")===0)throw new Error("quota");return orig(k,v);};})()');
    let threw = false; try { h.run('replaceUserPlanSafely(clonePlan(PLAN),"t",{})'); } catch (e) { threw = true; }
    T('archive failure aborts replacement; stored plan untouched', threw && h.store['fede:userPlan'] === J(customPlan)); }

  console.log(fail === 0 ? '\nALL PLAN/COACH CHECKS PASSED' : '\nFAILURES: ' + fail); process.exit(fail ? 1 : 0);
})();
