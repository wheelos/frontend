
import * as THREE from 'three';

// Support up to 1 million points; Float32Array keeps GPU upload cost flat.
const MAX_POINTS = 1000000;

// Sorted height thresholds (upper bound, exclusive) for per-point color assignment.
const HEIGHT_THRESHOLDS = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0];

// Pre-computed linear RGB triplets [r, g, b] for each height band.
const HEIGHT_COLORS_RGB = [
  new THREE.Vector3(1.0, 0.0, 0.0),    // 0xFF0000  z < 0.5
  new THREE.Vector3(1.0, 0.498, 0.0),  // 0xFF7F00  z < 1.0
  new THREE.Vector3(1.0, 1.0, 0.0),    // 0xFFFF00  z < 1.5
  new THREE.Vector3(0.0, 1.0, 0.0),    // 0x00FF00  z < 2.0
  new THREE.Vector3(0.0, 0.0, 1.0),    // 0x0000FF  z < 2.5
  new THREE.Vector3(0.294, 0.0, 0.51), // 0x4B0082  z < 3.0
  new THREE.Vector3(0.58, 0.0, 0.827), // 0x9400D3  z >= 3.0
];

// Vertex shader: Handles GPU-side coloring based on local Z and applies
// transformation matrices natively. Point-size is screen-space attenuated.
const VERTEX_SHADER = `
  uniform mat4 uTransform;
  uniform float uPointScale;
  uniform float uThresholds[6];
  uniform vec3 uColors[7];

  varying vec3 vColor;

  void main() {
    // Dynamic color assignment entirely on the GPU based on RAW local Z
    float z = position.z;
    if (z < uThresholds[0]) { vColor = uColors[0]; }
    else if (z < uThresholds[1]) { vColor = uColors[1]; }
    else if (z < uThresholds[2]) { vColor = uColors[2]; }
    else if (z < uThresholds[3]) { vColor = uColors[3]; }
    else if (z < uThresholds[4]) { vColor = uColors[4]; }
    else if (z < uThresholds[5]) { vColor = uColors[5]; }
    else { vColor = uColors[6]; }

    vec4 worldPos = uTransform * vec4(position, 1.0);
    vec4 mvPos = modelViewMatrix * worldPos;

    gl_PointSize = uPointScale * projectionMatrix[1][1] / (-mvPos.z);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const FRAGMENT_SHADER = `
  uniform float uOpacity;
  varying vec3 vColor;
  void main() {
    // Render circular point sprites with soft edges using gl_PointCoord.
    vec2 c = gl_PointCoord - vec2(0.5);
    float dist2 = dot(c, c);
    if (dist2 > 0.25) discard;
    float alpha = 1.0 - smoothstep(0.16, 0.25, dist2);
    gl_FragColor = vec4(vColor, uOpacity * alpha);
  }
`;

export default class PointCloud {
  constructor() {
    this.points = null;
    this.initialized = false;
    this._pointCount = 0;

    // Reusable matrices to avoid per-frame allocation
    this._transformMatrix = new THREE.Matrix4();
    this._rotationMatrix = new THREE.Matrix4();
    this._offsetMatrix = new THREE.Matrix4().makeTranslation(0, 0, 0.8);
  }

  initialize() {
    this.points = this.createPointCloud();
    this.initialized = true;
  }

  createPointCloud() {
    const geometry = new THREE.BufferGeometry();

    // Allocate typed array for positions once. We no longer need 'colors'!
    const positions = new Float32Array(MAX_POINTS * 3);
    const posAttr = new THREE.BufferAttribute(positions, 3);
    posAttr.dynamic = true; // Mark as dynamic for driver optimization

    geometry.addAttribute('position', posAttr);
    geometry.setDrawRange(0, 0);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTransform: { value: new THREE.Matrix4() },
        uOpacity: { value: 0.7 },
        uPointScale: { value: 2.0 },
        // Pass arrays to the shader for GPU-side color mapping (modern style)
        uThresholds: { value: HEIGHT_THRESHOLDS },
        uColors: { value: HEIGHT_COLORS_RGB },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
    });

    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    return points;
  }

  getPointCount() {
    return this._pointCount;
  }

  update(pointCloud, adcMesh) {
    if (this.points === null || !pointCloud || !pointCloud.num) {
      return;
    }

    const rawLength = pointCloud.num.length;
    if (rawLength % 3 !== 0) {
      console.warn('PointCloud length should be multiples of 3!');
      return;
    }

    const total = Math.min(rawLength / 3, MAX_POINTS);
    const dataLength = total * 3;
    const posAttr = this.points.geometry.attributes.position;

    // Fast-path memory copy:
    // If pointCloud.num is a TypedArray (like Float32Array from WS), use ultra-fast .set()
    if (pointCloud.num.subarray) {
      posAttr.array.set(pointCloud.num.subarray(0, dataLength));
    } else {
      // Fallback for standard arrays
      for (let i = 0; i < dataLength; i++) {
        posAttr.array[i] = pointCloud.num[i];
      }
    }

    this._pointCount = total;

    // Explicitly constrain GPU upload bandwidth to ONLY the data we touched
    posAttr.updateRange.offset = 0;
    posAttr.updateRange.count = dataLength;
    posAttr.needsUpdate = true;
    this.points.geometry.setDrawRange(0, total);

    // Build the transformation matrix using Three.js built-in API.
    // Order of operations (right-to-left): Local Z Offset -> Yaw Rotation -> Translation
    this._rotationMatrix.makeRotationZ(adcMesh.rotation.y);

    this._transformMatrix.identity();
    this._transformMatrix.setPosition(adcMesh.position.x, adcMesh.position.y, adcMesh.position.z);
    this._transformMatrix.multiply(this._rotationMatrix);
    this._transformMatrix.multiply(this._offsetMatrix); // Replaces the per-point `z + 0.8` CPU addition

    this.points.material.uniforms.uTransform.value.copy(this._transformMatrix);
  }
}
