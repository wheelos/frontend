import * as THREE from 'three';
import STORE from 'store';

// Maximum history duration (seconds) and sample rate (Hz)
const HISTORY_DURATION_S = 60;
const SAMPLE_RATE_HZ = 10;
const MAX_POINTS = HISTORY_DURATION_S * SAMPLE_RATE_HZ; // 600
const MIN_SAMPLE_INTERVAL_MS = 1000 / SAMPLE_RATE_HZ; // 100 ms

// Base colors for the two trajectories (R, G, B components in [0, 1])
const LIDAR_COLOR = { r: 0.0, g: 0.67, b: 1.0 }; // light blue
const GNSS_COLOR = { r: 1.0, g: 0.4, b: 0.0 }; // orange

// Size of the axes helper (meters)
const AXES_SIZE = 3;

class RingBuffer {
  constructor(capacity) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
    this.size = 0;
    this.head = 0;
    this.tail = 0;
  }

  push(item) {
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.capacity;
    if (this.size < this.capacity) {
      this.size += 1;
    } else {
      // overwrite oldest entry
      this.head = (this.head + 1) % this.capacity;
    }
  }

  getOrdered() {
    const result = [];
    for (let i = 0; i < this.size; i += 1) {
      result.push(this.buffer[(this.head + i) % this.capacity]);
    }
    return result;
  }

  clear() {
    this.size = 0;
    this.head = 0;
    this.tail = 0;
  }
}

function createTrailLine(baseColor) {
  const positions = new Float32Array(MAX_POINTS * 3);
  const colors = new Float32Array(MAX_POINTS * 3);

  const geometry = new THREE.BufferGeometry();
  geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setDrawRange(0, 0);

  const material = new THREE.LineBasicMaterial({
    vertexColors: THREE.VertexColors,
    transparent: false,
    depthWrite: false,
  });

  const line = new THREE.Line(geometry, material);
  line.frustumCulled = false;
  line.visible = false;
  line.userData.baseColor = baseColor;
  return line;
}

function updateTrailLine(line, points) {
  const { baseColor } = line.userData;
  const posAttr = line.geometry.attributes.position;
  const colAttr = line.geometry.attributes.color;

  const count = points.length;
  for (let i = 0; i < count; i += 1) {
    const pt = points[i];
    posAttr.array[i * 3] = pt.x;
    posAttr.array[i * 3 + 1] = pt.y;
    posAttr.array[i * 3 + 2] = pt.z;

    // Brightness fades from 0 (oldest) to 1 (newest)
    const brightness = count > 1 ? i / (count - 1) : 1;
    colAttr.array[i * 3] = baseColor.r * brightness;
    colAttr.array[i * 3 + 1] = baseColor.g * brightness;
    colAttr.array[i * 3 + 2] = baseColor.b * brightness;
  }

  line.geometry.setDrawRange(0, count);
  posAttr.needsUpdate = true;
  colAttr.needsUpdate = true;
}

export default class LocalizationHistory {
  constructor() {
    // Ring buffers for the two trajectories
    this.lidarBuffer = new RingBuffer(MAX_POINTS);
    this.gnssBuffer = new RingBuffer(MAX_POINTS);

    // Trail line objects (lazily added to the scene)
    this.lidarLine = createTrailLine(LIDAR_COLOR);
    this.gnssLine = createTrailLine(GNSS_COLOR);

    // TF-style axes helper at current pose
    this.axesHelper = new THREE.AxesHelper(AXES_SIZE);
    this.axesHelper.visible = false;

    // Throttle timestamps
    this.lastLidarUpdateMs = 0;
    this.lastGnssUpdateMs = 0;

    this.sceneInitialized = false;
  }

  initScene(scene) {
    if (!this.sceneInitialized) {
      scene.add(this.lidarLine);
      scene.add(this.gnssLine);
      scene.add(this.axesHelper);
      this.sceneInitialized = true;
    }
  }

  update(world, coordinates, scene) {
    this.initScene(scene);

    const show = STORE.options.showPoseHistory;

    // Update main (LiDAR) localization trajectory
    const adcPose = world.autoDrivingCar;
    if (adcPose && typeof adcPose.positionX === 'number' && typeof adcPose.positionY === 'number') {
      const nowMs = Date.now();
      if (nowMs - this.lastLidarUpdateMs >= MIN_SAMPLE_INTERVAL_MS) {
        const position = coordinates.applyOffset({
          x: adcPose.positionX,
          y: adcPose.positionY,
          z: 0,
        });
        if (position) {
          this.lidarBuffer.push({ x: position.x, y: position.y, z: 0.1 });
          this.lastLidarUpdateMs = nowMs;
        }
      }

      // Update AxesHelper at current pose
      const curPos = coordinates.applyOffset({
        x: adcPose.positionX,
        y: adcPose.positionY,
        z: 0,
      });
      if (curPos) {
        this.axesHelper.position.set(curPos.x, curPos.y, 0.3);
        this.axesHelper.rotation.set(0, 0, adcPose.heading || 0);
      }
    }

    // Update shadow (GNSS) localization trajectory
    const shadowPose = world.shadowLocalization;
    if (shadowPose && typeof shadowPose.positionX === 'number' && typeof shadowPose.positionY === 'number') {
      const nowMs = Date.now();
      if (nowMs - this.lastGnssUpdateMs >= MIN_SAMPLE_INTERVAL_MS) {
        const position = coordinates.applyOffset({
          x: shadowPose.positionX,
          y: shadowPose.positionY,
          z: 0,
        });
        if (position) {
          this.gnssBuffer.push({ x: position.x, y: position.y, z: 0.1 });
          this.lastGnssUpdateMs = nowMs;
        }
      }
    }

    // Rebuild geometry and toggle visibility
    if (show) {
      const lidarPoints = this.lidarBuffer.getOrdered();
      if (lidarPoints.length > 1) {
        updateTrailLine(this.lidarLine, lidarPoints);
        this.lidarLine.visible = true;
      } else {
        this.lidarLine.visible = false;
      }

      const gnssPoints = this.gnssBuffer.getOrdered();
      if (gnssPoints.length > 1) {
        updateTrailLine(this.gnssLine, gnssPoints);
        this.gnssLine.visible = true;
      } else {
        this.gnssLine.visible = false;
      }

      this.axesHelper.visible = true;
    } else {
      this.lidarLine.visible = false;
      this.gnssLine.visible = false;
      this.axesHelper.visible = false;
    }
  }
}
