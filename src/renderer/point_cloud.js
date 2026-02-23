import * as THREE from 'three';

const MAX_POINTS = 200000;

// Sorted height thresholds (upper bound, exclusive) for per-point color assignment.
const HEIGHT_THRESHOLDS = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0];

// Pre-computed linear RGB triplets [r, g, b] for each height band.
const HEIGHT_COLORS_RGB = [
  [1.0, 0.0, 0.0],    // 0xFF0000  z < 0.5
  [1.0, 0.498, 0.0],  // 0xFF7F00  z < 1.0
  [1.0, 1.0, 0.0],    // 0xFFFF00  z < 1.5
  [0.0, 1.0, 0.0],    // 0x00FF00  z < 2.0
  [0.0, 0.0, 1.0],    // 0x0000FF  z < 2.5
  [0.294, 0.0, 0.51], // 0x4B0082  z < 3.0
  [0.58, 0.0, 0.827], // 0x9400D3  z >= 3.0
];

// Vertex shader: applies ADC rotation + translation as uniforms so that
// per-frame Object3D matrix updates are avoided.  Point-size attenuation
// matches the Three.js PointsMaterial formula: size * scale / -z.
const VERTEX_SHADER = `
  uniform float uOffsetX;
  uniform float uOffsetY;
  uniform float uOffsetZ;
  uniform float uRotationZ;
  uniform float uPointScale;
  attribute vec3 vertexColor;
  varying vec3 vColor;
  void main() {
    vColor = vertexColor;
    float cosR = cos(uRotationZ);
    float sinR = sin(uRotationZ);
    vec3 transformed = vec3(
      position.x * cosR - position.y * sinR + uOffsetX,
      position.x * sinR + position.y * cosR + uOffsetY,
      position.z + uOffsetZ
    );
    vec4 mvPos = modelViewMatrix * vec4(transformed, 1.0);
    gl_PointSize = 0.25 * uPointScale * projectionMatrix[1][1] / (-mvPos.z);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const FRAGMENT_SHADER = `
  uniform float uOpacity;
  varying vec3 vColor;
  void main() {
    gl_FragColor = vec4(vColor, uOpacity);
  }
`;

// Returns the index into HEIGHT_COLORS_RGB for the given z value.
function getColorIndex(z) {
  for (let i = 0; i < HEIGHT_THRESHOLDS.length; i++) {
    if (z < HEIGHT_THRESHOLDS[i]) {
      return i;
    }
  }
  return HEIGHT_THRESHOLDS.length;
}

export default class PointCloud {
  constructor() {
    this.points = null;
    this.initialized = false;
  }

  initialize() {
    this.points = this.createPointCloud();
    this.initialized = true;
  }

  createPointCloud() {
    const geometry = new THREE.BufferGeometry();

    // Allocate typed arrays once; written in-place every update.
    const positions = new Float32Array(MAX_POINTS * 3);
    const colors = new Float32Array(MAX_POINTS * 3);

    const posAttr = new THREE.BufferAttribute(positions, 3);
    const colAttr = new THREE.BufferAttribute(colors, 3);

    // Mark as dynamic so the GPU driver can optimise for frequent uploads.
    posAttr.dynamic = true;
    colAttr.dynamic = true;

    geometry.addAttribute('position', posAttr);
    geometry.addAttribute('vertexColor', colAttr);

    // Start with nothing visible; setDrawRange replaces the old
    // "hide unused points by moving them to (0,0,-10)" loop.
    geometry.setDrawRange(0, 0);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uOffsetX: { type: 'f', value: 0.0 },
        uOffsetY: { type: 'f', value: 0.0 },
        uOffsetZ: { type: 'f', value: 0.0 },
        uRotationZ: { type: 'f', value: 0.0 },
        uOpacity: { type: 'f', value: 0.7 },
        uPointScale: { type: 'f', value: 1.0 },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
    });

    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    return points;
  }

  update(pointCloud, adcMesh) {
    if (this.points === null) {
      return;
    }
    if (pointCloud.num.length % 3 !== 0) {
      console.warn('PointCloud length should be multiples of 3!');
      return;
    }

    const pointCloudSize = pointCloud.num.length / 3;
    const total = Math.min(pointCloudSize, MAX_POINTS);
    const positions = this.points.geometry.attributes.position.array;
    const colors = this.points.geometry.attributes.vertexColor.array;

    for (let i = 0; i < total; i++) {
      const x = pointCloud.num[i * 3];
      const y = pointCloud.num[i * 3 + 1];
      const z = pointCloud.num[i * 3 + 2];
      const idx = i * 3;

      positions[idx] = x;
      positions[idx + 1] = y;
      positions[idx + 2] = z + 0.8;

      const colorRgb = HEIGHT_COLORS_RGB[getColorIndex(z)];
      colors[idx] = colorRgb[0];
      colors[idx + 1] = colorRgb[1];
      colors[idx + 2] = colorRgb[2];
    }

    // Only render the active portion; no need to zero out the rest.
    this.points.geometry.setDrawRange(0, total);
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.vertexColor.needsUpdate = true;

    // Update shader uniforms instead of mutating Object3D transforms.
    const { uniforms } = this.points.material;
    uniforms.uOffsetX.value = adcMesh.position.x;
    uniforms.uOffsetY.value = adcMesh.position.y;
    uniforms.uOffsetZ.value = adcMesh.position.z;
    uniforms.uRotationZ.value = adcMesh.rotation.y;
    uniforms.uPointScale.value = window.innerHeight / 2.0;
  }
}
