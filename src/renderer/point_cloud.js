
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

// Vertex shader: use position.z for height (directly using RFU data)
const VERTEX_SHADER = `
  uniform float uPointScale;
  uniform float uThresholds[6];
  uniform vec3 uColors[7];
  uniform float uHeightMin;
  uniform float uHeightMax;

  varying vec3 vColor;

  void main() {
    // Height range filter
    float h = position.z;
    if (h < uHeightMin || h > uHeightMax) {
      gl_PointSize = 0.0;
      gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }

    // Color assignment based on height
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
    this._heightMin = 0.0; // 默认高度范围最小值
    this._heightMax = 10.0; // 默认高度范围最大值
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

  setHeightRange(min, max) {
    this._heightMin = min;
    this._heightMax = max;
    if (this.points && this.points.material.uniforms.uHeightMin) {
      this.points.material.uniforms.uHeightMin.value = min;
      this.points.material.uniforms.uHeightMax.value = max;
    }
  }

  getHeightRange() {
    return {
      min: this._heightMin,
      max: this._heightMax,
    };
  }

  initialize() {
    this.points = this.createPointCloud();
    // Create independent group to hold point cloud, avoiding inheriting ADC mesh scale
    this.pointCloudGroup = new THREE.Group();
    this.pointCloudGroup.add(this.points);
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
        uHeightMin: { value: this._heightMin },
        uHeightMax: { value: this._heightMax },
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

    // Copy RFU data directly, correct orientation via rotation
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

    // Attach group to scene (if not already attached)
    if (this.pointCloudGroup.parent !== scene) {
      if (this.pointCloudGroup.parent) {
        this.pointCloudGroup.parent.remove(this.pointCloudGroup);
      }
      scene.add(this.pointCloudGroup);
    }

    // Sync group position and rotation with ADC mesh, but NOT scale
    this.pointCloudGroup.position.copy(adcMesh.position);
    this.pointCloudGroup.rotation.copy(adcMesh.rotation);
    // Don't set scale on group to avoid inheriting ADC mesh scale

    // Point cloud rotation: X-90 to make Z up, Z-90 to correct XY orientation
    this.points.position.set(0, 0, 0);
    this.points.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
    this.points.scale.set(1, 1, 1);

    // Update point size
    if (this.points.material.uniforms.uPointScale) {
      this.points.material.uniforms.uPointScale.value = this._pointScale;
    }

    // Update height range
    if (this.points.material.uniforms.uHeightMin) {
      this.points.material.uniforms.uHeightMin.value = this._heightMin;
    }
    if (this.points.material.uniforms.uHeightMax) {
      this.points.material.uniforms.uHeightMax.value = this._heightMax;
    }
  }
}
