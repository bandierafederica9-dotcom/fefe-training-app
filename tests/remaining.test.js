// Save flush, Service Worker, Agenda crash, small fixes, seed/privacy, import safety. Synthetic data only.
const REPO = require('path').resolve(__dirname, '..');
const fs = require('fs'), vm = require('vm');
const H = require('./harness');
let fail = 0; const T = (n, ok, x) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const J = JSON.stringify;
const keysOf = (store, pre) => Object.keys(store).filter(k => k.indexOf(pre) === 0);
const prof = (o) => J(Object.assign({ name: 'Test', goal: '', days: 5, duration: '', level: '', location: '', equipment: '', avoid: '', notes: '', setupComplete: true, personalised: true }, o || {}));

(async () => {
  // ---------- 1) Pending-save flush ----------
  { const h = H(REPO); h.run('profile=getProfile();cur=new Date("2026-01-20T12:00:00");key="fede:2026-01-20";data=norm({day:"Giorno 1"});');
    h.run('data.note="typed";save();');
    T('debounced: nothing written before flush', h.store['fede:2026-01-20'] === undefined);
    T('flushSave writes immediately and returns true', h.run('flushSave()') === true && JSON.parse(h.store['fede:2026-01-20']).note === 'typed');
    T('flush cancels the timer (no duplicate write)', h.run('saveT===null&&saveDirty===false'));
    const before = h.store['fede:2026-01-20']; h.run('flushSave()');
    T('flush with nothing pending writes nothing', h.store['fede:2026-01-20'] === before);
    T('record stamped with _updatedAt (additive)', !!JSON.parse(h.store['fede:2026-01-20'])._updatedAt); }
  { // date switch within 400ms: value must land on the OLD date
    const h = H(REPO, { 'fede:2026-01-19': J({ day: 'Giorno 2', sets: {}, done: {} }) });
    h.run('cur=new Date("2026-01-20T12:00:00");render=function(){};loadWeek=async function(){};loadAgenda=async function(){};');
    await h.run('load()');
    h.run('data.sets["Giorno 1|giorno-1__pull-up|1"]={kg:"",r:"7"};save();cur=new Date("2026-01-19T12:00:00");');
    await h.run('load()');
    const saved = JSON.parse(h.store['fede:2026-01-20'] || 'null');
    T('value typed just before switching date is saved to the right date', saved && saved.sets['Giorno 1|giorno-1__pull-up|1'].r === '7');
    T('other date untouched by the flush', JSON.parse(h.store['fede:2026-01-19']).day === 'Giorno 2' && !JSON.parse(h.store['fede:2026-01-19']).sets['Giorno 1|giorno-1__pull-up|1']); }
  { // lifecycle listeners registered
    const html = fs.readFileSync(REPO + '/index.html', 'utf8');
    T('pagehide / visibilitychange(hidden) / beforeunload call flushSave', /addEventListener\('pagehide',function\(\)\{flushSave\(\);\}\)/.test(html) && /visibilitychange',function\(\)\{if\(document\.visibilityState==='hidden'\)flushSave\(\);\}/.test(html) && /addEventListener\('beforeunload',function\(\)\{flushSave\(\);\}\)/.test(html)); }

  // ---------- 2) Service Worker update safety (page side) ----------
  { const h = H(REPO); h.run('profile=getProfile();key="fede:2026-01-20";data=norm({day:"Giorno 1"});data.note="x";save();');
    h.run('globalThis.__log=[];globalThis.__w={postMessage:function(m){__log.push(["post",m.type,localStorage.getItem("fede:2026-01-20")!==null]);}};window.location={reload:function(){__log.push(["reload"]);}};');
    T('controllerchange without a user request: no reload', h.run('onServiceWorkerControllerChange()') === false && h.run('__log.length') === 0);
    T('apply update: pending data saved BEFORE SKIP_WAITING', h.run('applyServiceWorkerUpdate(__w)') === true && h.run('JSON.stringify(__log)') === J([['post', 'SKIP_WAITING', true]]));
    T('controllerchange after request: exactly one reload', h.run('onServiceWorkerControllerChange()') === true && h.run('onServiceWorkerControllerChange()') === false && h.run('__log.filter(x=>x[0]==="reload").length') === 1);
    const h2 = H(REPO); h2.run('profile=getProfile();key="fede:2026-01-20";data=norm({day:"Giorno 1"});save();');
    h2.run('(function(){const o=localStorage.setItem;localStorage.setItem=function(k,v){if(k==="fede:2026-01-20")throw new Error("quota");return o(k,v);};})();globalThis.__posted=0;globalThis.__w={postMessage:function(){__posted++;}};');
    T('apply update postponed if saving fails (no SKIP_WAITING)', h2.run('applyServiceWorkerUpdate(__w)') === false && h2.run('__posted') === 0); }

  // ---------- 3) Service Worker script ----------
  { const src = fs.readFileSync(REPO + '/sw.js', 'utf8'); const L = {}; let skipped = 0, claimed = 0;
    const ctx = vm.createContext({ self: { addEventListener: (t, f) => { L[t] = f; }, skipWaiting: () => { skipped++; return Promise.resolve(); }, clients: { claim: () => { claimed++; return Promise.resolve(); } } },
      caches: { open: () => Promise.resolve({ addAll: () => Promise.resolve(), put: () => Promise.resolve() }), keys: () => Promise.resolve(['fede-tracker-v61', 'fede-tracker-v62']), delete: () => Promise.resolve(true), match: () => Promise.resolve(undefined) },
      fetch: () => Promise.reject(new Error('offline')), Response: function (b, o) { this.status = o.status; }, Promise, console });
    vm.runInContext(src, ctx);
    T('sw.js parses (syntax error from main fixed)', true);
    T('CACHE bumped to v63 (media review assets)', /const CACHE = "fede-tracker-v63";/.test(src));
    T('precache: no seed file, icons included, all files exist', !/backup-seed/.test(src) && /"\.\/icon-192\.png"/.test(src) && /"\.\/icon-512\.png"/.test(src) && src.match(/"\.\/[^"]+"/g).every(f => fs.existsSync(REPO + '/' + f.slice(3, -1))));
    let waits = []; L.install({ waitUntil: p => waits.push(p) }); await Promise.all(waits);
    T('install does NOT call skipWaiting', skipped === 0);
    L.message({ data: { type: 'OTHER' } }); T('unrelated message ignored', skipped === 0);
    L.message({ data: { type: 'SKIP_WAITING' } }); T('SKIP_WAITING message activates', skipped === 1);
    waits = []; L.activate({ waitUntil: p => waits.push(p) }); await Promise.all(waits);
    T('activate still claims clients', claimed === 1);
    let resp; L.fetch({ request: { method: 'GET', mode: 'cors', url: 'x.png', headers: { get: () => 'image/png' } }, respondWith: p => { resp = p; } });
    T('offline asset miss -> 503 response (no crash)', (await resp).status === 503);
    let resp2; L.fetch({ request: { method: 'GET', mode: 'navigate', url: '/', headers: { get: () => 'text/html' } }, respondWith: p => { resp2 = p; } });
    T('offline navigation falls back to cache (no crash)', (await resp2) === undefined);
    let called = false; L.fetch({ request: { method: 'POST' }, respondWith: () => { called = true; } }); T('non-GET not intercepted', !called); }

  // ---------- 4) Agenda / Piano crash + small fixes ----------
  { const personal = { 'Giorno 1': { t: 'P1', em: 'A', ex: [['Pull-up', 'x', 3, null, 'giorno-1__pull-up']] }, 'Giorno 2': { t: 'P2', em: 'B', ex: [] }, 'Riposo': { t: 'R', em: 'Z', ex: [] } };
    const h = H(REPO, { 'fede:profile': prof(), 'fede:userPlan': J(personal), 'fede:planVersion': '9' });
    h.run('profile=getProfile();ensureUserPlan();cur=new Date("2026-01-20T12:00:00");key="fede:2026-01-20";data=norm({day:"Casa"});agenda=[{d:new Date("2026-01-19T12:00:00"),x:norm({day:"Nuoto",done:{}})},{d:new Date("2026-01-20T12:00:00"),x:null}];agView="sett";');
    let ok = true, err = ''; try { h.run('agendaHTML()'); } catch (e) { ok = false; err = e.message; }
    T('Agenda renders for personal plan lacking Core/Nuoto/Casa (main crashed)', ok, err);
    const html = h.run('agendaHTML()');
    T('Agenda lists Core, Nuoto and Casa options', ['Core', 'Nuoto', 'Casa'].every(d => html.indexOf('value="' + d + '"') > -1));
    let ok2 = true; try { h.run('topHTML()+homeHTML()+workoutHTML()+warmupHTML()'); } catch (e) { ok2 = false; err = e.message; }
    T('Home/Workout/Warm-up render on a day missing from the personal plan', ok2, err);
    T('dayPlan falls back to PLAN, then empty day', h.run('dayPlan("Casa").ex.length') === 5 && h.run('dayPlan("Nope").ex.length') === 0 && h.run('dayPlan("Giorno 1").t') === 'P1');
    let ok3 = true; try { h.run('videoHTML()'); } catch (e) { ok3 = false; err = e.message; }
    T('video library no longer crashes (WARM.glutei)', ok3, err); }
  { const h = H(REPO, { 'fede:2026-01-01': '{}' }); T('existingUserDetected true with only date records (regex fixed)', h.run('existingUserDetected()') === true);
    const h0 = H(REPO); T('existingUserDetected false on empty storage', h0.run('existingUserDetected()') === false); }
  { const rec = (r) => J({ day: 'Giorno 1', sets: { 'Giorno 1|giorno-1__pull-up|1': { kg: '', r } }, done: {} });
    const h = H(REPO, { 'fede:2026-01-02': rec('3'), 'fede:2026-01-09': rec('5'), 'fede:2026-01-16': rec('6') });
    h.run('profile=getProfile();cur=new Date("2026-01-20T12:00:00");data=norm({day:"Giorno 1"});');
    const r = await h.run('miniLastSession("Pull-up","Giorno 1")');
    T('Coach last session returns the NEWEST session', r && r.summary.rows[0].r === '6', r && r.summary.rows[0].r); }
  { const h = H(REPO); h.run('profile=getProfile();key="k";data=norm({day:"Giorno 5"});h5=null;');
    h.run('setupDay5Variants(PLAN,"B");exIdx=1;exerciseTab="muscles";lastExLoading=false;lastEx=null;');
    const html = h.run('exerciseHTML()');
    T('no <img src="null"> for Hang Power Clean', !/src="null"/.test(html));
    h.run('exIdx=3;'); T('Pin Squat shows its real image', /assets\/muscles\/belt-squat-sumo\.png/.test(h.run('exerciseHTML()'))); }
  { const html = fs.readFileSync(REPO + '/index.html', 'utf8');
    const dups = {}; (html.match(/^\s*(?:async )?function [A-Za-z0-9_]+/gm) || []).forEach(m => { const n = m.trim().split(' ').pop(); dups[n] = (dups[n] || 0) + 1; });
    T('no duplicate top-level function declarations', Object.keys(dups).filter(n => dups[n] > 1).length === 0, Object.keys(dups).filter(n => dups[n] > 1).join()); }

  // ---------- 4b) migrateLegacyHistory only annotates true pre-ID records ----------
  { const legacyRec = J({ day: 'Giorno 2', sets: { 'Giorno 2|0|1': { kg: '20', r: '10' } }, done: { 'Giorno 2|0|1': true } });
    const modernRec = J({ day: 'Giorno 2', sets: { 'Giorno 2|giorno-2__machine-hip-thrust|1': { kg: '30', r: '8' }, 'Giorno 2|0|2': { kg: '30', r: '8' } }, done: {} });
    const h = H(REPO, { 'fede:2025-05-01': legacyRec, 'fede:2026-01-12': modernRec });
    h.run('migrateLegacyHistory()');
    T('positional-only legacy record still annotated (as on main)', JSON.parse(h.store['fede:2025-05-01']).dayEx[0] === 'Machine Shoulder Press');
    T('record with permanent-ID keys NOT annotated with an old list', h.store['fede:2026-01-12'] === modernRec);
    T('one-time marker set', h.store['fede:historyNameMigrationV4'] === '1'); }

  // ---------- 5) Seed / privacy ----------
  { const html = fs.readFileSync(REPO + '/index.html', 'utf8');
    T('no seed loader / fetch of a bundled backup', !/restoreBundledBackupIfEmpty\(/.test(html) && !/fetch\('\.\/assets\/fede-training-backup-seed/.test(html));
    T('seed file not in the repository tree', !fs.existsSync(REPO + '/assets/fede-training-backup-seed.json'));
    const h = H(REPO); h.run('cur=new Date("2026-07-22T12:00:00");render=function(){};loadWeek=async function(){};loadAgenda=async function(){};');
    await h.run('load()');
    T('fresh install: hard-coded SEEDS NOT shown, nothing personal stored', h.run('Object.keys(data.sets).length') === 0 && Object.keys(h.store).filter(k => /^fede:\d{4}/.test(k)).length === 0 && !h.store['fede:userPlan'] && !h.store['fede:goals']);
    const h2 = H(REPO, { 'fede:2026-07-22': J({ day: 'Giorno 3', sets: {}, done: {}, note: 'mia nota' }), 'fede:2026-01-01': '{}' });
    h2.run('cur=new Date("2026-07-22T12:00:00");render=function(){};loadWeek=async function(){};loadAgenda=async function(){};'); await h2.run('load()');
    T('existing user: SEEDS never overwrite an existing note', h2.run('data.note') === 'mia nota'); }

  // ---------- 6) Import safety ----------
  const local = {
    'fede:profile': prof(), 'fede:goals': J({ kcal: 1700, sched: { 1: 'Giorno 1' } }), 'fede:lang': 'it', 'fede:planVersion': '9',
    'fede:userPlan': J({ 'Giorno 1': { ex: [['Pull-up', 'x', 3, null, 'giorno-1__pull-up'], ['Hammer Curl', 'x', 3, null, 'giorno-1__hammer-curl']] } }),
    'fede:2026-01-10': J({ day: 'Giorno 1', sets: { 'Giorno 1|giorno-1__pull-up|1': { kg: '', r: '6' } }, done: {}, note: 'locale', weight: '', _updatedAt: '2026-01-10T10:00:00Z' }),
    'fede:2026-01-11': J({ day: 'Giorno 2', sets: { 'Giorno 2|giorno-2__machine-hip-thrust|1': { kg: '40', r: '8' } }, done: {}, note: '' }),
    'fede:2026-01-12': J({ day: 'Giorno 3', sets: { 'Giorno 3|giorno-3__frog-stand|1': { kg: '', r: '15' } }, done: {}, _updatedAt: '2026-01-12T09:00:00Z' }),
    'fede:exnote:giorno-1__pull-up': 'nota locale' };
  const backup = { version: 5, format: 'fede-training-complete', exportedAt: '2026-01-15T00:00:00Z', localStorage: {
    'fede:profile': prof({ name: 'Other' }), 'fede:lang': 'en', 'fede:planVersion': '7', 'fede:autobackup:x': '{}',
    'fede:userPlan': J({ 'Day 1': { ex: [['Pull-up', 'x', 4, 'skill', 'giorno-1__pull-up__x']] } }),
    'fede:2026-01-10': local['fede:2026-01-10'],                                                                 // identical
    'fede:2026-01-11': J({ day: 'Giorno 2', sets: { 'Giorno 2|giorno-2__machine-hip-thrust|1': { kg: '35', r: '8' }, 'Giorno 2|giorno-2__barbell-db-rdl|1': { kg: '20', r: '8' } }, done: {}, note: 'dal backup', weight: '55' }), // conflict + fill
    'fede:2026-01-12': J({ day: 'Giorno 3', sets: { 'Giorno 3|giorno-3__frog-stand|1': { kg: '', r: '20' } }, done: {}, _updatedAt: '2026-01-12T20:00:00Z' }), // newer backup wins
    'fede:2026-01-13': J({ day: 'Day 1', sets: { 'Day 1|giorno-1__pull-up__old|1': { kg: '', r: '4' } }, done: {} }),        // new (legacy EN)
    'fede:2026-01-14': '{bad json', 'fede:exnote:giorno-1__pull-up': 'nota backup', 'fede:extras:2026-01-13': J({ items: { 'Ab Wheel': { kind: 'finisher' } } }), 'notfede': 'x' } };
  { const h = H(REPO, local); h.run('profile=getProfile();');
    T('invalid JSON rejected', h.run('parseBackupText("{nope").ok') === false);
    T('wrong format rejected', h.run('parseBackupText(JSON.stringify({format:"other",localStorage:{}})).ok') === false);
    T('empty object rejected', h.run('parseBackupText("{}").ok') === false);
    const before = J(h.store);
    const res = JSON.parse(h.run(`JSON.stringify((function(){const p=parseBackupText(${J(J(backup))});const r=analyzeBackup(p.backup);delete r.items;return r;})())`));
    T('analysis is read-only', J(h.store) === before);
    T('analysis: new = 01-13 + extras', J(res.add.sort()) === J(['fede:2026-01-13', 'fede:extras:2026-01-13']), J(res.add));
    T('analysis: identical day ignored', res.identical.includes('fede:2026-01-10'));
    T('analysis: conflicts detected (day, profile, plan, note)', ['fede:2026-01-11', 'fede:2026-01-12', 'fede:profile', 'fede:userPlan', 'fede:exnote:giorno-1__pull-up'].every(k => res.conflict.includes(k)), J(res.conflict));
    T('analysis: device-local keys + autobackup + non-fede skipped, bad JSON invalid', ['fede:lang', 'fede:planVersion', 'fede:autobackup:x', 'notfede'].every(k => res.skip.includes(k)) && res.invalid.includes('fede:2026-01-14'));
    T('analysis: plan reported as DIFFERENT', res.planStatus === 'different');
    const out = JSON.parse(h.run(`JSON.stringify(applyBackupImport(analyzeBackup(parseBackupText(${J(J(backup))}).backup),{}))`));
    T('import ok + verified', out.ok === true, J(out));
    T('snapshot taken first, contains pre-import state', !!out.snapshotKey && JSON.parse(h.store[out.snapshotKey]).localStorage['fede:2026-01-11'] === local['fede:2026-01-11']);
    const d11 = JSON.parse(h.store['fede:2026-01-11']);
    T('conflict w/o timestamps: device value kept (40 kg)', d11.sets['Giorno 2|giorno-2__machine-hip-thrust|1'].kg === '40');
    T('missing set + empty fields filled from backup', d11.sets['Giorno 2|giorno-2__barbell-db-rdl|1'].kg === '20' && d11.note === 'dal backup' && d11.weight === '55');
    T('newer backup value wins (both timestamped)', JSON.parse(h.store['fede:2026-01-12']).sets['Giorno 3|giorno-3__frog-stand|1'].r === '20');
    const stash = JSON.parse(h.store[out.stashKey]);
    T('losing values stashed (nothing dropped)', JSON.parse(stash.keptLocal_incomingValue['fede:2026-01-11']).sets['Giorno 2|giorno-2__machine-hip-thrust|1'].kg === '35' && JSON.parse(stash.replacedLocal_previousValue['fede:2026-01-12']).sets['Giorno 3|giorno-3__frog-stand|1'].r === '15');
    T('current plan NOT replaced; backup plan stashed', h.store['fede:userPlan'] === local['fede:userPlan'] && !!stash.keptLocal_incomingValue['fede:userPlan']);
    T('profile, goals, lang, planVersion unchanged', h.store['fede:profile'] === local['fede:profile'] && h.store['fede:goals'] === local['fede:goals'] && h.store['fede:lang'] === 'it' && h.store['fede:planVersion'] === '9');
    T('identical day byte-identical; new legacy day added raw', h.store['fede:2026-01-10'] === local['fede:2026-01-10'] && h.store['fede:2026-01-13'] === backup.localStorage['fede:2026-01-13']);
    T('local exercise note kept', h.store['fede:exnote:giorno-1__pull-up'] === 'nota locale');
    T('no key deleted by import', Object.keys(local).every(k => k in h.store));
    T('bad record and autobackup from file not imported', !('fede:2026-01-14' in h.store) && !('fede:autobackup:x' in h.store));
    const s2 = J(Object.fromEntries(Object.entries(h.store).filter(([k]) => !/^fede:(autobackup|importconflict):/.test(k))));
    const out2 = JSON.parse(h.run(`JSON.stringify(applyBackupImport(analyzeBackup(parseBackupText(${J(J(backup))}).backup),{}))`));
    T('re-importing the same backup changes no data (idempotent)', out2.ok && J(Object.fromEntries(Object.entries(h.store).filter(([k]) => !/^fede:(autobackup|importconflict):/.test(k)))) === s2); }
  { // explicit plan replacement: archived first
    const h = H(REPO, local); h.run('profile=getProfile();');
    const out = JSON.parse(h.run(`JSON.stringify(applyBackupImport(analyzeBackup(parseBackupText(${J(J(backup))}).backup),{replacePlan:true}))`));
    const arch = keysOf(h.store, 'fede:archivedUserPlan:').filter(k => !/:reason$/.test(k));
    T('replacePlan: previous plan archived byte-exact, backup plan active', out.ok && arch.some(k => h.store[k] === local['fede:userPlan']) && h.store['fede:userPlan'] !== local['fede:userPlan']); }
  { // snapshot failure aborts everything
    const h = H(REPO, local); h.run('profile=getProfile();(function(){const o=localStorage.setItem;localStorage.setItem=function(k,v){if(String(k).indexOf("fede:autobackup:")===0)throw new Error("quota");return o(k,v);};})();');
    const before = J(h.store);
    const out = JSON.parse(h.run(`JSON.stringify(applyBackupImport(analyzeBackup(parseBackupText(${J(J(backup))}).backup),{}))`));
    T('snapshot failure: import aborted, storage untouched', out.ok === false && J(h.store) === before); }
  { // export -> import round-trip on another empty device
    const h = H(REPO, local); h.run('profile=getProfile();userPlan=null;goals={};');
    const exported = h.run('JSON.stringify(buildBackupObject())');
    const h2 = H(REPO); h2.run('profile=getProfile();');
    const out = JSON.parse(h2.run(`JSON.stringify(applyBackupImport(analyzeBackup(parseBackupText(${J(exported)}).backup),{}))`));
    const deviceKeys = new Set(['fede:lang', 'fede:planVersion']);
    T('round-trip: every user key restored byte-exact on an empty device', out.ok && Object.keys(local).filter(k => !deviceKeys.has(k)).every(k => h2.store[k] === local[k])); }

  console.log(fail === 0 ? '\nALL REMAINING-AREA CHECKS PASSED' : '\nFAILURES: ' + fail); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL harness error: ' + (e && e.stack || e)); process.exit(1); });
