// Safety net: a FULL round trip from a populated device.
// fixture.test.js imports a stored fixture into an empty device; this one exports what the
// app itself produces, wipes the device, imports it back and compares byte for byte.
// Synthetic data only; everything stays in the in-memory store.
const REPO = require('path').resolve(__dirname, '..');
const H = require('./harness');
let fail = 0; const T = (n, ok, x) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const J = JSON.stringify;

const SEED = {
  'fede:profile': J({ name: 'Test User', goal: 'glutei', level: 'intermedio', days: 5, setupComplete: true }),
  'fede:hist:2026-11-10': J({ day: 'Giorno 2', ex: [['Machine Hip Thrust', 4, 8, 60], ['Seated Leg Curl', 3, 12, 30]] }),
  'fede:hist:2026-11-12': J({ day: 'Giorno 1', ex: [['Lat Pulldown', 3, 10, 35]] }),
  'fede:goals': J({ weight: 60, note: 'synthetic' }),
  'fede:water:2026-11-16': '7',
  'fede:weight:2026-11-16': '61.4',
};

const h = H(REPO, SEED);
h.run('profile=getProfile();');

// 1. export
const backupText = h.run('JSON.stringify(buildBackupObject())');
const backup = JSON.parse(backupText);
T('export declares its format and version', backup.format === 'fede-training-complete' && typeof backup.version === 'number', backup.format + ' v' + backup.version);
T('export carries every seeded fede:* key', Object.keys(SEED).every((k) => backup.localStorage[k] === SEED[k]),
  Object.keys(SEED).filter((k) => backup.localStorage[k] !== SEED[k]).join(','));

// which keys the app deliberately never restores (device-local state)
const skipped = JSON.parse(h.run('JSON.stringify(Array.from(IMPORT_SKIP_KEYS))'));
const restorable = Object.keys(SEED).filter((k) => !skipped.includes(k));

// 2. wipe the device, keeping the exported text
Object.keys(h.store).forEach((k) => { delete h.store[k]; });
T('device is empty before the import', Object.keys(h.store).length === 0);

// 3. the export is valid input for the importer
const res = JSON.parse(h.run(`JSON.stringify((function(){const r=analyzeBackup(parseBackupText(${J(backupText)}).backup);delete r.items;return r;})())`));
T('its own export analyses without an invalid entry', res.invalid.length === 0 && res.add.length > 0, 'add=' + res.add.length + ' invalid=' + res.invalid.length);

// 4. import
const out = JSON.parse(h.run(`JSON.stringify(applyBackupImport(analyzeBackup(parseBackupText(${J(backupText)}).backup),{}))`));
T('import reports success', out.ok === true, J(out).slice(0, 120));

// 5. compare
const lost = restorable.filter((k) => h.store[k] === undefined);
const changed = restorable.filter((k) => h.store[k] !== undefined && h.store[k] !== SEED[k]);
T('no restorable key is lost', lost.length === 0, lost.join(','));
T('every restored key is byte-exact', changed.length === 0, changed.join(','));
T('a safety snapshot was taken before writing, and stored', !!out.snapshotKey && h.store[out.snapshotKey] !== undefined, out.snapshotKey || 'none');

// 6. importing the same backup twice must not duplicate or corrupt anything
const second = JSON.parse(h.run(`JSON.stringify((function(){const r=analyzeBackup(parseBackupText(${J(backupText)}).backup);return {add:r.add.length,identical:r.identical.length,conflict:r.conflict.length};})())`));
T('re-importing the same backup finds it identical, not new', second.add === 0 && second.conflict === 0, J(second));


/* ---- the Lab ladder: a rung per skill, saved, never inferred ---- */
{
  const g = H(REPO, {});
  g.run('profile=getProfile();');
  const skills = JSON.parse(g.run('JSON.stringify(LAB_SKILLS)'));
  T('every skill has a ladder with at least two rungs', skills.length > 0 && skills.every((s) => JSON.parse(g.run(`JSON.stringify(LAB_LADDER[${J(s)}].length)`)) >= 2), skills.join(','));
  T('a fresh device starts every skill on the first rung', skills.every((s) => JSON.parse(g.run(`labStep(${J(s)})`)) === 0));
  const first = skills[0];
  g.run(`labSetStep(${J(first)},1)`);
  T('the chosen rung is stored and read back', JSON.parse(g.run(`labStep(${J(first)})`)) === 1);
  T('it is stored under its own fede:lab:* key', Object.keys(g.store).some((k) => k.indexOf('fede:lab:step:') === 0), Object.keys(g.store).join(','));
  const n = JSON.parse(g.run(`LAB_LADDER[${J(first)}].length`));
  g.run(`labSetStep(${J(first)},999)`);
  T('it can never go past the top of the ladder', JSON.parse(g.run(`labStep(${J(first)})`)) === n - 1);
  g.run(`labSetStep(${J(first)},-5)`);
  T('nor below the first rung', JSON.parse(g.run(`labStep(${J(first)})`)) === 0);
  const session = JSON.parse(g.run('JSON.stringify(labSessionToday())'));
  T("today's session is one exercise per skill", session.length === skills.length, String(session.length));
  T('every item knows where it stands and what comes next', session.every((c) => c.current && typeof c.index === 'number' && (c.next || c.index === c.total - 1)));

  // attendance: recorded, never nagged
  g.run("labSetMark('2099-02-01','skipped'); labSetMark('2099-02-03','done');");
  const wk = JSON.parse(g.run("JSON.stringify(labWeekSummary(['2099-02-01','2099-02-02','2099-02-03']))"));
  T('a skipped Lab is recorded and counted', wk.skipped === 1 && wk.done === 1 && wk.offered === 2, J(wk));
  T('a day with no Lab offered counts for nothing', wk.offered === 2);
  T('the Lab is offered on days 3 and 4 only', JSON.parse(g.run("JSON.stringify([labOfferedOn('Giorno 3'),labOfferedOn('Giorno 4'),labOfferedOn('Giorno 1'),labOfferedOn('Giorno 5')])")).join() === 'true,true,false,false');
}


