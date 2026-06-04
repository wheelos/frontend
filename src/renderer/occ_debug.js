import * as THREE from 'three';
import _ from 'lodash';

import STORE from 'store';

const OCC_DEBUG_COLORS = [
  0x00B4FF,
  0x0078FF,
  0x003CFF,
  0x0050DC,
  0x5050C8,
  0xB4B4B4,
  0xFFC832,
  0xFFFF78,
  0x50DC50,
  0xFF8C00,
  0xC8C8C8,
  0x7896B4,
  0x6478A0,
  0xB450B4,
  0xB45078,
  0xB45050,
];

const DEFAULT_OCC_DEBUG_COLOR = 0xFFFFFF;
const OCC_DEBUG_Z_OFFSET = 0.18;
const OCC_DEBUG_OPACITY = 0.45;

function mapApolloVehiclePointToScene(localX, localY) {
  return {
    x: localY,
    y: -localX,
  };
}

export default class OccDebugOverlay {
  constructor() {
    this.group = new THREE.Group();
    this.group.visible = false;
    this.group.matrixAutoUpdate = true;

    this.mesh = null;
    this.signature = null;
  }

  update(world, coordinates, scene) {
    if (this.group.parent !== scene) {
      scene.add(this.group);
    }

    const adcPose = _.get(world, 'autoDrivingCar');
    const occDebug = _.get(world, 'bevOccDebug');
    const isEnabled = STORE.options.showOccDebug;

    if (!isEnabled || !this.isOccDebugAvailable(occDebug) || !adcPose) {
      this.group.visible = false;
      return;
    }

    if (!this.updatePose(adcPose, coordinates)) {
      this.group.visible = false;
      return;
    }
    this.ensureMesh(occDebug);
    this.group.visible = (this.mesh !== null);
  }

  isOccDebugAvailable(occDebug) {
    return occDebug
      && occDebug.width > 0
      && occDebug.height > 0
      && occDebug.resolution > 0
      && _.isArray(occDebug.encodedTopdownCell)
      && occDebug.encodedTopdownCell.length > 0;
  }

  updatePose(adcPose, coordinates) {
    if (!_.isNumber(adcPose.positionX) || !_.isNumber(adcPose.positionY)) {
      return false;
    }

    const position = coordinates.applyOffset({
      x: adcPose.positionX,
      y: adcPose.positionY,
    });
    if (!position) {
      return false;
    }

    this.group.position.set(position.x, position.y, 0);
    this.group.rotation.set(0, 0, adcPose.heading || 0);
    return true;
  }

  ensureMesh(occDebug) {
    const signature = [
      occDebug.measurementTime,
      occDebug.width,
      occDebug.height,
      occDebug.resolution,
      occDebug.xMin,
      occDebug.xMax,
      occDebug.yMin,
      occDebug.yMax,
      occDebug.encodedTopdownCell.length,
    ].join(':');

    if (signature === this.signature && this.mesh) {
      return;
    }

    this.disposeMesh();

    const geometry = this.buildGeometry(occDebug);
    if (!geometry) {
      this.signature = null;
      return;
    }

    const material = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
      transparent: true,
      opacity: OCC_DEBUG_OPACITY,
      depthWrite: false,
      vertexColors: THREE.VertexColors,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 15;
    this.group.add(this.mesh);
    this.signature = signature;
  }

  disposeMesh() {
    if (!this.mesh) {
      return;
    }

    this.group.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh = null;
  }

  buildGeometry(occDebug) {
    const positions = [];
    const colors = [];
    const resolution = occDebug.resolution;

    occDebug.encodedTopdownCell.forEach((encodedCell) => {
      const packedCell = encodedCell >>> 0;
      const xIndex = packedCell & 0xFFF;
      const yIndex = (packedCell >>> 12) & 0xFFF;
      const classId = (packedCell >>> 24) & 0xFF;

      const x0 = occDebug.xMin + xIndex * resolution;
      const y0 = occDebug.yMin + yIndex * resolution;
      const x1 = x0 + resolution;
      const y1 = y0 + resolution;
      const p00 = mapApolloVehiclePointToScene(x0, y0);
      const p10 = mapApolloVehiclePointToScene(x1, y0);
      const p11 = mapApolloVehiclePointToScene(x1, y1);
      const p01 = mapApolloVehiclePointToScene(x0, y1);

      const color = new THREE.Color(
        OCC_DEBUG_COLORS[classId] || DEFAULT_OCC_DEBUG_COLOR,
      );

      positions.push(
        p00.x, p00.y, OCC_DEBUG_Z_OFFSET,
        p10.x, p10.y, OCC_DEBUG_Z_OFFSET,
        p11.x, p11.y, OCC_DEBUG_Z_OFFSET,
        p00.x, p00.y, OCC_DEBUG_Z_OFFSET,
        p11.x, p11.y, OCC_DEBUG_Z_OFFSET,
        p01.x, p01.y, OCC_DEBUG_Z_OFFSET,
      );

      for (let i = 0; i < 6; i += 1) {
        colors.push(color.r, color.g, color.b);
      }
    });

    if (positions.length === 0) {
      return null;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.addAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(positions), 3),
    );
    geometry.addAttribute(
      'color',
      new THREE.BufferAttribute(new Float32Array(colors), 3),
    );
    geometry.computeBoundingSphere();
    return geometry;
  }
}
