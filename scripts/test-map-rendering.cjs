/* Run with: node scripts/test-map-rendering.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { test } = require('node:test');
const babel = require('@babel/core');
const THREE = require('three');
const root = path.resolve(__dirname, '..');
const cache = new Map();
class Stub {}
function loadSource(relativePath) {
  if (cache.has(relativePath)) return cache.get(relativePath);
  const filename = path.join(root, 'src', relativePath);
  const baseline = process.env.MAP_RENDERING_BASELINE;
  const input = baseline && ['utils/draw.js', 'renderer/map.js'].includes(relativePath)
    ? path.join(baseline, `${path.basename(relativePath, '.js')}.before.js`) : filename;
  const code = babel.transformSync(fs.readFileSync(input, 'utf8'), {
    filename, babelrc: false, configFile: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const nativeRequire = mod.require.bind(mod);
  mod.require = (name) => {
    if (name === 'store') return { options: {}, hmi: {} };
    if (name === 'store/websocket') return { MAP_WS: {} };
    if (name === 'utils/draw') return loadSource('utils/draw.js');
    if (name.startsWith('renderer/')) return Stub;
    if (name.startsWith('assets/')) return '';
    if (name === './misc') return loadSource('utils/misc.js');
    return nativeRequire(name);
  };
  mod._compile(code, filename);
  cache.set(relativePath, mod.exports);
  return mod.exports;
}
global.window = { matchMedia: () => ({ matches: true }) };
const draw = loadSource('utils/draw.js');
const MapRenderer = loadSource('renderer/map.js').default;
const Coordinates = loadSource('renderer/coordinates.js').default;
const offset = new THREE.Vector3(587000, 4140000, 123);
const points = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(20, 12, 1),
  new THREE.Vector3(40, 10, 2)];
const translated = points.map(p => p.clone().add(offset));
function worldVertex(mesh, index) {
  mesh.updateMatrixWorld(true);
  return new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, index)
    .applyMatrix4(mesh.matrixWorld);
}
function compareTranslatedMeshes(near, far) {
  assert.deepEqual(Array.from(far.geometry.index.array), Array.from(near.geometry.index.array));
  assert.equal(far.geometry.attributes.position.count, near.geometry.attributes.position.count);
  for (let i = 0; i < near.geometry.attributes.position.count; i += 1) {
    const error = worldVertex(far, i).sub(offset).distanceTo(worldVertex(near, i));
    assert.ok(error < 0.00001, `vertex ${i} shifted by ${error} metres`);
  }
}
test('10 cm solid markings retain geometry at UTM-scale coordinates', () => {
  compareTranslatedMeshes(draw.drawPolylineBandFromPoints(points, 0.1),
    draw.drawPolylineBandFromPoints(translated, 0.1));
});
test('dashes retain width, gaps and height at UTM-scale coordinates', () => {
  compareTranslatedMeshes(draw.drawDashedBandFromPoints(points, 0.1),
    draw.drawDashedBandFromPoints(translated, 0.1));
});
test('polygon holes, elevation and world-aligned UVs survive translation', () => {
  const contour = [[0, 0], [20, 0], [20, 20], [0, 20]].map(p => new THREE.Vector3(...p, 0));
  const hole = [[5, 5], [5, 15], [15, 15], [15, 5]].map(p => new THREE.Vector3(...p, 0));
  const near = draw.drawPolygonSurfaceFromRings(contour, [hole]);
  const far = draw.drawPolygonSurfaceFromRings(contour.map(p => p.clone().add(offset)),
    [hole.map(p => p.clone().add(offset))]);
  compareTranslatedMeshes(near, far);
  assert.deepEqual(Array.from(near.geometry.attributes.uv.array),
    Array.from(far.geometry.attributes.uv.array));
  let area = 0;
  const indices = far.geometry.index.array;
  for (let i = 0; i < indices.length; i += 3) {
    const a = worldVertex(far, indices[i]);
    area += worldVertex(far, indices[i + 1]).sub(a)
      .cross(worldVertex(far, indices[i + 2]).sub(a)).length() / 2;
  }
  assert.ok(Math.abs(area - 300) < 0.0001);
});
test('empty geometry stays finite', () => {
  for (const mesh of [draw.drawPolylineBandFromPoints([]), draw.drawDashedBandFromPoints([])]) {
    assert.equal(mesh.geometry.attributes.position.count, 0);
    assert.ok(mesh.position.toArray().every(Number.isFinite));
  }
  assert.equal(draw.drawPolygonSurfaceFromRings([]), null);
});
test('double yellow ribbons keep equal height and 26 cm separation in both view modes', () => {
  for (const cameraView of [false, true]) {
    const renderer = new MapRenderer();
    renderer.zOffsetFactor = cameraView ? 0 : 1;
    const boundary = renderer.addLaneMesh('DOUBLE_YELLOW', translated);
    boundary.updateMatrixWorld(true);
    const meshes = [];
    boundary.traverse(child => { if (child.geometry) meshes.push(child); });
    assert.equal(meshes.length, 2);
    const center = mesh => worldVertex(mesh, 0).add(worldVertex(mesh, 1)).multiplyScalar(0.5);
    const left = center(meshes[0]);
    const right = center(meshes[1]);
    assert.ok(Math.abs(left.distanceTo(right) - 0.26) < 0.00001);
    assert.ok(Math.abs(left.z - (123 + (cameraView ? 0 : 0.04))) < 0.00001);
    assert.ok(Math.abs(left.z - right.z) < 0.00001);
  }
});
test('real map junction virtual boundaries and physical boundaries both remain visible', () => {
  const protobuf = require('protobufjs');
  const proto = protobuf.Root.fromJSON(require('../proto_bundle/sim_world_proto_bundle.json'));
  const type = proto.lookupType('apollo.hdmap.Map');
  const mapPath = path.resolve(root, '../../modules/map/data/sunnyvale_loop/sim_map.bin');
  const data = type.toObject(type.decode(fs.readFileSync(mapPath)), { enums: String });
  const renderer = new MapRenderer();
  const coordinates = new Coordinates();
  coordinates.initialize(0, 0);
  const scene = new THREE.Scene();
  const lanes = [data.lane.find(l => l.leftBoundary.virtual && l.rightBoundary.virtual),
    data.lane.find(l => !l.leftBoundary.virtual && !l.rightBoundary.virtual)];
  assert.ok(lanes.every(Boolean));
  for (const lane of lanes) {
    const objects = renderer.addLane(lane, coordinates, scene);
    const boundaries = objects.filter(o => /^(Left|Right)Boundary-/.test(o.name));
    const expected = [lane.leftBoundary, lane.rightBoundary]
      .reduce((n, b) => n + b.curve.segment.length, 0);
    assert.equal(boundaries.length, expected);
    assert.ok(boundaries.every(boundary => boundary.visible));
    assert.ok(objects.some(o => o.name.startsWith('LaneSurface-')));
    renderer.removeDrewObjects(objects, scene);
  }
  assert.equal(scene.children.length, 0);
});
