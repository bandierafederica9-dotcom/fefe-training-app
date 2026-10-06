// "Make the app feel finished" pass: one focused check per fix. Synthetic data, in-memory storage.
const REPO = require('path').resolve(__dirname, '..');
const fs = require('fs');
const H = require('./harness');
let fail = 0; const T = (n, ok, x) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const J = JSON.stringify;
const REF = require('./reference'); // reviewed release reference (no Git history needed)
const headHtml = REF.indexHtml;
const html = fs.readFileSync(REPO + '/index.html', 'utf8');
const dom = h => h.run('globalThis.__els={}; document.querySelectorAll=function(sel){return (__els[sel]||[]);};');
const boot = (h, rec) => h.run(`profile=getProfile();cur=new Date("2026-01-20T12:00:00");key="fede:2026-01-20";data=norm(${J(rec || { day: 'Giorno 1' })});lastExLoading=false;lastEx=null;exerciseTab="video";`);

(async () => {
  // ---------- B1: "Fine ✓" returns to where the exercise was opened ----------
  { const h = H(REPO); dom(h); boot(h); h.run('render=function(){};loadLastSession=async function(){};');
    h.run('openLabExercise(LAB_CALISTHENICS_PLAN.ex.length-1);__els["[data-exnav]"]=[globalThis.__n={dataset:{exnav:"1"}}];bind();__n.onclick();');
    T('B1 Lab: Fine on the last exercise returns to Calisthenics Lab', h.run('view') === 'calisthenics');
    h.run('exCtx=null;data.day="Giorno 1";exIdx=PLAN["Giorno 1"].ex.length-1;view="exercise";bind();__n.onclick();');
    T('B1 main workout: Fine still returns to the workout', h.run('view') === 'workout'); }

  // ---------- B2: rest timer ----------
  { const h = H(REPO); boot(h);
    h.run('globalThis.__now=1000000;Date.now=function(){return __now;};globalThis.__ivals=0;const si=setInterval;setInterval=function(f,t){__ivals++;return si(function(){},100000);};globalThis.__vib=0;navigator.vibrate=function(){__vib++;};');
    h.run('globalThis.__rt={textContent:"01:30"};document.getElementById=(function(g){return function(id){return id==="restTimer"?__rt:g(id);};})(document.getElementById);');
    h.run('view="exercise";exCtx=null;exIdx=0;restTimerAttach(__rt,90);restTimerStart(90);');
    T('B2 start: counts from the planned rest', h.run('__rt.textContent') === '01:30' && h.run('__ivals') === 1);
    h.run('__now+=10000;restTick();');
    T('B2 counts from an end timestamp (accurate after suspension)', h.run('__rt.textContent') === '01:20');
    h.run('__rt={textContent:"01:30"};restTimerAttach(__rt,90);');
    T('B2 re-render of the same exercise keeps the running countdown', h.run('__rt.textContent') === '01:20' && h.run('restTimer.endAt>0'));
    h.run('restTimerStart(90);'); T('B2 pressing start again never creates a second interval', h.run('__ivals') === 1);
    h.run('restTimerAdd(30,90);__now+=0;restTick();'); T('B2 +30s extends a running countdown', h.run('__rt.textContent') === '01:50');
    h.run('view="home";restTimerAttach(null,0);'); T('B2 leaving to another screen does not cancel the rest', h.run('restTimer.endAt>0'));
    h.run('view="exercise";__now+=200000;restTick();'); T('B2 reaching zero vibrates once and stops', h.run('__vib') === 1 && h.run('restTimer.id') === null && h.run('__rt.textContent') === '00:00');
    h.run('restTick();'); T('B2 no repeated vibration', h.run('__vib') === 1);
    h.run('restTimerStart(90);'); T('B2 start after finishing restarts from the planned rest', h.run('__rt.textContent') === '01:30');
    h.run('exIdx=1;restTimerAttach(__rt,75);'); T('B2 a different exercise resets the timer', h.run('restTimer.endAt') === 0 && h.run('restTimer.key') === 'Giorno 1|1');
    h.run('restTimerReset(75);'); T('B2 reset shows the planned rest', h.run('__rt.textContent') === '01:15');
    T('B2 timer state is no longer local to bind()', !/let restTimerId=null, restRemaining=null;/.test(html)); }

  // ---------- B3: Agenda ignores Lab-only entries for the main day ----------
  { const h = H(REPO); boot(h); h.run('goals.sched={1:"Giorno 1",2:"Giorno 2",3:"Giorno 3",4:"Riposo",5:"Giorno 4",6:"Giorno 5",0:"Riposo"};agView="sett";');
    h.run('agenda=[{d:new Date("2026-01-19T12:00:00"),x:norm({day:"Giorno 1",sets:{"Lab Calisthenics|lab-calisthenics__wall-walk|1":{kg:"",r:"4"}},done:{}})}];');
    T('B3 Lab-only day still shows the main workout "da fare"', /da fare/.test(h.run('agendaHTML()')));
    h.run('agenda=[{d:new Date("2026-01-19T12:00:00"),x:norm({day:"Giorno 1",sets:{"Giorno 1|giorno-1__pull-up|1":{kg:"",r:"4"}},done:{}})}];');
    T('B3 a logged main day is still shown as started', !/da fare/.test(h.run('agendaHTML()'))); }

  // ---------- B4: last time on a PLAN-fallback day of a personalised plan ----------
  { const h = H(REPO, { 'fede:profile': J({ setupComplete: true, personalised: true }), 'fede:userPlan': J({ 'Giorno 1': { ex: [['Pull-up', 'x', 3, null, 'giorno-1__pull-up']] } }), 'fede:planVersion': '9', 'fede:2026-01-10': J({ day: 'Casa', sets: { 'Casa|casa__glute-bridge|1': { kg: '', r: '12' } }, done: {} }) });
    h.run('profile=getProfile();ensureUserPlan();cur=new Date("2026-01-20T12:00:00");data=norm({day:"Casa"});'); await h.run('loadLastSession("Casa",0,"Glute Bridge")');
    T('B4 personalised plan: Casa last time is found', h.run('JSON.stringify(lastEx)') === J({ 1: { kg: '', r: '12' } })); }

  // ---------- B5: Carichi for bodyweight and timed exercises; load chart unchanged ----------
  { const r = (k, v) => J({ day: 'Giorno 1', sets: { ['Giorno 1|giorno-1__pull-up|1']: v }, done: {} });
    const h = H(REPO, { 'fede:2026-01-05': r(0, { kg: '', r: '4' }), 'fede:2026-01-12': r(0, { kg: '', r: '6' }) }); boot(h);
    await h.run('loadStrengthHist("Pull-up")');
    T('B5 bodyweight Pull-up charts best reps', h.run('JSON.stringify(strengthHist.map(x=>[x.kg,x.unit]))') === J([[4, 'reps'], [6, 'reps']]));
    h.run('evoTab="carichi";strengthEx="Pull-up";'); const evo = h.run('evoHTML()');
    T('B5 chart labelled in reps', /Progressione \(reps\)/.test(evo) && /6 reps · /.test(evo));
    const f = (v) => J({ day: 'Giorno 3', sets: { 'Giorno 3|giorno-3__frog-stand|1': v }, done: {} });
    const h2 = H(REPO, { 'fede:2026-01-06': f({ kg: '', r: '15' }), 'fede:2026-01-13': f({ kg: '', r: '', sec: '25' }) }); boot(h2);
    await h2.run('loadStrengthHist("Frog Stand")');
    T('B5 timed Frog Stand charts seconds (old reps-as-seconds + new sec)', h2.run('JSON.stringify(strengthHist.map(x=>[x.kg,x.unit]))') === J([[15, 'sec'], [25, 'sec']]));
    const k = (v) => J({ day: 'Giorno 2', sets: { 'Giorno 2|giorno-2__machine-hip-thrust|1': v }, done: {} });
    const st = { 'fede:2026-01-05': k({ kg: '40', r: '8' }), 'fede:2026-01-08': k({ kg: '', r: '10' }), 'fede:2026-01-12': k({ kg: '45', r: '7' }) };
    const hc = H(REPO, st), hb = H(REPO, st, headHtml); boot(hc); boot(hb);
    await hc.run('loadStrengthHist("Machine Hip Thrust")'); await hb.run('loadStrengthHist("Machine Hip Thrust")');
    T('B5 load chart (kg) identical to HEAD', hc.run('JSON.stringify(strengthHist)') === hb.run('JSON.stringify(strengthHist)'), hc.run('JSON.stringify(strengthHist)')); }

  // ---------- B6: Carichi picker lists Coach / personal exercises ----------
  { const h = H(REPO, { 'fede:profile': J({ setupComplete: true, personalised: true }), 'fede:userPlan': J({ 'Giorno 1': { ex: [['Hammer Curl', '3 x 8-12', 3, null, 'giorno-1__hammer-curl']] } }), 'fede:planVersion': '9' });
    h.run('profile=getProfile();ensureUserPlan();data=norm({day:"Giorno 1"});evoTab="carichi";strengthHist=[];');
    const evo = h.run('evoHTML()');
    T('B6 Coach-added exercise selectable; default plan names still listed once', /value="Hammer Curl"/.test(evo) && (evo.match(/value="Pull-up"/g) || []).length === 1); }

  // ---------- B7: timed exercises use Sec everywhere ----------
  { const h = H(REPO); boot(h, { day: 'Giorno 3' }); h.run('exCtx=null;exIdx=0;');
    T('B7 Frog Stand set field is Sec', /<label>Sec<\/label><input data-set="Giorno 3\|giorno-3__frog-stand\|1" data-f="sec"/.test(h.run('exerciseHTML()')));
    T('B7 main timed exercises: Frog Stand, L-Sit, both Vacuum', ['Giorno 3', 'Giorno 4', 'Core'].map(d => h.run(`PLAN[${J(d)}].ex.filter(e=>isTimedExercise(e)).map(e=>e[0]).join(",")`)).join('|') === 'Frog Stand|L-Sit,Vacuum addominale|Vacuum addominale');
    const rec = { day: 'Giorno 3', sets: { 'Giorno 3|giorno-3__frog-stand|1': { kg: '', r: '', sec: '20' }, 'Giorno 3|giorno-3__machine-dip|1': { kg: '30', r: '8' } }, done: {} };
    T('B7 a seconds-only set counts as a set; kg volume unchanged', h.run(`JSON.stringify(vol(${J(rec)}))`) === J({ v: 240, s: 2 }));
    h.run('lastEx={1:{kg:"",r:"",sec:"20"},2:{kg:"",r:"",sec:"20"},3:{kg:"",r:"",sec:"20"},4:{kg:"",r:"",sec:"20"},5:{kg:"",r:"",sec:"20"}};lastExDate=new Date();');
    const scr = h.run('exerciseHTML()');
    T('B7 progression for timed main exercise in seconds', /target-main">20 sec × 5</.test(scr) || /target-main">\d+ sec × \d+</.test(scr), (scr.match(/target-main">([^<]*)</) || [])[1]);
    T('B7 history readers prefer sec over an old reps value', h.run('lastEx={1:{kg:"",r:"10",sec:"25"}};JSON.stringify(lastValidSessionForTarget({sets:1,min:5,max:30}))') === J([{ kg: 0, r: 25 }])); }

  // ---------- B8 / media: exercise screen shows its real photo when there is no video ----------
  { const h = H(REPO); boot(h); h.run('exCtx=null;exIdx=0;data.day="Nuoto";');
    const pu = h.run('exerciseHTML()');
    // Media review pass gave Pull-up/Face Pull real videos; Nuoto (photo, no video) and a Lab drill without assets keep the fallbacks.
    T('B8 Nuoto (photo, no video): photo shown + search link kept', /media-photo[\s\S]{0,300}<img class="media-photo-img" src="assets\/exercises\/photos\/nuoto\.jpg"/.test(pu) && /youtube\.com\/results/.test(pu));
    T('B8 Wall Handstand Toe Taps (no photo, no video): neutral placeholder kept', /placeholder-detail-art/.test(h.run('exCtx={day:LAB_CALISTHENICS_DAY,back:"calisthenics"};exIdx=3;exerciseHTML()')));
    h.run('exCtx=null;data.day="Giorno 1";');
    T('B8 Hip Thrust (real video): FRAME VIDEO poster kept', /local-player-poster[\s\S]*FRAME VIDEO/.test(h.run('data.day="Giorno 2";exIdx=0;exerciseHTML()'))); }

  // ---------- B9: category-aware fallback + equivalent photos ----------
  { const h = H(REPO); const th = n => h.run(`localThumbnail(${J(n)})`).replace('assets/exercises/', '');
    T('B9 Hammer Curl / Rope Triceps Pushdown -> upper generic', th('Hammer Curl') === 'upper-generic.svg' && th('Rope Triceps Pushdown') === 'upper-generic.svg');
    T('B9 Goblet Squat / Box Jump (unmapped) -> power generic', th('Goblet Squat') === 'power-generic.svg' && th('Box Jump') === 'power-generic.svg');
    T('B9 Plank (unmapped) / Wall Handstand Weight Shift', th('Plank') === 'mobility-generic.svg' && th('Wall Handstand Weight Shift') === 'upper-generic.svg');
    T('B9 unmapped hip-thrust variants keep the glute illustration', th('Hip Thrust con elastico') === 'glute-bridge.svg');
    T('B9 Coach Cable Row / Romanian Deadlift / Leg Curl Machine use existing photos of the same movement', th('Cable Row') === 'photos/seated-cable-row.jpg' && th('Romanian Deadlift') === 'photos/barbell-db-rdl.jpg' && th('Leg Curl Machine') === 'photos/seated-leg-curl.jpg');
    const REVIEWED = ['Face Pull', 'Reverse Lunge', 'Step-Up', 'Triceps Cable Pushdown', 'Ab Wheel', 'Mountain Climbers', 'Power Clean', 'Scapular Pull-up', 'Assisted Pull-up', 'Pull-up', 'Lat Pulldown presa larga', 'DB Overhead Press'];
    T('B9 every mapped exercise keeps its previous image (except the 12 reviewed replacements)', (() => { const hb = H(REPO, {}, headHtml); const names = JSON.parse(hb.run('JSON.stringify(Object.keys(MUSCLE_DB).concat(Object.keys(EXDB)))')); return names.filter(n => hb.run(`exerciseAsset(${J(n)})`) && !REVIEWED.includes(n)).every(n => hb.run(`localThumbnail(${J(n)})`) === h.run(`localThumbnail(${J(n)})`)); })()); }

  // ---------- B10: set-number badge follows the tick ----------
  { const h = H(REPO); const click = h.ctx.__listeners.document.filter(x => x.type === 'click');
    h.run('globalThis.__num={classList:{s:new Set(),toggle(c,on){on?this.s.add(c):this.s.delete(c);},contains(c){return this.s.has(c);}}};globalThis.__btn={className:"chk on",closest:function(s){return s==="[data-done]"?this:(s===".exrow"?{querySelector:function(){return __num;}}:null);},classList:{add(){}}};');
    click.forEach(c => c.fn({ target: h.run('__btn') }));
    T('B10 ticking marks the badge done', h.run('__num.classList.contains("done")') === true);
    h.run('__btn.className="chk";'); click.forEach(c => c.fn({ target: h.run('__btn') }));
    T('B10 unticking clears it', h.run('__num.classList.contains("done")') === false); }

  // ---------- B11/B12 + reference scan: every rendered image exists; thumbnails lazy ----------
  { const h = H(REPO); boot(h); h.run('agenda=[];week=[];hist=[];strengthHist=[];calData={};');
    let src = ''; ['home', 'workout', 'calisthenics', 'mobility', 'video', 'power', 'accessories', 'finishers'].forEach(v => { src += h.run(`view=${J(v)};renderCore();document.getElementById("page").innerHTML`); });
    ['Giorno 1', 'Giorno 2', 'Giorno 3', 'Giorno 4', 'Giorno 5', 'Core', 'Casa', 'Nuoto'].forEach(d => { const n = h.run(`dayPlan(${J(d)}).ex.length`); for (let i = 0; i < n; i++) ['video', 'muscles'].forEach(tab => { src += h.run(`data.day=${J(d)};exCtx=null;exIdx=${i};exerciseTab=${J(tab)};exerciseHTML()`); }); });
    for (let i = 0; i < 23; i++) src += h.run(`exCtx={day:LAB_CALISTHENICS_DAY,back:"calisthenics"};exIdx=${i};exerciseTab="video";exerciseHTML()`);
    const imgs = [...new Set([...src.matchAll(/<img[^>]+src="([^"]+)"/g)].map(m => m[1]))];
    const missing = imgs.filter(u => !/^(https?:|data:)/.test(u) && !fs.existsSync(REPO + '/' + u));
    T('no broken image reference in any view or exercise screen (' + imgs.length + ' distinct images)', missing.length === 0, missing.join(', '));
    T('B11 video library uses the photos directory', /assets\/exercises\/photos\/[a-z-]+\.jpg/.test(h.run('videoHTML()')) && !/src="assets\/exercises\/[a-z-]+\.jpg"/.test(h.run('videoHTML()')));
    T('B12 list thumbnails load lazily and decode asynchronously', /loading="lazy" decoding="async"/.test(h.run('videoEmbedHTML("Pull-up","x")')) && /loading="lazy" decoding="async"/.test(h.run('videoEmbedHTML("Dead Bug","x")'))); }

  // ---------- Lab cards keyboard + Coach panel one-shot ----------
  { const h = H(REPO); dom(h); boot(h); h.run('render=function(){};loadLastSession=async function(){};__els["[data-lab-ex]"]=[globalThis.__c={dataset:{labEx:"3"}}];bind();');
    T('Lab card has button semantics', /data-lab-ex="0" role="button" tabindex="0" aria-label="Apri Wrist Prep"/.test(h.run('calisthenicsHTML()')));
    h.run('__c.onkeydown({key:"Enter",preventDefault(){}});'); T('Enter opens the Lab exercise', h.run('view') === 'exercise' && h.run('exIdx') === 3);
    h.run('view="calisthenics";__c.onkeydown({key:"Tab"});'); T('other keys do nothing', h.run('view') === 'calisthenics'); }
  { const h = H(REPO); boot(h);
    T('Coach panel: enter class only on the closed->open render', !/mc-enter/.test(h.run('miniCoachOpen=false;miniCoachHTML()')) && /mc-enter/.test(h.run('miniCoachOpen=true;miniCoachHTML()')) && !/mc-enter/.test(h.run('miniCoachHTML()')) && !/mc-enter/.test(h.run('miniCoachHTML()')) && /mc-enter/.test(h.run('miniCoachOpen=false;miniCoachHTML();miniCoachOpen=true;miniCoachHTML()'))); }

  // ---------- CSS P1 layer ----------
  { const css = html.slice(html.indexOf('<style>') + 7, html.indexOf('</style>'));
    const p0 = css.slice(css.indexOf('/* ================= MOTION · P0'), css.indexOf('/* ================= MOTION · P1'));
    const p1 = css.slice(css.indexOf('/* ================= MOTION · P1'));
    T('P1 layer appended after the P0 layer', p0.length > 0 && p1.length > 0 && css.indexOf('MOTION · P1') > css.indexOf('MOTION · P0'));
    T('P0 layer text intact (variables, press, chk pop, entry, reduced motion)', /--d-press:90ms/.test(p0) && /fedeChkPop/.test(p0) && /#page\[data-enter\]>\*\{animation:fedeScreenIn/.test(p0) && /prefers-reduced-motion: reduce/.test(p0));
    const kf = [...p1.matchAll(/@keyframes [A-Za-z]+\{((?:[^{}]*\{[^}]*\})*)\}/g)].map(m => m[1]).join(' ');
    T('P1 keyframes animate only transform/opacity', [...kf.matchAll(/([a-z-]+)\s*:/g)].every(m => m[1] === 'transform' || m[1] === 'opacity'));
    T('P1 entry animations gated or one-shot', /#page\[data-enter\] \.workout-progress-bar i\{/.test(p1) && /\.minicoach-panel\.mc-enter\{/.test(p1));
    T('P1 reduced motion disables all new animation + press scaling', /#page\[data-enter\] \.workout-progress-bar i,\.minicoach-panel\.mc-enter,#swupdate\{animation:none!important\}/.test(p1) && /\.nav button:active\{transform:none!important\}/.test(p1));
    T('focus-visible outline defined', /:focus-visible\{outline:2px solid/.test(p1));
    T('enlarged hit areas for small controls (glasses, diet checks, back, header, water, coach close)', /\.glasses \.gl::after/.test(p1) && /\.diet-check::after/.test(p1) && /\.back::after/.test(p1) && /\{content:'';position:absolute;inset:-7px\}/.test(p1));
    T('no animation on inputs, timer digits, calendar or lists', !/(input|textarea|select|#restTimer|rest-time|data-caldate|shop-item|history-row)[^{]*\{[^}]*animation/.test(p1)); }

  // ---------- Safety ----------
  { const added = html.slice(html.indexOf('<script>')).split('\n').filter(l => headHtml.indexOf(l) < 0);
    T('no removeItem / clear / new setItem in any added line', !added.some(l => /localStorage\.(removeItem|clear|setItem)|\.clear\(\)/.test(l)), added.filter(l => /localStorage\.(removeItem|clear|setItem)/.test(l)).join(' | '));
    const fn = (src, name) => { const i = src.indexOf('function ' + name + '('); if (i < 0) return null; let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } return null; };
    const guarded = ['doSave', 'doSaveNow', 'flushSave', 'save', 'getSetValue', 'getDoneValue', 'getSideSetValue', 'getSideDoneValue', 'setIsDone', 'setKey', 'sideSetKey', 'exerciseId', 'canonicalExerciseId', 'preparePlanExerciseIds', 'ensureUserPlan', 'setupDay5Variants', 'setDay5Variant', 'coachApplyPending', 'buildBackupObject', 'applyBackupImport', 'analyzeBackup', 'mergeDayRecord', 'parseBackupText', 'createSafetySnapshot', 'archiveStoredUserPlan', 'replaceUserPlanSafely', 'migrateLegacyHistory', 'syncRecordExerciseMap', 'load', 'applyServiceWorkerUpdate', 'onServiceWorkerControllerChange', 'showUpdateBanner'];
    const changed = guarded.filter(n => fn(headHtml, n) !== fn(html, n));
    T('data / storage / ID / plan / migration / import-export / SW functions byte-identical to HEAD', changed.length === 0, changed.join());
    T('sw.js: only cache bump + new photo precache; manifest.json unchanged', (() => { const d = REF.diffLines('sw.js'); return REF.unchanged('manifest.json') && d.every(l => /^[-+]const CACHE = "fede-tracker-v6[23]";$/.test(l) || /^\+  "\.\/assets\/exercises\/photos\/[a-z0-9-]+\.jpg",$/.test(l)); })());
    const h = H(REPO); boot(h); h.run('agenda=[];week=[];hist=[];strengthHist=[];calData={};'); const before = J(h.store);
    ['home', 'workout', 'agenda', 'calisthenics', 'mobility', 'nutri', 'evo', 'profile', 'power', 'finishers', 'accessories', 'exercise'].forEach(v => h.run(`view=${J(v)};exIdx=0;renderCore();`));
    T('rendering every view writes nothing', J(h.store) === before); }

  console.log(fail === 0 ? '\nALL FINISH-PASS CHECKS PASSED' : '\nFAILURES: ' + fail); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL harness error: ' + (e && e.stack || e)); process.exit(1); });
