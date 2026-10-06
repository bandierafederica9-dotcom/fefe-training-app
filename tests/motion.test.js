// Motion P0: CSS layer, reduced motion, screen-change flag, touch enabler, checkmark pop.
// Verifies motion is visual only (no data/storage/logic change). Synthetic data only.
const REPO = require('path').resolve(__dirname, '..');
const fs = require('fs');
const H = require('./harness');
let fail = 0; const T = (n, ok, x) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const J = JSON.stringify;
const html = fs.readFileSync(REPO + '/index.html', 'utf8');
const css = html.slice(html.indexOf('<style>') + 7, html.indexOf('</style>'));
const motion = css.slice(css.indexOf('/* ================= MOTION · P0'));

// ---------- 1) CSS layer ----------
T('motion block present at end of <style>', motion.length > 0 && css.trimEnd().endsWith('}'));
T('motion variables defined', ['--ease-out', '--ease-pop', '--d-press', '--d-fast', '--d-base', '--d-slow'].every(v => motion.includes(v + ':')));
{ const anim = [...motion.matchAll(/@keyframes [A-Za-z]+\{([\s\S]*?\})\}/g)].map(m => m[1]);
  const props = new Set(); anim.forEach(b => [...b.matchAll(/([a-z-]+)\s*:/g)].forEach(m => props.add(m[1])));
  T('keyframes animate only transform/opacity', [...props].every(p => p === 'transform' || p === 'opacity'), [...props].join());
  const trans = [...motion.matchAll(/transition:([^;}]+)/g)].map(m => m[1]).join(',');
  const tprops = trans.split(',').map(s => s.trim().split(/\s+/)[0]);
  T('transitions only transform/opacity/colours', tprops.every(p => ['transform', 'opacity', 'background-color', 'border-color', 'color'].includes(p)), tprops.join()); }
{ const kfBodies = [...motion.matchAll(/@keyframes [A-Za-z]+\{((?:[^{}]*\{[^}]*\})*)\}/g)].map(m => m[1]).join(' ');
  T('no width/height/top/margin/box-shadow/filter animated (transitions + keyframe bodies)', !/transition:[^;}]*(width|height|top|left|margin|box-shadow|filter)/.test(motion) && !/(width|height|box-shadow|filter|margin|top|left)\s*:/.test(kfBodies), kfBodies.slice(0, 120)); }
