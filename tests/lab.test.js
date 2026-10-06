// Calisthenics Lab functional foundation. Synthetic data only, in-memory storage.
const REPO = require('path').resolve(__dirname, '..');
const fs = require('fs');
const H = require('./harness');
let fail = 0; const T = (n, ok, x) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const J = JSON.stringify;
const LAB = 'Lab Calisthenics';
const INTENDED = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'fixtures', 'lab-intended.json'), 'utf8'));
const headHtml = require('./reference').indexHtml; // reviewed release reference (no Git history needed)
const curHtml = fs.readFileSync(REPO + '/index.html', 'utf8');
const slug = v => String(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const setupDom = h => h.run('globalThis.__els={}; document.querySelectorAll=function(sel){return (__els[sel]||[]);};');
const boot = (h, rec) => h.run(`profile=getProfile();cur=new Date("2026-01-20T12:00:00");key="fede:2026-01-20";data=norm(${J(rec || { day: 'Giorno 1' })});lastExLoading=false;lastEx=null;exerciseTab="video";`);

(async () => {
  const h = H(REPO);
  const lab = JSON.parse(h.run('JSON.stringify(LAB_CALISTHENICS_PLAN.ex)'));

  // ---------- 1) Permanent IDs ----------
  T('23 Lab exercises', lab.length === 23);
  T('every Lab exercise has explicit ID lab-calisthenics__<slug>', lab.every(e => e[4] === 'lab-calisthenics__' + slug(e[0])), lab.filter(e => e[4] !== 'lab-calisthenics__' + slug(e[0])).map(e => e[0]).join());
  T('Lab IDs unique', new Set(lab.map(e => e[4])).size === 23);
  T('Lab IDs are canonical fixed points', lab.every(e => h.run(`canonicalExerciseId(${J(e[4])})`) === e[4]));
  T('Lab IDs never collide with main IDs (Frog Stand, Dead Bug)', h.run('KNOWN_PLAN_IDS.has("lab-calisthenics__frog-stand")&&exerciseId("Giorno 3",0,PLAN["Giorno 3"].ex[0])!=="lab-calisthenics__frog-stand"'));
  { const hh = H(REPO, {}, headHtml); const before = JSON.parse(hh.run('JSON.stringify(CALISTHENICS_LIBRARY)')), after = JSON.parse(h.run('JSON.stringify(CALISTHENICS_LIBRARY)'));
    const strip = o => JSON.parse(J(o), (k, v) => Array.isArray(v) && typeof v[0] === 'string' && typeof v[2] === 'number' ? v.slice(0, 4) : v);
    // Intended Lab content lives in tests/fixtures/lab-intended.json (verified against the pre-Lab commit when created).
    T('Lab content (names, prescriptions, sets, tags, groups) matches the intended fixture; only IDs added', J(strip(after)) === J(INTENDED.labContent) && Object.keys(after).length === 5 && Object.values(after).every(g => Object.values(g).every(list => list.every(e => e.length === 5 && e[4] === 'lab-calisthenics__' + slug(e[0])))));
    T('PLAN programming and IDs byte-identical to HEAD', hh.run('JSON.stringify(PLAN)') === h.run('JSON.stringify(PLAN)'));
    T('Mobility/Power/Accessory/Finisher libraries unchanged', ['MOBILITY_LIBRARY', 'POWER_LIBRARY', 'ACCESSORY_LIBRARY', 'FINISHER_LIBRARY'].every(n => hh.run('JSON.stringify(' + n + ')') === h.run('JSON.stringify(' + n + ')'))); }

  // ---------- 2) Namespace ----------
  T('dayPlan(Lab) returns the Lab list', h.run(`dayPlan(${J(LAB)}).ex.length`) === 23);
  T('Lab is NOT a main day (PLAN, allDayKeys, Agenda)', !h.run(`(${J(LAB)} in PLAN)`) && !h.run(`allDayKeys().includes(${J(LAB)})`));

  // ---------- 3) Lab cards + shared exercise screen ----------
  { boot(h); const html = h.run('calisthenicsHTML()');
    T('every Calisthenics card is clickable (data-lab-ex 0..22)', (html.match(/data-lab-ex="\d+"/g) || []).length === 23);
    const lazy = s => s.replace(/ (loading="lazy"|decoding="async")/g, '');
    const mob = h.run('mobilityHTML()'), mobNames = JSON.parse(h.run('JSON.stringify((function(){const o=[];Object.keys(MOBILITY_LIBRARY).forEach(g=>{const x=MOBILITY_LIBRARY[g];(Array.isArray(x)?x:[].concat.apply([],Object.values(x))).forEach(e=>o.push(Array.isArray(e)?e[0]:e.n||e.name));});return o;})())'));
    const imgs = mob.match(/<img [^>]*>/g) || [];
    T('Mobility cards: not clickable / not trackable (no Lab tap, no exercise row, no set inputs)', !/data-lab-ex|data-ex="|data-set=|data-done=/.test(mob));
    T('Mobility cards: every library exercise rendered, images lazy/async', mobNames.length > 0 && mobNames.every(n => mob.includes(n)) && imgs.length > 0 && imgs.every(i => / loading="lazy"/.test(i) && / decoding="async"/.test(i)) && lazy(mob).indexOf('loading=') < 0);
    T('Mobility cards: thumbnail opens the mapped video, else a YouTube search', mobNames.every(n => h.run(`!!VID[${J(n)}]`) ? mob.includes('data-ex-video="' + n + '"') : true) && (mob.match(/data-ex-video="/g) || []).length + (mob.match(/youtube\.com\/results/g) || []).length >= mobNames.length); }
  { const hh = H(REPO); setupDom(hh); boot(hh); hh.run('render=function(){};loadLastSession=async function(){};');
    const card = { dataset: { labEx: '1' } }; hh.run(`__els["[data-lab-ex]"]=[globalThis.__c=${J(card)}];bind();`);
    hh.run('__c.onclick({target:{closest:function(s){return null;}}})');
    T('tap on Lab card opens the shared exercise screen in Lab context', hh.run('view') === 'exercise' && hh.run('exIdx') === 1 && hh.run('exDay()') === LAB && hh.run('exBack()') === 'calisthenics');
    hh.run('view="calisthenics";exIdx=0;__c.onclick({target:{closest:function(s){return s==="a"?{}:null;}}})');
    T('tap on the card thumbnail link does NOT also open the screen', hh.run('view') === 'calisthenics');
    const html = hh.run('exIdx=1;exerciseHTML()');
    T('Lab screen: title, back to Calisthenics Lab, Lab keys', /Wall Walk<small>3 x 3-5 · Lab Calisthenics<\/small>/.test(html) && /data-back="calisthenics"/.test(html) && /data-set="Lab Calisthenics\|lab-calisthenics__wall-walk\|1"/.test(html));
    hh.run('__els["[data-ex]"]=[globalThis.__r={dataset:{ex:"2"}}];bind();__r.onclick();');
    T('opening a main workout exercise resets the context', hh.run('exCtx') === null && hh.run('exDay()') === 'Giorno 1' && hh.run('exBack()') === 'workout'); }

  // ---------- 4) Seconds field ----------
  { boot(h); h.run(`exCtx={day:${J(LAB)},back:"calisthenics"};`);
    const idx = n => lab.findIndex(e => e[0] === n);
    const hold = h.run(`exIdx=${idx('Chest-to-Wall Handstand')};exerciseHTML()`), reps = h.run(`exIdx=${idx('Strict Pull-up')};exerciseHTML()`);
    T('timed Lab exercise uses a dedicated Sec field', /<label>Sec<\/label><input data-set="Lab Calisthenics\|lab-calisthenics__chest-to-wall-handstand\|1" data-f="sec"/.test(hold) && !/data-f="r"/.test(hold));
    T('rep-based Lab exercise keeps Reps', /<label>Reps<\/label><input data-set="Lab Calisthenics\|lab-calisthenics__strict-pull-up\|1" data-f="r"/.test(reps));
    T('timed classification for all Lab exercises', lab.filter(e => h.run(`isTimedExercise(${J(e)})`)).map(e => e[0]).sort().join('|') === lab.filter(e => /\bsec\b/.test(e[1])).map(e => e[0]).sort().join('|'));
    h.run('exCtx=null;'); T('main-workout timed exercise (Frog Stand) now uses Sec too', /<label>Sec<\/label><input data-set="Giorno 3\|giorno-3__frog-stand\|1" data-f="sec"/.test(h.run('data.day="Giorno 3";exIdx=0;exerciseHTML()')));
    // seconds logged earlier as "reps" stay visible in the Sec field (read-only fallback); a real sec value wins
    const legacy = h.run('data=norm({day:"Giorno 3",sets:{"Giorno 3|giorno-3__frog-stand|1":{kg:"",r:"18"},"Giorno 3|giorno-3__frog-stand|2":{kg:"",r:"18",sec:"22"}},done:{}});exIdx=0;exerciseHTML()');
    T('earlier timed value stored as reps is shown in Sec; sec wins when present', /data-set="Giorno 3\|giorno-3__frog-stand\|1" data-f="sec"[^>]*value="18"/.test(legacy) && /data-set="Giorno 3\|giorno-3__frog-stand\|2" data-f="sec"[^>]*value="22"/.test(legacy));
    T('non-timed main exercises keep Reps', /data-f="r"/.test(h.run('data=norm({day:"Giorno 1"});exIdx=0;exerciseHTML()')) && !/data-f="sec"/.test(h.run('exerciseHTML()'))); }
  { const hh = H(REPO); setupDom(hh); boot(hh); hh.run(`exCtx={day:${J(LAB)},back:"calisthenics"};exIdx=2;`);
    hh.run('(function(){const a={dataset:{set:"Lab Calisthenics|lab-calisthenics__chest-to-wall-handstand|1",f:"sec"},value:"25"},b={dataset:{set:"Lab Calisthenics|lab-calisthenics__chest-to-wall-handstand|1",f:"kg"},value:""};__els["[data-set]"]=[a,b];__els["[data-done]"]=[];bind();a.oninput();clearTimeout(saveT);})()');
    T('typing seconds stores {sec} under the Lab key (no reps)', hh.run('JSON.stringify(data.sets["Lab Calisthenics|lab-calisthenics__chest-to-wall-handstand|1"])') === J({ kg: '', r: '', sec: '25' })); }

  // ---------- 5) Right/left: Lab + decided main-plan exercises ----------
  { const uniLab = ['Single-Leg L-Sit', 'Single-Leg Lift', 'Wall Handstand Toe Taps', 'Handstand Toe Taps', 'Frog Stand Weight Shift'];
    T('the 5 Lab exercises are unilateral; the other 18 are not', lab.filter(e => h.run(`isUnilateralExercise(${J(e)})`)).map(e => e[0]).sort().join('|') === uniLab.slice().sort().join('|'));
    const mains = [['Giorno 3', 'Cable Lateral Raise'], ['Giorno 4', 'Cable Kickback'], ['Casa', 'Banded Clamshell'], ['Casa', 'Clamshell con manubrio']];
    T('decided main-plan exercises are unilateral', mains.every(([d, n]) => h.run(`isUnilateralExercise(PLAN[${J(d)}].ex.find(e=>e[0]===${J(n)}))`)) && h.run('isUnilateralExercise(PLAN["Giorno 5"].variants.B.find(e=>e[0]==="Cossack Squat"))'));
    T('existing unilateral exercises unchanged', ['giorno-1__dumbbell-lateral-raise', 'giorno-1__bayesian-cable-curl', 'giorno-2__bulgarian-split-squat', 'giorno-5__bulgarian-split-squat'].every(id => h.run(`UNILATERAL_IDS.has(${J(id)})`)) && h.run('isUnilateralExercise(PLAN["Giorno 2"].ex[0])') === false);
    T('side labels: Lato (weight shift), Gamba (single-leg/kickback/clamshell/cossack), Braccio (toe taps, cable lateral)',
      h.run('sideLabel(["Frog Stand Weight Shift"],"right")') === 'Lato destro' && h.run('sideLabel(["Single-Leg L-Sit"],"left")') === 'Gamba sinistra' && h.run('sideLabel(["Cable Kickback"],"right")') === 'Gamba destra' && h.run('sideLabel(["Banded Clamshell"],"left")') === 'Gamba sinistra' && h.run('sideLabel(["Cossack Squat"],"right")') === 'Gamba destra' && h.run('sideLabel(["Handstand Toe Taps"],"right")') === 'Braccio destro' && h.run('sideLabel(["Cable Lateral Raise"],"left")') === 'Braccio sinistro' && h.run('sideLabel(["Bulgarian Split Squat"],"right")') === 'Gamba destra');
    boot(h); h.run(`exCtx={day:${J(LAB)},back:"calisthenics"};`);
    const i = lab.findIndex(e => e[0] === 'Single-Leg L-Sit'); const html = h.run(`exIdx=${i};exerciseHTML()`);
    T('Single-Leg L-Sit: right/left rows with Sec fields', /data-set="Lab Calisthenics\|lab-calisthenics__single-leg-l-sit\|1\|right" data-f="sec"/.test(html) && /data-set="Lab Calisthenics\|lab-calisthenics__single-leg-l-sit\|1\|left" data-f="sec"/.test(html) && /Gamba destra/.test(html));
    const one = { day: 'Giorno 1', done: { ['Lab Calisthenics|lab-calisthenics__single-leg-l-sit|1|right']: true } }, both = { day: 'Giorno 1', done: { ['Lab Calisthenics|lab-calisthenics__single-leg-l-sit|1|right']: true, ['Lab Calisthenics|lab-calisthenics__single-leg-l-sit|1|left']: true } };
    T('Lab unilateral completion needs both sides', h.run(`exDone(${J(one)},${J(LAB)},${i}).n`) === 0 && h.run(`exDone(${J(both)},${J(LAB)},${i}).n`) === 1);
    // main-plan exercise newly unilateral: legacy bilateral data stays readable and counted
    h.run('exCtx=null;'); const old = { day: 'Giorno 3', sets: { 'Giorno 3|giorno-3__cable-lateral-raise|1': { kg: '5', r: '12' } }, done: { 'Giorno 3|giorno-3__cable-lateral-raise|1': true } };
    const html2 = h.run(`data=norm(${J(old)});exIdx=3;exerciseHTML()`);
    T('Cable Lateral Raise: right/left rows + earlier bilateral set shown read-only', /data-set="Giorno 3\|giorno-3__cable-lateral-raise\|1\|right"/.test(html2) && /Registrato senza lato: 5 kg × 12 reps/.test(html2));
    T('earlier bilateral tick still counts as done', h.run(`exDone(${J(old)},"Giorno 3",3).n`) === 1); }

  // ---------- 6) Separation from main workout ----------
  { const rec = { day: 'Giorno 1', sets: { 'Giorno 1|giorno-1__pull-up|1': { kg: '10', r: '5' }, 'Lab Calisthenics|lab-calisthenics__strict-pull-up|1': { kg: '20', r: '6' }, 'Lab Calisthenics|lab-calisthenics__chest-to-wall-handstand|1': { kg: '', r: '', sec: '30' } }, done: { 'Lab Calisthenics|lab-calisthenics__strict-pull-up|1': true } };
    T('volume excludes Lab sets (50 kg, 1 set — not 170)', h.run(`JSON.stringify(vol(${J(rec)}))`) === J({ v: 50, s: 1 }));
    T('main-day completion unaffected by Lab ticks', h.run(`doneCount(${J(rec)},"Giorno 1").done`) === 0);
    T('Lab completion counted separately', h.run(`exDone(${J(rec)},${J(LAB)},${lab.findIndex(e => e[0] === 'Strict Pull-up')}).n`) === 1);
    const labOnly = { day: 'Giorno 2', sets: { 'Lab Calisthenics|lab-calisthenics__active-hang|1': { kg: '', r: '', sec: '20' } }, done: {} };
    T('Lab-only day: zero resistance volume, but Lab activity', h.run(`vol(${J(labOnly)}).s`) === 0 && h.run(`labActivity(${J(labOnly)})`) === 1);
    h.run(`calMonth=new Date("2026-01-15T12:00:00");calData={5:norm(${J(labOnly)}),6:norm(${J({ day: 'Giorno 1', sets: {}, done: {} })})};cur=new Date("2026-01-20T12:00:00");`);
    const cal = h.run('calendarHTML()');
    T('calendar: Lab-only day counts as a trained/activity day', /data-caldate="2026-01-05"[^>]*background:var\(--rose\)/.test(cal) && /<div style="font-size:22px;font-weight:800">1<\/div>\s*<div[^>]*>SESSIONI COMPLETATE/.test(cal.replace(/'\+'/g, '')), (cal.match(/font-size:22px;font-weight:800">(\d+)</) || [])[1]);
    T('calendar: empty day not trained', !/data-caldate="2026-01-06"[^>]*background:var\(--rose\)/.test(cal)); }

  // ---------- 7) Notes ----------
  { boot(h); h.run(`exCtx={day:${J(LAB)},back:"calisthenics"};exIdx=${lab.findIndex(e => e[0] === 'Frog Stand')};`);
    T('Lab notes key separate from the main Frog Stand notes', /data-ex-note="fede:exnote:lab-calisthenics__frog-stand"/.test(h.run('exerciseHTML()')) && /data-ex-note="fede:exnote:giorno-3__frog-stand"/.test(h.run('exCtx=null;data.day="Giorno 3";exIdx=0;exerciseHTML()'))); }

  // ---------- 8) History: last time, progression, Carichi ----------
  { const fi = lab.findIndex(e => e[0] === 'Frog Stand');
    const store = {
      'fede:2026-01-05': J({ day: 'Giorno 3', sets: { 'Giorno 3|giorno-3__frog-stand|1': { kg: '', r: '20' }, 'Lab Calisthenics|lab-calisthenics__frog-stand|1': { kg: '', r: '', sec: '12' } }, done: {}, dayEx: ['Frog Stand'], dayExIds: ['giorno-3__frog-stand'] }),
      'fede:2026-01-12': J({ day: 'Giorno 1', sets: { 'Lab Calisthenics|lab-calisthenics__frog-stand|1': { kg: '', r: '', sec: '18' }, 'Lab Calisthenics|lab-calisthenics__frog-stand|2': { kg: '', r: '', sec: '20' }, 'Lab Calisthenics|lab-calisthenics__single-leg-l-sit|1|right': { kg: '', r: '', sec: '8' }, 'Lab Calisthenics|lab-calisthenics__strict-pull-up|1': { kg: '', r: '5' } }, done: {} }) };
    const hh = H(REPO, store); const snap = J(hh.store); boot(hh);
    await hh.run(`loadLastSession(${J(LAB)},${fi},"Frog Stand")`);
    T('Lab last time reads the Lab namespace (seconds), newest session', hh.run('JSON.stringify(lastEx)') === J({ 1: { kg: '', r: '', sec: '18' }, 2: { kg: '', r: '', sec: '20' } }), hh.run('JSON.stringify(lastEx)'));
    await hh.run('loadLastSession("Giorno 3",0,"Frog Stand")');
    T('main Frog Stand last time unchanged (reads only main data)', hh.run('JSON.stringify(lastEx)') === J({ 1: { kg: '', r: '20' } }), hh.run('JSON.stringify(lastEx)'));
    await hh.run(`loadLastSession(${J(LAB)},${lab.findIndex(e => e[0] === 'Single-Leg L-Sit')},"Single-Leg L-Sit")`);
    T('Lab last time includes right/left', hh.run('JSON.stringify(lastEx)') === J({ '1-right': { kg: '', r: '', sec: '8' } }));
    await hh.run(`loadLastSession(${J(LAB)},${fi},"Frog Stand")`);
    hh.run(`exCtx={day:${J(LAB)},back:"calisthenics"};exIdx=${fi};`);
    const scr = hh.run('exerciseHTML()');
    T('last-time panel shows seconds', /Set 1<\/span><b>— × 18 sec<\/b>/.test(scr));
    T('progression target in seconds', /target-main">\d+ sec × 4</.test(scr) && /1–2 secondi/.test(scr), (scr.match(/target-main">([^<]*)</) || [])[1]);
    T('"last recorded" tile shows seconds', /18s · 20s/.test(scr));
    const hist = JSON.parse(await hh.run('labStrengthHist("lab-calisthenics__frog-stand").then(x=>JSON.stringify(x))'));
    T('Carichi Lab series (sec, best per session, main data excluded)', J(hist.map(x => [x.kg, x.unit])) === J([[12, 'sec'], [20, 'sec']]), J(hist));
    const ph = JSON.parse(await hh.run('labStrengthHist("lab-calisthenics__strict-pull-up").then(x=>JSON.stringify(x))'));
    T('Carichi Lab series in reps for rep-based exercises', J(ph.map(x => [x.kg, x.unit])) === J([[5, 'reps']]));
    hh.run('strengthEx="lab:lab-calisthenics__frog-stand";'); await hh.run('loadStrengthHist(strengthEx)');
    hh.run('evoTab="carichi";'); const evo = hh.run('evoHTML()');
    T('Carichi picker offers Lab exercises by permanent ID; chart in sec', /<optgroup label="Calisthenics Lab">/.test(evo) && /value="lab:lab-calisthenics__frog-stand" selected/.test(evo) && /Progressione \(sec\)/.test(evo) && /20 sec · /.test(evo));
    hh.run('globalThis.__els={};document.querySelectorAll=function(s){return __els[s]||[];};__els["[data-ex-history]"]=[globalThis.__hb={}];bind();render=function(){};__hb.onclick();');
    T('"Apri storico completo" from a Lab exercise selects its Lab series', hh.run('strengthEx') === 'lab:lab-calisthenics__frog-stand');
    T('no storage writes from any Lab history read', J(hh.store) === snap); }
  { // main chart output unchanged (kg default)
    const hh = H(REPO), hb = H(REPO, {}, headHtml); const pts = '[{d:new Date("2026-01-01T12:00:00"),w:40},{d:new Date("2026-01-08T12:00:00"),w:42.5}]';
    T('main Carichi chart output byte-identical to HEAD', hh.run('lineChart(' + pts + ')') === hb.run('lineChart(' + pts + ')')); }

  // ---------- 9) Rest timer ----------
  { const hb = H(REPO, {}, headHtml); const descs = JSON.parse(h.run('JSON.stringify((function(){const o=[];Object.keys(PLAN).forEach(d=>{PLAN[d].ex.concat(PLAN[d].variants?PLAN[d].variants.B:[]).forEach(e=>o.push([d,e[0],e[1]]));});return o;})())'));
    const changed = descs.filter(x => h.run(`restSecondsForExercise(${J(x[2])})`) !== hb.run(`restSecondsForExercise(${J(x[2])})`)).map(x => x[0] + ':' + x[1] + ' ' + hb.run(`restSecondsForExercise(${J(x[2])})`) + '→' + h.run(`restSecondsForExercise(${J(x[2])})`));
    const rest = descs.map(x => [x[0], x[1], x[2], h.run(`restSecondsForExercise(${J(x[2])})`)]);
    T('main-plan rest seconds match the intended fixture (every exercise)', J(rest) === J(INTENDED.mainRest), J(rest.filter((r, i) => J(r) !== J(INTENDED.mainRest[i]))));
    T('timed holds rest after the hold, never the hold time', ['Giorno 3:Frog Stand:90', 'Giorno 4:L-Sit:90', 'Giorno 4:Vacuum addominale:45', 'Core:Vacuum addominale:90'].every(k => { const [d, n, sec] = k.split(':'); return rest.some(r => r[0] === d && r[1] === n && r[3] === +sec); }));
    T('every non-timed main exercise keeps its explicit/derived rest (fixture)', descs.every((x, i) => /\bsec\b/.test(x[2].split('·')[0]) || rest[i][3] === INTENDED.mainRest[i][3]) && J(changed) === J([]), J(changed));
    T('Lab holds use 90 s rest, never the hold time', lab.filter(e => /sec/.test(e[1])).every(e => h.run(`restSecondsForExercise(${J(e[1])})`) === 90));
    T('explicit rest segments respected', h.run('restSecondsForExercise("4 x 4-6 · RIR 1-2 · 180 sec")') === 180 && h.run('restSecondsForExercise("4-5 x 5-20 sec · tecnica · 60-90 sec")') === 90); }

  // ---------- 10) FRAME VIDEO handler ----------
  { const hh = H(REPO); setupDom(hh); boot(hh);
    hh.run('globalThis.__opened=[];window.open=function(u,t,f){__opened.push([u,t,f]);};');
    hh.run('globalThis.__a1={dataset:{exVideo:"Dead Bug"},closest:function(s){return null;}};globalThis.__a2={dataset:{exVideo:"Machine Hip Thrust"},closest:function(s){return s==="[data-ex]"?{}:null;}};__els["[data-ex-video]"]=[__a1,__a2];bind();');
    hh.run('globalThis.__ev1={pd:0,sp:0,preventDefault(){this.pd++;},stopPropagation(){this.sp++;}};__a1.onclick(__ev1);');
    T('FRAME VIDEO outside a row opens the real video (no # navigation)', hh.run('JSON.stringify(__opened)') === J([['https://www.youtube.com/watch?v=bxn9FBrt4-A', '_blank', 'noopener']]) && hh.run('__ev1.pd') === 1);
    hh.run('globalThis.__ev2={pd:0,sp:0,preventDefault(){this.pd++;},stopPropagation(){this.sp++;}};__a2.onclick(__ev2);');
    T('FRAME VIDEO inside a workout row: no # navigation, row still opens the exercise', hh.run('__opened.length') === 1 && hh.run('__ev2.pd') === 1 && hh.run('__ev2.sp') === 0); }

  // ---------- 11) Main-workout regression: exercise screen identical to HEAD (except intended) ----------
  { let mism = [], n = 0; const decided = new Set(['giorno-3__cable-lateral-raise', 'giorno-4__cable-kickback', 'casa__banded-clamshell', 'casa__clamshell-con-manubrio', 'giorno-5__cossack-squat']);
    // Intended differences normalised: media block (photo instead of emoji), lazy/async image attributes, rest value.
    const norm = s => s.replace(/<div class="exercise-media">[\s\S]*?<\/a><\/div>/, '<MEDIA>').replace(/ (loading="lazy"|decoding="async")/g, '').replace(/id="restTimer">\d\d:\d\d</, 'id="restTimer">--:--<').replace(/<a class="vidbtn"[^>]*>▶ (Guarda il video|Cerca video guida)<\/a>/, ''); // media review pass: video button follows the new links
    ['Giorno 1', 'Giorno 2', 'Giorno 3', 'Giorno 4', 'Giorno 5', 'Core', 'Casa', 'Nuoto'].forEach((day, di) => {
      const hc = H(REPO), hb = H(REPO, {}, headHtml);
      JSON.parse(hc.run(`JSON.stringify(PLAN[${J(day)}].ex)`)).forEach((e, i) => { if (decided.has(e[4]) || /\bsec\b/.test(e[1].split('·')[0])) return; // + timed exercises now use Sec (tested above)
        for (let v = 0; v < 2; v++) { const rec = { day, sets: {}, done: {} };
          for (let s = 1; s <= 5; s++) { const k = day + '|' + e[4] + '|' + s; if ((i + s + v + di) % 3 === 0) { rec.sets[k] = { kg: String(10 + s), r: String(5 + v) }; rec.done[k] = true; } }
          const run = hh => hh.run(`(function(){profile=getProfile();cur=new Date("2026-01-20T12:00:00");key="k";data=norm(${J(rec)});exIdx=${i};lastExLoading=false;lastEx=null;exerciseTab="video";return exerciseHTML();})()`);
          n++; if (norm(run(hc)) !== norm(run(hb))) mism.push(day + ':' + e[0]); } }); });
    T('main exercise screen identical to HEAD outside the media block (' + n + ' renders; decided right/left + timed excluded)', mism.length === 0, [...new Set(mism)].join()); }

  // ---------- 12) Storage safety, import/export, migrations ----------
  { const added = curHtml.slice(curHtml.indexOf('<script>')).split('\n').filter(l => headHtml.indexOf(l) < 0);
    T('no removeItem/clear/new setItem added by the Lab phase', !added.some(l => /localStorage\.(removeItem|clear|setItem)/.test(l)), added.filter(l => /localStorage\.(removeItem|clear|setItem)/.test(l)).join(' | '));
    const hh = H(REPO); boot(hh); const before = J(hh.store);
    hh.run(`exCtx={day:${J(LAB)},back:"calisthenics"};exIdx=0;calisthenicsHTML();exerciseHTML();`);
    T('rendering Lab screens writes nothing', J(hh.store) === before);
    const rec = J({ day: 'Giorno 1', sets: { 'Lab Calisthenics|lab-calisthenics__wall-walk|1': { kg: '', r: '4' } }, done: {} });
    const he = H(REPO, { 'fede:2026-01-10': rec }); he.run('profile=getProfile();');
    const exp = he.run('JSON.stringify(buildBackupObject())');
    T('Lab data included in export byte-exact', JSON.parse(exp).localStorage['fede:2026-01-10'] === rec);
    const hi = H(REPO); hi.run('profile=getProfile();'); const out = JSON.parse(hi.run(`JSON.stringify(applyBackupImport(analyzeBackup(parseBackupText(${J(exp)}).backup),{}))`));
    T('Lab data round-trips through import', out.ok && hi.store['fede:2026-01-10'] === rec);
    const hm = H(REPO, { 'fede:2026-01-10': rec }); hm.run('migrateLegacyHistory()');
    T('legacy-history migration never annotates Lab-only records', hm.store['fede:2026-01-10'] === rec); }

  console.log(fail === 0 ? '\nALL LAB CHECKS PASSED' : '\nFAILURES: ' + fail); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL harness error: ' + (e && e.stack || e)); process.exit(1); });
