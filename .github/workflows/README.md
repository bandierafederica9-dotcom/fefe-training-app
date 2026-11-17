# Workflows

`tests.yml` runs `node tests/run-all.js` on every push and pull request.

The suite loads the inline script of `index.html` into an isolated VM with an
in-memory localStorage (`tests/harness.js`). It touches no network and writes
nothing to disk, and every fixture is synthetic or anonymised.

During the v8 rebuild the rule is: **green before a change, green after it.**
