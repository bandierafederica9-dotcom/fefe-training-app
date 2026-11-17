// Every local URL the CSS references must resolve to a file that exists.
// This is the bug the CSS extraction introduced: url('assets/home/x.png') was
// relative to the page while the stylesheet was inline, and became
// assets/css/assets/home/x.png once it moved — a silent 404, invisible to
// every other test because nothing here renders a page.
const fs = require('fs'), path = require('path');
const { REPO, scriptFiles } = require('./appsource');
let fail = 0; const T = (n, ok, x) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };

const cssFiles = (() => {
  const h = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  const out = []; let m; const re = /<link[^>]+href="\.\/([^"?]+\.css)[^"]*"/g;
  while ((m = re.exec(h))) out.push(m[1]);
  return out;
})();

T('the page links at least one stylesheet', cssFiles.length > 0, cssFiles.join(','));

cssFiles.forEach((rel) => {
  const dir = path.dirname(rel);
  const css = fs.readFileSync(path.join(REPO, rel), 'utf8');
  const urls = [...css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map((m) => m[1]).filter((u) => !/^(https?:|data:|#)/.test(u));
  const missing = urls.filter((u) => !fs.existsSync(path.join(REPO, dir, u.split('?')[0])));
  T(rel + ': every local url() resolves (' + urls.length + ' checked)', missing.length === 0, missing.join(', '));
});

// the same for the files the page loads as scripts
scriptFiles().forEach((rel) => {
  T('script exists: ' + rel, fs.existsSync(path.join(REPO, rel)));
});

// and for the files the service worker promises to cache
const sw = fs.readFileSync(path.join(REPO, 'sw.js'), 'utf8');
const cached = [...new Set((sw.match(/"\.\/[^"]+"/g) || []).map((s) => s.slice(3, -1)))];
const gone = cached.filter((f) => !fs.existsSync(path.join(REPO, f)));
T('every file the service worker caches exists (' + cached.length + ' listed)', gone.length === 0, gone.join(', '));

console.log(fail ? '\n' + fail + ' FAILED' : '\nall good');
process.exit(fail ? 1 : 0);
