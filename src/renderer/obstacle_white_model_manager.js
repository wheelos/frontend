import * as THREE from 'three';

import { loadObject } from 'utils/models';

import whiteCarModel from 'assets/models/car.obj';
import whiteTruckModel from 'assets/models/obstacle_white/truck.obj';
import whitePedestrianModel from 'assets/models/obstacle_white/pedestrian.obj';
import whiteBicycleModel from 'assets/models/obstacle_white/bicycle.obj';
import whiteMotorcycleModel from 'assets/models/obstacle_white/motorcycle.obj';

const WHITE_BODY_MATERIAL = new THREE.MeshPhongMaterial({
  color: 0xF2F7FF,
  emissive: 0x101820,
  specular: 0xFFFFFF,
  shininess: 28,
  transparent: true,
  opacity: 0.82,
  side: THREE.DoubleSide,
});

const WHITE_DETAIL_MATERIAL = new THREE.MeshPhongMaterial({
  color: 0xD8E2EF,
  emissive: 0x080C12,
  specular: 0xFFFFFF,
  shininess: 18,
  transparent: true,
  opacity: 0.70,
  side: THREE.DoubleSide,
});

const MODEL_TYPE = Object.freeze({
  CAR: 'car',
  TRUCK: 'truck',
  PEDESTRIAN: 'pedestrian',
  BICYCLE: 'bicycle',
  MOTORCYCLE: 'motorcycle',
});

const MODEL_CONFIG = Object.freeze({
  [MODEL_TYPE.CAR]: {
    obj: whiteCarModel,
    // Apollo's bundled car.obj is y-up. Rotate once into Dreamview's z-up world.
    rotation: { x: Math.PI / 2, y: 0, z: 0 },
  },
  [MODEL_TYPE.TRUCK]: { obj: whiteTruckModel },
  [MODEL_TYPE.PEDESTRIAN]: { obj: whitePedestrianModel },
  [MODEL_TYPE.BICYCLE]: { obj: whiteBicycleModel },
  [MODEL_TYPE.MOTORCYCLE]: { obj: whiteMotorcycleModel },
});

const LARGE_VEHICLE_SUBTYPES = new Set(['ST_TRUCK', 'ST_BUS', 'ST_VAN']);
const MOTOR_BIKE_SUBTYPES = new Set(['ST_MOTORCYCLIST', 'ST_TRICYCLIST']);

const MIN_RENDER_SIZE = 0.05;
const TRUCK_LENGTH_THRESHOLD = 6.0;
const TRUCK_WIDTH_THRESHOLD = 2.3;
const TRUCK_HEIGHT_THRESHOLD = 2.6;

function validSize(obstacle) {
  return obstacle && obstacle.length > MIN_RENDER_SIZE
    && obstacle.width > MIN_RENDER_SIZE
    && obstacle.height > MIN_RENDER_SIZE;
}

function normalizeLoadedObject(object, rotation) {
  if (rotation) {
    object.rotation.set(rotation.x || 0, rotation.y || 0, rotation.z || 0);
  }

  object.traverse((child) => {
    if (!child || !(child instanceof THREE.Mesh)) {
      return;
    }

    const materialName = child.material && child.material.name
      ? child.material.name.toLowerCase() : '';
    if (materialName.indexOf('glass') !== -1
      || materialName.indexOf('tire') !== -1
      || materialName.indexOf('wheel') !== -1
      || materialName.indexOf('black') !== -1) {
      child.material = WHITE_DETAIL_MATERIAL;
    } else {
      child.material = WHITE_BODY_MATERIAL;
    }
  });

  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  // Make every asset center-origin and z-up. The runtime Object3D can then be
  // non-uniformly scaled to perception length / width / height directly.
  object.position.sub(center);
  object.updateMatrixWorld(true);

  return size;
}

function cloneLoadedTemplate(template) {
  const clone = template.clone(true);
  clone.traverse((child) => {
    if (!child || !(child instanceof THREE.Mesh)) {
      return;
    }
    child.material = child.material;
    child.geometry = child.geometry;
  });
  return clone;
}

function chooseModelType(obstacle) {
  if (!validSize(obstacle)) {
    return null;
  }

  if (obstacle.type === 'PEDESTRIAN' || obstacle.subType === 'ST_PEDESTRIAN') {
    return MODEL_TYPE.PEDESTRIAN;
  }

  if (obstacle.type === 'BICYCLE' || obstacle.subType === 'ST_CYCLIST'
    || MOTOR_BIKE_SUBTYPES.has(obstacle.subType)) {
    return MOTOR_BIKE_SUBTYPES.has(obstacle.subType)
      ? MODEL_TYPE.MOTORCYCLE : MODEL_TYPE.BICYCLE;
  }

  if (obstacle.type === 'VEHICLE') {
    if (LARGE_VEHICLE_SUBTYPES.has(obstacle.subType)
      || obstacle.length >= TRUCK_LENGTH_THRESHOLD
      || obstacle.width >= TRUCK_WIDTH_THRESHOLD
      || obstacle.height >= TRUCK_HEIGHT_THRESHOLD) {
      return MODEL_TYPE.TRUCK;
    }
    return MODEL_TYPE.CAR;
  }

  return null;
}

