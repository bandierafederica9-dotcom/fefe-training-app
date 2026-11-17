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

console.log(fail ? '\n' + fail + ' FAILED' : '\nall good');
process.exit(fail ? 1 : 0);