/* ---- the field follows the exercise, not the prose ---- */
{
  const g = H(REPO, {}); g.run('profile=getProfile();');
  const q = (expr) => JSON.parse(g.run(`JSON.stringify(${expr})`));
  T('a hold is measured in seconds wherever it appears',
    ['L-Sit', 'Frog Stand', 'Vacuum addominale', 'Tuck L-Sit'].every((n) => q(`exMeasure([${J(n)},'3 x 8-12'])`) === 'time'),
    'the prescription says reps and it is still a hold');
  T('a repetition exercise is measured in reps even when its text mentions sec',
    ['Dead Bug', 'Hanging Knee Raise', 'Cable Crunch'].every((n) => q(`exMeasure([${J(n)},'3 x 20 sec rest'])`) === 'reps'));
  T('an unlisted exercise keeps the old prose rule',
    q("exMeasure(['Qualcosa di nuovo','3 x 20 sec'])") === 'time' && q("exMeasure(['Qualcosa di nuovo','3 x 12'])") === 'reps');
  T('bodyweight holds carry no load', ['L-Sit', 'Frog Stand', 'Plank', 'Vacuum addominale', 'Active Hang'].every((n) => q(`exLoad([${J(n)},'x'])`) === 'bodyweight'));
  T('machine work still carries a load', ['Cable Kickback', 'Hip Adduction', 'KAS Glute Bridge'].every((n) => q(`exLoad([${J(n)},'x'])`) === 'external'));
  // Pull-up is assisted or weighted, and her own history logs Dead Bug at 16 kg:
  // neither may lose its field just because it looks like calisthenics.
  T('Pull-up and Dead Bug keep their kg field', ['Pull-up', 'Dead Bug'].every((n) => q(`exLoad([${J(n)},'x'])`) === 'external'));

  // the kg cell: absent on bodyweight, kept when history already holds a number
  T('no kg field on a bodyweight exercise', q("kgCell(['L-Sit','x'],'k',{kg:'',r:''})") === '');
  T('a kg already recorded is shown, and not editable',
    /legacy-kg/.test(q("kgCell(['L-Sit','x'],'k',{kg:'5',r:''})")) && !/input/.test(q("kgCell(['L-Sit','x'],'k',{kg:'5',r:''})")),
    'her history is never rewritten');
  T('a loaded exercise still gets its input', /data-f="kg"/.test(q("kgCell(['Cable Kickback','x'],'k',{kg:'12',r:''})")));
}


/* ---- adding an exercise by hand, declared in two taps ---- */
{
  const g = H(REPO, {}); g.run('profile=getProfile();data=norm({day:"Giorno 4"});');
  const q = (expr) => JSON.parse(g.run(`JSON.stringify(${expr})`));
  const before = q('planForUser()["Giorno 4"].ex.length');

  const r1 = q('addExerciseToDay("Giorno 4","Side Plank","time","bodyweight")');
  T('an exercise added by hand lands in the day', r1.ok === true && q('planForUser()["Giorno 4"].ex.length') === before + 1);
  T('the two taps are what decides its fields',
    q("exMeasure(['Side Plank','3 x 8-12'])") === 'time' && q("exLoad(['Side Plank','x'])") === 'bodyweight',
    'declared beats both the table and the prose');
  T('the declaration is stored under its own key', Object.keys(g.store).some((k) => k.indexOf('fede:exmeta:') === 0));

  // without the two taps it falls back to the old rule, as she asked
  q('addExerciseToDay("Giorno 4","Qualcosa di mio","","")');
  T('undeclared falls back to the prose rule',
    q("exMeasure(['Qualcosa di mio','3 x 20 sec'])") === 'time' && q("exMeasure(['Qualcosa di mio','3 x 12'])") === 'reps');
  T('undeclared keeps its kg field', q("exLoad(['Qualcosa di mio','x'])") === 'external');

  T('the same exercise is not added twice', q('addExerciseToDay("Giorno 4","Side Plank","","")').ok === false);
  T('a nameless add is refused', q('addExerciseToDay("Giorno 4","   ","","")').ok === false);
  T('an unknown day is refused', q('addExerciseToDay("Giorno 99","X","","")').ok === false);
  T('history is untouched by an add', Object.keys(g.store).every((k) => !/^fede:\d{4}-/.test(k)), Object.keys(g.store).join(','));
}

// ---- Il selettore file non deve nascondere un backup salvato come .txt ----
{
  const fs2 = require('fs');
  const src = fs2.readFileSync(require('path').resolve(__dirname, '..', 'index.html'), 'utf8');
  const m = src.match(/id="impfile"\s+accept="([^"]*)"/);
  T('il campo file dichiara un filtro', !!m);
  const acc = m ? m[1] : '';
  T('accetta .json', /(^|,)\.json(,|$)/.test(acc) && /application\/json/.test(acc));
  T('accetta anche .txt: un backup rinominato resta lo stesso JSON', /(^|,)\.txt(,|$)/.test(acc) && /text\/plain/.test(acc), acc);
  T('il file viene letto come testo, non come JSON tipizzato', /r\.readAsText\(f\)/.test(src));
  T('il contenuto finisce nel riquadro, che e\' il solo percorso di import', /ex\.value=String\(r\.result\|\|''\)/.test(src));
}

console.log(fail ? '\n' + fail + ' FAILED (add)' : '\nadd: all good');
process.exit(fail ? 1 : 0);
