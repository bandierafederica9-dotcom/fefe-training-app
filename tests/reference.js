// Reviewed release reference (replaces `git show HEAD:...` so the tests run without Git history).
// tests/fixtures/release-reference/ holds index.html, sw.js and manifest.json exactly as released;
// update it deliberately together with any reviewed app change.
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, 'fixtures', 'release-reference'), REPO = path.resolve(__dirname, '..');
const read = (base, f) => fs.readFileSync(path.join(base, f), 'utf8');
// Lines added/removed between the reference and the current file, formatted like `git diff -U0` (+line / -line).
function diffLines(file) {
  const a = read(DIR, file).split('\n'), b = read(REPO, file).split('\n');
  const count = arr => arr.reduce((m, l) => m.set(l, (m.get(l) || 0) + 1), new Map());
  const ca = count(a), cb = count(b), out = [];
  ca.forEach((n, l) => { for (let i = 0; i < n - (cb.get(l) || 0); i++) out.push('-' + l); });
  cb.forEach((n, l) => { for (let i = 0; i < n - (ca.get(l) || 0); i++) out.push('+' + l); });
  return out;
}
module.exports = { indexHtml: read(DIR, 'index.html'), diffLines, unchanged: file => read(DIR, file) === read(REPO, file) };
