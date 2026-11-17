// One place that knows where the app's source lives.
// The app used to be a single index.html; it is being split into
// index.html + assets/css/app.css + js/*.js. Tests ask here instead of
// slicing the HTML themselves, so a future move touches this file only.
const fs = require('fs'), path = require('path');
const REPO = path.resolve(__dirname, '..');

const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');
const html = () => read('index.html');

function css() {
  const h = html();
  const i = h.indexOf('<style>');
  if (i >= 0) return h.slice(i + 7, h.indexOf('</style>'));   // not split yet
  return linked('link[rel=stylesheet]', /<link[^>]+href="\.\/([^"?]+\.css)[^"]*"/g).join('\n');
}

// every local script the page loads, in page order; [] while the JS is still inline
function scriptFiles() {
  return linkedPaths(/<script[^>]+src="\.\/([^"?]+\.js)[^"]*"/g);
}

function js() {
  const files = scriptFiles();
  if (files.length) return files.map(read).join('\n;\n');
  const h = html();
  return h.slice(h.indexOf('<script>') + 8, h.lastIndexOf('</script>'));
}

function linkedPaths(re) {
  const h = html(); const out = []; let m;
  while ((m = re.exec(h))) out.push(m[1]);
  return out;
}
function linked(_sel, re) { return linkedPaths(re).map(read); }

module.exports = { REPO, read, html, css, js, scriptFiles };
