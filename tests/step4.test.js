// Step 4 functional tests (exercise screen display + set/done handlers). Synthetic data only.
const fs = require('fs');
const REPO = require('path').resolve(__dirname, '..');
const H = require('./harness');
let fail = 0;
const T = (n, ok, x) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };

// In-memory "pre-Step-4" copy: current file with only the 3 Step-4 edits undone (for regression).
const cur = fs.readFileSync(REPO + '/index.html', 'utf8');
let rev = cur;
const swaps = [
  // exerciseHTML now reads the exercise context as `day` (=== data.day in the main workout)
  ["v=getSetValue(data,day,exIdx,e,sn)||{kg:'',r:''},on=Object.prototype.hasOwnProperty.call(data.done,id)?!!data.done[id]:getDoneValue(data,day,exIdx,e,sn);",
   "v=data.sets[id]||{kg:'',r:''},on=!!data.done[id];"],
  ['    const id=inp.dataset.set;\n    if(!data.sets[id]){\n      // First edit of a set shown from a legacy key: start the canonical entry from a COPY of the\n      // displayed value so the other field is not lost. The legacy key itself is never modified.\n      const seed=displayedLegacySet(id);\n      data.sets[id]=seed?Object.assign({kg:"",r:""},seed):{kg:"",r:""};\n    }\n',
   '    const id=inp.dataset.set;data.sets[id]=data.sets[id]||{kg:"",r:""};\n'],
  ['    // Toggle what the user SEES (the button state), so a set shown as done via a legacy key can be unticked.\n    const shown=/(^|\\s)on(\\s|$)/.test(b.className);\n    data.done[id]=!shown;',
   '    data.done[id]=!data.done[id];'],
];
swaps.forEach((s, i) => { if (rev.indexOf(s[0]) < 0) { console.log('FAIL cannot build pre-Step-4 copy: swap ' + i + ' not found'); process.exit(1); } rev = rev.replace(s[0], s[1]); });

const J = JSON.stringify;
const setupDom = h => h.run('globalThis.__els={}; document.querySelectorAll=function(sel){return (__els[sel]||[]);};');
const render = (h, day, idx, rec) => h.run(`(function(){cur=new Date("2026-01-20T12:00:00");key="fede:2026-01-20";data=norm(${J(rec)});data.day=${J(day)};exIdx=${idx};lastExLoading=false;lastEx=null;exerciseTab="video";return exerciseHTML();})()`);
function rows(html) {
  const vals = {}, done = {}; let m;
  const re = /<input data-set="([^"]+)" data-f="(r|kg)"[^>]*value="([^"]*)"/g;
  while ((m = re.exec(html))) (vals[m[1]] = vals[m[1]] || {})[m[2]] = m[3];
  const rb = /<button class="chk ?(on)?" data-done="([^"]+)">/g;
  while ((m = rb.exec(html))) done[m[2]] = !!m[1];
  return { vals, done };
}

// 1) Display of legacy-only records (bilateral exercises)
[['Giorno 1', 0, 'giorno-1__pull-up__4-x-4-6-rir-1-2-180-sec', 'Pull-up'],
 ['Giorno 2', 0, 'giorno-2__machine-hip-thrust__3-x-6-8-rir-1-hold-2-sec', 'Hip Thrust'],
 ['Giorno 2', 1, 'giorno-2__barbell-db-rdl__3-x-6-8-rir-1-2', 'RDL']].forEach(c => {
  const h = H(REPO); const lk = c[0] + '|' + c[2] + '|1';
  const r = rows(render(h, c[0], c[1], { day: c[0], sets: { [lk]: { kg: '30', r: '8' } }, done: { [lk]: true } }));
  const id = h.run(`setKey(${J(c[0])},${c[1]},PLAN[${J(c[0])}].ex[${c[1]}],1)`);
  T('display legacy kg/reps/tick: ' + c[3], r.vals[id] && r.vals[id].kg === '30' && r.vals[id].r === '8' && r.done[id] === true, J(r.vals[id]) + ' done=' + r.done[id]);
  T('render wrote nothing to storage: ' + c[3], Object.keys(h.store).length === 0);
});
{ const h = H(REPO); h.run('setupDay5Variants(PLAN,"B")');
  const lk = 'Giorno 5|giorno-5__pin-squat__4-x-4-6-rir-1-2-150-sec|2';
  const r = rows(render(h, 'Giorno 5', 3, { day: 'Giorno 5', sets: { [lk]: { kg: '50', r: '5' } }, done: { [lk]: true } }));
  const id = 'Giorno 5|giorno-5__pin-squat|2';
  T('display legacy Day 5 B Pin Squat', r.vals[id] && r.vals[id].kg === '50' && r.done[id] === true, J(r.vals[id])); }

