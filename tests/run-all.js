// Runs every test suite. No dependencies: `node tests/run-all.js`
// All tests use SYNTHETIC / anonymised data and an in-memory localStorage; nothing is written to disk.
const { spawnSync } = require('child_process');
const fs = require('fs'), path = require('path');
const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).sort();
let totalPass = 0, totalFail = 0, failedSuites = [];
for (const f of files) {
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  const pass = (out.match(/^PASS /gm) || []).length, failN = (out.match(/^FAIL /gm) || []).length;
  totalPass += pass; totalFail += failN;
  if (r.status !== 0 || failN) failedSuites.push(f);
  console.log(f.padEnd(22) + ' ' + String(pass).padStart(3) + ' pass  ' + String(failN).padStart(3) + ' fail' + (r.status !== 0 ? '  (exit ' + r.status + ')' : ''));
  out.split('\n').filter(l => l.startsWith('FAIL ')).forEach(l => console.log('   ' + l));
}
console.log('\nTOTAL: ' + totalPass + ' pass, ' + totalFail + ' fail' + (failedSuites.length ? '  -> failing: ' + failedSuites.join(', ') : ''));
process.exit(failedSuites.length ? 1 : 0);
