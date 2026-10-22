const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const babel = require('@babel/core');
const root = require('node:path').resolve(__dirname, '..');
const filename = root + '/src/store/traffic_signs.js';
const {code} = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
  configFile: root + '/.babelrc.js', filename,
});
const compiled = new Module(filename, module);
compiled.filename = filename;
compiled.paths = Module._nodeModulePaths(root);
compiled._compile(code, filename);
const TrafficSigns = compiled.exports.default;
(async () => {
  const store = new TrafficSigns();
  store.update({signs: [{className: 'III-35', score: 0.65},
    {className: '', score: 0.9}, {className: 'bad', score: NaN},
    {className: 'bad', score: 2}, null]});
  assert.equal(store.signs.length, 1);
  assert.equal(store.signs[0].className, 'III-35');
  store.update({signs: [{className: 'III-35', score: 0.65},
    {className: 'III-35', score: 0.8}]});
  assert.equal(store.signs.length, 1, 'duplicate labels show once');
  assert.equal(store.signs[0].score, 0.8, 'strongest score wins');
  store.update({signs: [{className: 'II-2', signType: 'stop', displayName: 'Stop', score: 0.96}]});
  assert.equal(store.signs[0].signType, 'stop', 'semantic type is retained for icon lookup');
  assert.equal(store.signs[0].className, 'Stop', 'readable label is retained');
  store.update({signs: [{className: 'unknown', score: 0.6}]});
  assert.equal(store.signs[0].signType, '', 'legacy detections retain a text fallback');
  store.update({signs: []});
  assert.equal(store.signs.length, 0, 'empty frame clears immediately');
  store.update({signs: [{className: 'III-35', score: 0.65}]});
  await new Promise(resolve => setTimeout(resolve, 2100));
  assert.equal(store.signs.length, 0, 'stale detections expire');
  store.update({signs: [{className: 'III-35', score: 0.65}]});
  store.clear();
  assert.equal(store.signs.length, 0, 'disconnect clears');
  assert.equal(store.expiryTimer, null);
  console.log('PASS: valid/filter, empty, expiry, disconnect');
})();