// Unilateral exercises: side rows unchanged by Step 4 (handled in a later step)
[['Giorno 2', 3, 'Bulgarian D2'], ['Giorno 5', 0, 'Bulgarian D5'], ['Giorno 1', 3, 'Lateral Raise'], ['Giorno 1', 5, 'Bayesian']].forEach(c => {
  const recs = [{ day: c[0], sets: {}, done: {} },
                { day: c[0], sets: { [c[0] + '|x__y__old|1|right']: { kg: '9', r: '9' } }, done: {} }];
  recs.forEach((rec, k) => T('unilateral rows HTML identical to pre-Step-4: ' + c[2] + ' #' + k, render(H(REPO), c[0], c[1], rec) === render(H(REPO, {}, rev), c[0], c[1], rec)));
});

// 2) Partial edit keeps the other field; legacy object untouched
{ const h = H(REPO); setupDom(h);
  const lk = 'Giorno 2|giorno-2__machine-hip-thrust__3-x-6-8-rir-1-hold-2-sec|1', id = 'Giorno 2|giorno-2__machine-hip-thrust|1';
  render(h, 'Giorno 2', 0, { day: 'Giorno 2', sets: { [lk]: { kg: '30', r: '8' } }, done: {} });
  const before = h.run(`JSON.stringify(data.sets[${J(lk)}])`);
  h.run(`(function(){const inp={dataset:{set:${J(id)},f:"r"},value:"9"};__els["[data-set]"]=[inp];__els["[data-done]"]=[];bind();inp.oninput();clearTimeout(saveT);})()`);
  const canon = JSON.parse(h.run(`JSON.stringify(data.sets[${J(id)}])`));
  T('partial edit (reps only) keeps legacy kg', canon.kg === '30' && canon.r === '9', J(canon));
  T('legacy key/object byte-identical after edit', h.run(`JSON.stringify(data.sets[${J(lk)}])`) === before);
  T('canonical entry is a copy, not the legacy object', h.run(`data.sets[${J(id)}]!==data.sets[${J(lk)}]`) === true);
  T('history reads the new value (canonical wins)', JSON.parse(h.run('JSON.stringify(getSetValue(data,"Giorno 2",0,PLAN["Giorno 2"].ex[0],1))')).r === '9');
  T('only canonical key added', h.run('Object.keys(data.sets).sort().join("|")') === [id, lk].sort().join('|'));
  h.run('(function(){const inp={dataset:{set:"Giorno 2|giorno-2__machine-hip-thrust|2",f:"kg"},value:"32"};__els["[data-set]"]=[inp];bind();inp.oninput();clearTimeout(saveT);})()');
  T('edit on set with no legacy data starts empty (as before)', h.run('JSON.stringify(data.sets["Giorno 2|giorno-2__machine-hip-thrust|2"])') === J({ kg: '32', r: '' })); }

