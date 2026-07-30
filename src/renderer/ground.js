import * as THREE from 'three';

import { loadTexture } from 'utils/models';
import gridGround from 'assets/images/ground.png';
import STORE from 'store';

const LIGHT_GRID_TEXTURE_SIZE = 256;
const LIGHT_GRID_REPEAT = 32;

function createLightGridTexture() {
  const data = new Uint8Array(
    LIGHT_GRID_TEXTURE_SIZE * LIGHT_GRID_TEXTURE_SIZE * 3,
  );
  const base = [244, 247, 249];
  const minor = [231, 236, 241];
  const major = [210, 219, 227];

  for (let y = 0; y < LIGHT_GRID_TEXTURE_SIZE; y += 1) {
    for (let x = 0; x < LIGHT_GRID_TEXTURE_SIZE; x += 1) {
      const isMajor = x % 64 === 0 || y % 64 === 0;
      const isMinor = x % 16 === 0 || y % 16 === 0;
      let color = base;
      if (isMajor) {
        color = major;
      } else if (isMinor) {
        color = minor;
      }
      const [red, green, blue] = color;
      const index = (y * LIGHT_GRID_TEXTURE_SIZE + x) * 3;
      data[index] = red;
      data[index + 1] = green;
      data[index + 2] = blue;
    }
  }

  const texture = new THREE.DataTexture(
    data,
    LIGHT_GRID_TEXTURE_SIZE,
    LIGHT_GRID_TEXTURE_SIZE,
    THREE.RGBFormat,
  );
  texture.name = 'LightGroundGridTexture';
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(LIGHT_GRID_REPEAT, LIGHT_GRID_REPEAT);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipMapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

export default class Ground {
  constructor() {
    this.type = 'default';
    this.loadedMap = null;
    this.updateMap = null;
    this.mesh = null;
    this.geometry = null;
    this.initialized = false;
    this.inNaviMode = null;
    this.showCameraView = false;
    this.themeMode = 'dark';
    this.darkGridTexture = null;
    this.lightGridTexture = createLightGridTexture();

    loadTexture(gridGround, (texture) => {
      this.darkGridTexture = texture;
      this.geometry = new THREE.PlaneGeometry(1, 1);
      this.mesh = new THREE.Mesh(
        this.geometry,
        new THREE.MeshBasicMaterial({ map: this.getGridTexture() }),
      );
      this.mesh.type = 'grid';
      this.mesh.renderOrder = -20;
      this.applyMaterialStyle();
    });
  }

  applyMaterialStyle() {
    if (!this.mesh || !this.mesh.material) {
      return;
    }

    const isGrid = this.mesh.type === 'grid';
    const isLight = this.themeMode === 'light';
    if (isGrid) {
      this.mesh.material.map = this.getGridTexture();
      this.mesh.material.color.setHex(isLight ? 0xFFFFFF : 0x3A4B58);
      this.mesh.material.opacity = isLight ? 1 : 0.38;
      this.mesh.material.transparent = !isLight;
      this.mesh.material.depthWrite = isLight;
    } else {
      this.mesh.material.color.setHex(0xFFFFFF);
      this.mesh.material.opacity = isLight ? 0.14 : 1;
      this.mesh.material.transparent = isLight;
      this.mesh.material.depthWrite = !isLight;
    }
    this.mesh.material.needsUpdate = true;
  }

  getGridTexture() {
    return this.themeMode === 'light'
      ? this.lightGridTexture
      : this.darkGridTexture;
  }

  updateTheme(themeMode) {
    this.themeMode = themeMode === 'light' ? 'light' : 'dark';
    this.applyMaterialStyle();
  }

  initialize(coordinates) {
    if (!this.mesh) {
      return false;
    }

    if (this.loadedMap === this.updateMap && !this.render(coordinates)) {
      return false;
    }

    this.initialized = true;
    return true;
  }

  loadGrid(coordinates) {
    loadTexture(gridGround, (texture) => {
      console.log('using grid as ground image...');
      this.darkGridTexture = texture;
      this.mesh.material.map = this.getGridTexture();
      this.mesh.type = 'grid';
      this.mesh.visible = true;
      this.applyMaterialStyle();
      this.render(coordinates);
    });
  }

  update(world, coordinates, scene) {
    if (this.initialized !== true) {
      return;
    }

    // Remove ground image when camera view is on
    const showCameraView = STORE.options.showCameraView;
    const cameraAngleChanged = (showCameraView !== this.showCameraView);
    this.showCameraView = showCameraView;

    const modeChanged = this.inNaviMode !== STORE.hmi.inNavigationMode;
    this.inNaviMode = STORE.hmi.inNavigationMode;
    if (this.inNaviMode) {
      this.mesh.type = 'grid';
      if (modeChanged) {
        this.loadGrid(coordinates);
      }
    } else {
      this.mesh.type = 'reflection';
    }

    if (this.mesh.type === 'grid') {
      const adc = world.autoDrivingCar;
      const position = coordinates.applyOffset({ x: adc.positionX, y: adc.positionY });
      this.mesh.position.set(position.x, position.y, 0);
    } else if (this.loadedMap !== this.updateMap || modeChanged || cameraAngleChanged) {
      if (showCameraView) {
        scene.background = null;
        this.mesh.visible = false;
        return;
      }
      // Only reload reflection map upon map/mode/camera(cameraView->non-CameraView) change.
      const dir = this.titleCaseToSnakeCase(this.updateMap);
      const host = window.location;
      const port = PARAMETERS.server.port;
      const server = `${host.protocol}//${host.hostname}:${port}`;
      const imgUrl = `${server}/assets/map_data/${dir}/background.jpg`;
      loadTexture(imgUrl, (texture) => {
        console.log(`updating ground image with ${dir}`);
        this.mesh.material.map = texture;
        this.mesh.type = 'reflection';
        this.mesh.visible = true;
        this.applyMaterialStyle();
        this.render(coordinates, dir);
      }, (err) => {
        this.loadGrid(coordinates);
      });
      this.loadedMap = this.updateMap;
      scene.background = new THREE.Color(
        this.themeMode === 'light' ? 0xF2F5F7 : 0x000C17,
      );
    }
  }

  updateImage(mapName) {
    this.updateMap = mapName;
  }

  render(coordinates, mapName = 'defaults') {
    console.log('rendering ground image...');
    const {
      xres, yres, mpp, xorigin, yorigin,
    } = PARAMETERS.ground[mapName];

    let position = coordinates.applyOffset({ x: xorigin, y: yorigin });
    if (position === null) {
      console.warn('Cannot find position for ground mesh!');
      return false;
    }
    // NOTE: Setting the position to (0, 0) makes the center of
    // the ground image to overlap with the offset point, which
    // is the car position on the first received frame.
    if (mapName === 'defaults') {
      position = { x: 0, y: 0 };
    }

    this.mesh.position.set(position.x, position.y, 0);
    this.mesh.scale.set(xres * mpp, yres * mpp, 1);
    this.mesh.material.needsUpdate = true;
    this.mesh.overdraw = false;

    return true;
  }

  titleCaseToSnakeCase(str) {
    return str.replace(/\s/g, '_').toLowerCase();
  }
}
