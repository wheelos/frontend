
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

// Vertex shader: 使用 position.z 来判断高度（直接使用RFU数据）
const VERTEX_SHADER = `
  uniform float uPointScale;
  uniform float uThresholds[6];
  uniform vec3 uColors[7];

  varying vec3 vColor;

  void main() {
    // 高度在 position.z (RFU坐标系中Z=Up)
    float h = position.z;
    if (h < uThresholds[0]) { vColor = uColors[0]; }
    else if (h < uThresholds[1]) { vColor = uColors[1]; }
    else if (h < uThresholds[2]) { vColor = uColors[2]; }
    else if (h < uThresholds[3]) { vColor = uColors[3]; }
    else if (h < uThresholds[4]) { vColor = uColors[4]; }
    else if (h < uThresholds[5]) { vColor = uColors[5]; }
    else { vColor = uColors[6]; }

    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);

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
    this.scene = null;
    this._pointScale = 20.0; // 默认点云大小
  }

  setPointScale(scale) {
    this._pointScale = scale;
    if (this.points && this.points.material.uniforms.uPointScale) {
      this.points.material.uniforms.uPointScale.value = scale;
    }
  }

  getPointScale() {
    return this._pointScale;
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
        uOpacity: { value: 0.7 },
        uPointScale: { value: 15.0 },
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

  update(pointCloud, adcMesh, scene) {
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

    // 直接复制RFU数据，通过对象旋转来修正方向
    for (let i = 0; i < dataLength; i += 3) {
      posAttr.array[i] = pointCloud.num[i];
      posAttr.array[i + 1] = pointCloud.num[i + 1];
      posAttr.array[i + 2] = pointCloud.num[i + 2];
    }

    this._pointCount = total;

    // Explicitly constrain GPU upload bandwidth to ONLY the data we touched
    posAttr.updateRange.offset = 0;
    posAttr.updateRange.count = dataLength;
    posAttr.needsUpdate = true;
    this.points.geometry.setDrawRange(0, total);

    // Attach to ADC mesh as child
    if (this.points.parent !== adcMesh) {
      if (this.points.parent) {
        this.points.parent.remove(this.points);
      }
      adcMesh.add(this.points);
    }

    // 应用旋转：X轴-90°使Z向上，Z轴-90°修正XY方向
    this.points.position.set(0, 0, 0);
    this.points.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);

    // 抵消父对象（ADC mesh）的缩放，避免点云被放大或缩小
    const parentScale = adcMesh.scale;
    this.points.scale.set(1 / parentScale.x, 1 / parentScale.y, 1 / parentScale.z);

    // Update point size
    if (this.points.material.uniforms.uPointScale) {
      this.points.material.uniforms.uPointScale.value = this._pointScale;
    }
  }
}