T('entry animation scoped to #page[data-enter] only', /#page\[data-enter\]>\*\{animation:fedeScreenIn/.test(motion) && (motion.match(/fedeScreenIn/g) || []).length === 2);
T('no animation on inputs, textarea, select, timer, calendar or lists', !/(input|textarea|select|#restTimer|rest-time|data-caldate|calendar|shop-item|history-row|filterable-exercise)[^{]*\{[^}]*(animation|transition)/.test(motion));
T('existing press rules kept (task/water/fab/mini-action)', /\.task:active\{transform:scale\(\.985\)\}/.test(css) && /\.water-btn:active\{transform:scale\(\.96\)\}/.test(css));
{ const rm = motion.slice(motion.indexOf('@media (prefers-reduced-motion: reduce)'));
  T('prefers-reduced-motion block present', rm.length > 0);
  T('reduced motion: near-zero durations', /animation-duration:\.01ms!important/.test(rm) && /transition-duration:\.01ms!important/.test(rm));
  T('reduced motion: no entry animation, no pop', /#page\[data-enter\]>\*,\.chk\.chk-pop\{animation:none!important\}/.test(rm));
  T('reduced motion: no press scaling', /\{transform:none!important\}/.test(rm) && rm.includes('.chk:active') && rm.includes('[data-go]:active')); }

// ---------- 2) Screen-change flag ----------
{ const h = H(REPO); h.run('profile=getProfile();cur=new Date("2026-01-20T12:00:00");key="fede:2026-01-20";data=norm({day:"Giorno 1"});');
  const page = () => h.ctx.document.getElementById('page');
  h.run('view="home";render();');
  T('first paint: no entry animation', !page().hasAttribute('data-enter'));
  h.run('view="workout";render();');
  T('screen change sets data-enter (delay 0)', page().hasAttribute('data-enter') && page().style.getPropertyValue('--enter-delay') === '0ms');
  h.run('__motionEnterAt=Date.now()-100;render();render();'); // entry started ~100 ms ago (deterministic)
  { const d = page().style.getPropertyValue('--enter-delay'), n = parseInt(d, 10);
    T('same screen re-render does NOT restart (continues via negative delay)', page().hasAttribute('data-enter') && /^-\d+ms$/.test(d) && n <= -100 && n > -1000, d); }
  h.run('page=document.getElementById("page");page.removeAttribute("data-enter");render();');
  T('same screen after the entry finished: nothing replayed', !page().hasAttribute('data-enter'));
  h.run('view="exercise";exIdx=0;lastExLoading=false;lastEx=null;exerciseTab="video";render();');
  T('opening an exercise animates', page().hasAttribute('data-enter'));
  h.run('document.getElementById("page").removeAttribute("data-enter");exerciseTab="muscles";render();');
  T('exercise tab switch (same screen) does not animate', !page().hasAttribute('data-enter'));
  h.run('exIdx=1;render();');
  T('next exercise animates', page().hasAttribute('data-enter'));
  h.run('view="home";render();document.getElementById("page").removeAttribute("data-enter");data.water=3;render();');
  T('water tap on Home (same screen) does not animate', !page().hasAttribute('data-enter'));
  T('screen keys', h.run('view="exercise";data.day="Giorno 2";exIdx=3;motionScreenKey()') === 'exercise|Giorno 2|3' && h.run('view="workout";motionScreenKey()') === 'workout|Giorno 2' && h.run('view="agenda";motionScreenKey()') === 'agenda');
  T('motion flag wrote nothing to storage', Object.keys(h.store).length === 0); }
{ const h = H(REPO); h.run('profile=getProfile();data=norm({day:"Giorno 1"});view="home";render();');
  let ok = true; try { h.run('view="workout";document.getElementById=function(){return null;};render();'); } catch (e) { ok = false; }
  T('missing #page: render does not throw', ok); }

// ---------- 3) Touch enabler + checkmark pop ----------
{ const h = H(REPO); const L = h.ctx.__listeners.document;
  const ts = L.find(x => x.type === 'touchstart');
  T('touchstart enabler registered, passive, no-op', !!ts && ts.opts && ts.opts.passive === true && /^function\(\)\{\}$/.test(String(ts.fn).replace(/\s/g, '')));
  const click = L.find(x => x.type === 'click');
  T('document click listener registered for the pop', !!click);
  h.run('profile=getProfile();cur=new Date("2026-01-20T12:00:00");key="fede:2026-01-20";data=norm({day:"Giorno 1"});');
  // Simulate a real tap: element's own [data-done] handler first, then the bubbling document listener.
  h.run(`(function(){globalThis.__els={};document.querySelectorAll=function(sel){return (__els[sel]||[]);};
    const cl=new Set(["chk"]);globalThis.__b={dataset:{done:"Giorno 1|giorno-1__pull-up|1"},textContent:"",closest:function(s){return s==="[data-done]"?this:null;},
      get className(){return [...cl].join(" ");},set className(v){cl.clear();String(v).split(/\\s+/).filter(Boolean).forEach(c=>cl.add(c));},
      classList:{add:function(c){cl.add(c);},contains:function(c){return cl.has(c);}}};
    __els["[data-set]"]=[];__els["[data-done]"]=[__b];bind();})()`);
  const before = h.run('JSON.stringify(data.done)');
  h.run('__b.onclick();clearTimeout(saveT);'); click.fn({ target: h.run('__b') });
  T('tick: data written exactly as before (true)', h.run('JSON.stringify(data.done)') === J({ 'Giorno 1|giorno-1__pull-up|1': true }) && before === '{}');
  T('tick: pop class added after the data handler', h.run('__b.classList.contains("chk-pop")') === true && h.run('__b.classList.contains("on")') === true);
  h.run('__b.onclick();clearTimeout(saveT);'); click.fn({ target: h.run('__b') });
  T('untick: data false, no pop, pop class cleared by the existing handler', h.run('data.done["Giorno 1|giorno-1__pull-up|1"]') === false && h.run('__b.classList.contains("chk-pop")') === false);
  T('click outside a set: nothing happens', (() => { try { click.fn({ target: { closest: () => null } }); click.fn({ target: null }); click.fn(null); return true; } catch (e) { return false; } })());
  T('re-rendered ticked sets carry no pop class (no replay)', !/chk-pop/.test(h.run('(function(){view="exercise";exIdx=0;lastExLoading=false;lastEx=null;exerciseTab="video";data.done["Giorno 1|giorno-1__pull-up|1"]=true;return exerciseHTML();})()'))); }

// ---------- 4) No data / logic change vs HEAD ----------
{ const REF = require('./reference'), base = REF.indexHtml; // reviewed release reference (no Git history needed)
  const fn = (src, name) => { const i = src.indexOf('function ' + name + '('); if (i < 0) return null; let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } return null; };
  // Data / storage / IDs / migrations / import-export / Service Worker: byte-identical to HEAD.
  // (bind and exerciseHTML are intentionally extended by the Calisthenics Lab phase -> tests/lab.test.js.)
  const guarded = ['doSave', 'doSaveNow', 'flushSave', 'save', 'getSetValue', 'getDoneValue', 'getSideSetValue', 'getSideDoneValue', 'setIsDone', 'setKey', 'sideSetKey', 'exerciseId', 'canonicalExerciseId', 'preparePlanExerciseIds', 'ensureUserPlan', 'setupDay5Variants', 'setDay5Variant', 'coachApplyPending', 'buildBackupObject', 'applyBackupImport', 'analyzeBackup', 'mergeDayRecord', 'createSafetySnapshot', 'replaceUserPlanSafely', 'migrateLegacyHistory', 'syncRecordExerciseMap', 'load', 'renderCore', 'applyServiceWorkerUpdate', 'onServiceWorkerControllerChange', 'showUpdateBanner'];
  const changed = guarded.filter(n => fn(base, n) !== fn(html, n));
  T('data/storage/ID/migration/import/SW functions byte-identical to HEAD', changed.length === 0, changed.join());
  // The motion code itself never touches storage or data.
  const motionSrc = ['motionScreenKey', 'applyScreenEnter'].map(n => fn(html, n)).join('\n') + html.slice(html.indexOf('// Motion P0 (visual only): iOS'), html.indexOf("window.addEventListener('pagehide'"));
  T('motion code never touches localStorage or workout data', !/localStorage|data\.(sets|done)\b|save\(|doSave/.test(motionSrc));
  T('PLAN and content constants unchanged', ['PLAN', 'MUSCLE_DB', 'EXDB', 'DIET_DAYS', 'APP_EN'].every(n => { const re = new RegExp('const ' + n + '\\s*=\\s*'); const a = base.search(re), b = html.search(re); return a > -1 && base.slice(a, a + 4000) === html.slice(b, b + 4000); }));
  const J = JSON.stringify; T('sw.js: only cache bump + new photo precache; manifest.json unchanged', (() => { const d = REF.diffLines('sw.js'); return REF.unchanged('manifest.json') && d.every(l => /^[-+]const CACHE = "fede-tracker-v6[23]";$/.test(l) || /^\+  "\.\/assets\/exercises\/photos\/[a-z0-9-]+\.jpg",$/.test(l)); })()); }

console.log(fail === 0 ? '\nALL MOTION P0 CHECKS PASSED' : '\nFAILURES: ' + fail); process.exit(fail ? 1 : 0);