export default class WhiteObstacleModelManager {
  constructor() {
    this.pools = {};
    this.indices = {};
    this.templates = {};
    this.templateSizes = {};
    this.templateLoading = {};
    this.templatePromises = {};
    this.pendingSlots = {};
    this.ready = false;
    Object.keys(MODEL_CONFIG).forEach((modelType) => {
      this.pools[modelType] = [];
      this.indices[modelType] = 0;
      this.templates[modelType] = null;
      this.templateSizes[modelType] = null;
      this.templateLoading[modelType] = false;
      this.templatePromises[modelType] = null;
      this.pendingSlots[modelType] = [];
    });

    this.preloadAll();
  }

  preloadAll() {
    if (this.ready) {
      return Promise.resolve();
    }

    if (this.preloadPromise) {
      return this.preloadPromise;
    }

    this.preloadPromise = Promise.all(
      Object.keys(MODEL_CONFIG).map((modelType) => this.ensureTemplateLoaded(modelType)),
    ).then(() => {
      this.ready = true;
    });

    return this.preloadPromise;
  }

  isReady() {
    return this.ready;
  }

  reset() {
    Object.keys(this.indices).forEach((modelType) => {
      this.indices[modelType] = 0;
    });
  }

  hideUnused() {
    Object.keys(this.pools).forEach((modelType) => {
      const pool = this.pools[modelType];
      for (let i = this.indices[modelType]; i < pool.length; i++) {
        pool[i].visible = false;
      }
    });
  }

  isSupported(obstacle) {
    return chooseModelType(obstacle) !== null;
  }

  update(obstacle, position, heading, scene) {
    const modelType = chooseModelType(obstacle);
    if (!modelType) {
      return false;
    }

    const index = this.indices[modelType];
    this.indices[modelType]++;

    const slot = this.getSlot(modelType, index, scene);

    slot.position.set(position.x, position.y, position.z);
    slot.rotation.set(0, 0, heading || 0);

    if (!slot.userData.loaded || !slot.userData.baseSize) {
      slot.visible = false;
      return true;
    }

    const baseSize = slot.userData.baseSize;
    slot.scale.set(
      obstacle.length / baseSize.x,
      obstacle.width / baseSize.y,
      obstacle.height / baseSize.z,
    );
    slot.visible = true;
    return true;
  }

  getSlot(modelType, index, scene) {
    const pool = this.pools[modelType];
    if (index < pool.length) {
      return pool[index];
    }

    const slot = new THREE.Object3D();
    slot.visible = false;
    slot.userData.loaded = false;
    slot.userData.baseSize = null;
    pool.push(slot);
    scene.add(slot);

    if (this.templates[modelType] && this.templateSizes[modelType]) {
      this.attachTemplateToSlot(modelType, slot);
    } else {
      this.pendingSlots[modelType].push(slot);
      this.ensureTemplateLoaded(modelType);
    }

    return slot;
  }

  ensureTemplateLoaded(modelType) {
    if (this.templates[modelType] && this.templateSizes[modelType]) {
      return Promise.resolve(this.templates[modelType]);
    }

    if (this.templatePromises[modelType]) {
      return this.templatePromises[modelType];
    }

    this.templateLoading[modelType] = true;
    const config = MODEL_CONFIG[modelType];
    this.templatePromises[modelType] = new Promise((resolve) => {
      loadObject(null, config.obj, { x: 1, y: 1, z: 1 }, (object) => {
        const baseSize = normalizeLoadedObject(object, config.rotation);
        this.templates[modelType] = object;
        this.templateSizes[modelType] = baseSize;
        this.templateLoading[modelType] = false;

        this.pendingSlots[modelType].forEach((slot) => {
          this.attachTemplateToSlot(modelType, slot);
        });
        this.pendingSlots[modelType] = [];

        resolve(object);
      });
    });

    return this.templatePromises[modelType];
  }

  attachTemplateToSlot(modelType, slot) {
    if (!this.templates[modelType] || !this.templateSizes[modelType]) {
      return;
    }

    while (slot.children.length > 0) {
      slot.remove(slot.children[0]);
    }

    slot.add(cloneLoadedTemplate(this.templates[modelType]));
    slot.userData.baseSize = this.templateSizes[modelType];
    slot.userData.loaded = true;
  }
}