// 3) Tap on a ticked legacy set -> canonical false, unticked everywhere
{ const h = H(REPO); setupDom(h);
  const lk = 'Giorno 1|giorno-1__pull-up__4-x-4-6-rir-1-2-180-sec|1', id = 'Giorno 1|giorno-1__pull-up|1';
  const shownOn = rows(render(h, 'Giorno 1', 0, { day: 'Giorno 1', sets: {}, done: { [lk]: true } })).done[id];
  T('legacy tick shown as ticked before tap', shownOn === true);
  h.run(`(function(){globalThis.__b={dataset:{done:${J(id)}},className:"chk on",textContent:"✓"};__els["[data-set]"]=[];__els["[data-done]"]=[__b];bind();__b.onclick();clearTimeout(saveT);})()`);
  T('tap writes canonical false', h.run(`data.done[${J(id)}]`) === false);
  T('button unticked after tap', h.run('__b.className') === 'chk' && h.run('__b.textContent') === '');
  T('progress reads unticked after tap', h.run('exDone(data,"Giorno 1",0).n') === 0);
  T('re-render shows unticked', rows(h.run('exerciseHTML()')).done[id] === false);
  T('legacy done key untouched', h.run(`data.done[${J(lk)}]`) === true);
  h.run('__b.onclick();clearTimeout(saveT);');
  T('second tap re-ticks', h.run(`data.done[${J(id)}]`) === true && h.run('exDone(data,"Giorno 1",0).n') === 1); }

// 4) Tap on an unticked set with no keys -> true (as before)
{ const h = H(REPO); setupDom(h); const id = 'Giorno 2|giorno-2__barbell-db-rdl|1';
  render(h, 'Giorno 2', 1, { day: 'Giorno 2', sets: {}, done: {} });
  h.run(`(function(){globalThis.__b={dataset:{done:${J(id)}},className:"chk ",textContent:""};__els["[data-set]"]=[];__els["[data-done]"]=[__b];bind();__b.onclick();clearTimeout(saveT);})()`);
  T('tap on empty set writes true', h.run(`data.done[${J(id)}]`) === true && h.run('__b.className') === 'chk on'); }

// 5) Regression: canonical-only records render identically to the pre-Step-4 copy
{ let mism = 0, n = 0;
  ['Giorno 1', 'Giorno 2', 'Giorno 3', 'Giorno 4', 'Giorno 5', 'Core', 'Casa', 'Nuoto'].forEach((day, di) => {
    const hN = H(REPO), hR = H(REPO, {}, rev);
    JSON.parse(hN.run(`JSON.stringify(PLAN[${J(day)}].ex)`)).forEach((e, i) => {
      for (let v = 0; v < 3; v++) {
        const rec = { day, sets: {}, done: {} };
        for (let s = 1; s <= 5; s++) { const k = day + '|' + e[4] + '|' + s, r = (i + s + v + di) % 3;
          if (r === 0) { rec.sets[k] = { kg: String(10 + s), r: String(5 + v) }; rec.done[k] = true; }
          else if (r === 1) { rec.sets[k] = { kg: '', r: String(s) }; rec.done[k] = false; } }
        n++; if (render(hN, day, i, rec) !== render(hR, day, i, rec)) mism++;
      }
    });
  });
  T('exercise screen HTML identical to pre-Step-4 for canonical-only records (' + n + ' renders)', mism === 0, mism + ' mismatches'); }

// Handlers identical to pre-Step-4 when the canonical key already exists
{ let mism = 0; const id = 'Giorno 1|giorno-1__pull-up|1';
  [['chk on', true], ['chk ', false]].forEach(c => {
    const out = [H(REPO), H(REPO, {}, rev)].map(h => { setupDom(h);
      render(h, 'Giorno 1', 0, { day: 'Giorno 1', sets: { [id]: { kg: '10', r: '5' } }, done: { [id]: c[1] } });
      h.run(`(function(){globalThis.__b={dataset:{done:${J(id)}},className:${J(c[0])},textContent:""};__els["[data-set]"]=[{dataset:{set:${J(id)},f:"kg"},value:"12"}];__els["[data-done]"]=[__b];bind();__els["[data-set]"][0].oninput();__b.onclick();clearTimeout(saveT);})()`);
      return h.run('JSON.stringify([data.sets,data.done,__b.className])'); });
    if (out[0] !== out[1]) mism++; });
  T('handlers identical to pre-Step-4 when canonical key exists', mism === 0); }

console.log(fail === 0 ? '\nALL STEP-4 CHECKS PASSED' : '\nFAILURES: ' + fail);
process.exit(fail ? 1 : 0);
