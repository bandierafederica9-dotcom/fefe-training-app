// Loads index.html's inline script into an isolated VM with an in-memory localStorage.
// Usage: const {ctx, store, run} = require('./harness')(repoDir, initialStore)
const fs = require('fs'), vm = require('vm'), path = require('path');
module.exports = function load(repo, initial, htmlOverride) {
  const html = htmlOverride || fs.readFileSync(path.join(repo, 'index.html'), 'utf8');
  const a = html.indexOf('<script>'), b = html.lastIndexOf('</script>');
  let js = html.slice(a + 8, b);
  // Do not boot the app or register the Service Worker inside tests.
  js = js.replace(/\nload\(\);\n/, '\n').replace(/if\('serviceWorker' in navigator\)[\s\S]*$/, '');
  const store = Object.assign({}, initial || {});
  const localStorage = {
    getItem: k => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    key: i => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
  // Minimal fake elements (attributes + style properties) so visual helpers can be exercised.
  const el = () => { const attrs = {}, props = {};
    return { innerHTML: '', style: { setProperty(k, v) { props[k] = String(v); }, getPropertyValue(k) { return props[k] || ''; } }, textContent: '', appendChild() {}, querySelectorAll: () => [], addEventListener() {}, set onclick(f) {}, value: '',
      setAttribute(k, v) { attrs[k] = String(v); }, getAttribute(k) { return k in attrs ? attrs[k] : null; }, hasAttribute(k) { return k in attrs; }, removeAttribute(k) { delete attrs[k]; } }; };
  const els = { page: el(), nav: el(), app: el(), status: el() };
  // Listeners registered by the app script are recorded (not executed) so tests can inspect/trigger them.
  const listeners = { document: [], window: [] };
  const ctx = vm.createContext({
    localStorage, console, setTimeout, clearTimeout, setInterval, clearInterval, JSON, Math, Date, Promise, Set, Map, WeakMap, Object, Array, String, Number, RegExp, Error, parseInt, parseFloat, isNaN, encodeURIComponent,
    __listeners: listeners,
    document: { getElementById: id => els[id] || null, querySelectorAll: () => [], querySelector: () => null, createElement: () => el(), addEventListener(t, f, o) { listeners.document.push({ type: t, fn: f, opts: o }); }, body: { scrollHeight: 0 }, visibilityState: 'visible' },
    window: { scrollTo() {}, addEventListener(t, f, o) { listeners.window.push({ type: t, fn: f, opts: o }); }, location: { reload() {} } },
    navigator: {}, location: { reload() {} },
    alert() {}, confirm: () => true,
  });
  vm.runInContext(js, ctx, { filename: 'index.html#script' });
  const run = code => vm.runInContext(code, ctx);
  return { ctx, store, run };
};
