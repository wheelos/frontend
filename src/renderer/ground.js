import * as THREE from 'three';

import STORE from 'store';

const GROUND_COLORS = {
  dark: 0x020810,
  light: 0xF2F5F7,
};

export default class Ground {
  constructor() {
    this.type = 'default';
    this.mapName = null;
    this.mesh = null;
    this.geometry = null;
    this.initialized = false;
    this.themeMode = 'dark';

    this.geometry = new THREE.PlaneGeometry(1, 1);
    this.mesh = new THREE.Mesh(
      this.geometry,
      new THREE.MeshBasicMaterial({
        color: this.getGroundColor(),
        depthWrite: false,
      }),
    );
    this.mesh.type = 'solid';
    this.mesh.renderOrder = -20;
    this.applyMaterialStyle();
  }

  applyMaterialStyle() {
    if (!this.mesh || !this.mesh.material) {
      return;
    }

    this.mesh.material.map = null;
    this.mesh.material.color.setHex(this.getGroundColor());
    this.mesh.material.opacity = 1;
    this.mesh.material.transparent = false;
    // Ground is a backdrop. It must not occlude near-coplanar map surfaces.
    this.mesh.material.depthWrite = false;
    this.mesh.material.needsUpdate = true;
  }

  getGroundColor() {
    return GROUND_COLORS[this.themeMode] || GROUND_COLORS.dark;
  }

  updateTheme(themeMode) {
    this.themeMode = themeMode === 'light' ? 'light' : 'dark';
    this.applyMaterialStyle();
  }

  initialize(coordinates) {
    if (!this.mesh) {
      return false;
    }

    if (!this.render(coordinates)) {
      return false;
    }

    this.initialized = true;
    return true;
  }

  update(world, coordinates, scene) {
    if (this.initialized !== true) {
      return;
    }

    // Hide the rendered ground while the camera feed is active.
    const showCameraView = STORE.options.showCameraView;

    if (showCameraView) {
      scene.background = null;
      this.mesh.visible = false;
      return;
    }

    this.mesh.visible = true;
    const adc = world.autoDrivingCar;
    const position = coordinates.applyOffset({ x: adc.positionX, y: adc.positionY });
    this.mesh.position.set(position.x, position.y, 0);
  }

  updateImage(mapName) {
    this.mapName = mapName;
  }

  render(coordinates, mapName = 'defaults') {
    console.log('rendering solid ground...');
    const {
      xres, yres, mpp, xorigin, yorigin,
    } = PARAMETERS.ground[mapName];

    let position = coordinates.applyOffset({ x: xorigin, y: yorigin });
    if (position === null) {
      console.warn('Cannot find position for ground mesh!');
      return false;
    }
    // Center the default ground plane on the initial coordinate offset.
    if (mapName === 'defaults') {
      position = { x: 0, y: 0 };
    }

    this.mesh.position.set(position.x, position.y, 0);
    this.mesh.scale.set(xres * mpp, yres * mpp, 1);
    this.mesh.material.needsUpdate = true;
    this.mesh.overdraw = false;

    return true;
  }
}
