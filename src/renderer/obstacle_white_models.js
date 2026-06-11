import * as THREE from 'three';

const WHITE_MODEL_COLOR = 0xF5F8FF;
const WHITE_MODEL_OUTLINE_COLOR = 0xD9E2F2;
const WINDOW_COLOR = 0xEAF6FF;
const SHADOW_COLOR = 0xC9D2E0;
const DARK_DETAIL_COLOR = 0x8792A2;

const DEFAULT_OPACITY = 0.82;
const WINDOW_OPACITY = 0.66;
const DETAIL_OPACITY = 0.72;
const OUTLINE_OPACITY = 0.9;

const TRUCK_LENGTH_THRESHOLD = 6.0;
const TRUCK_WIDTH_THRESHOLD = 2.3;
const TRUCK_HEIGHT_THRESHOLD = 2.6;

export const WHITE_MODEL_KIND = Object.freeze({
  VEHICLE: 'vehicle',
  TRUCK: 'truck',
  PEDESTRIAN: 'pedestrian',
  BICYCLE: 'bicycle',
  MOTORBIKE: 'motorbike',
});

function makeMaterial(color, opacity = DEFAULT_OPACITY) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
  });
}

function addOutline(object, geometry) {
  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({
      color: WHITE_MODEL_OUTLINE_COLOR,
      transparent: true,
      opacity: OUTLINE_OPACITY,
      depthTest: false,
      linewidth: 1,
    }),
  );
  object.add(outline);
}

function addBox(group, size, position, material, withOutline = true) {
  const geometry = new THREE.CubeGeometry(size.x, size.y, size.z);
  const box = new THREE.Mesh(geometry, material);
  box.position.set(position.x, position.y, position.z);
  if (withOutline) {
    addOutline(box, geometry);
  }
  group.add(box);
  return box;
}

function addSphere(group, radius, position, material) {
  const geometry = new THREE.SphereGeometry(radius, 16, 12);
  const sphere = new THREE.Mesh(geometry, material);
  sphere.position.set(position.x, position.y, position.z);
  addOutline(sphere, geometry);
  group.add(sphere);
  return sphere;
}

function addCylinder(group, radiusTop, radiusBottom, height, position, material, rotation = null) {
  const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 16);
  const cylinder = new THREE.Mesh(geometry, material);
  cylinder.position.set(position.x, position.y, position.z);
  if (rotation) {
    cylinder.rotation.set(rotation.x, rotation.y, rotation.z);
  }
  addOutline(cylinder, geometry);
  group.add(cylinder);
  return cylinder;
}

function addTorus(group, radius, tube, position, material, rotation = null) {
  const geometry = new THREE.TorusGeometry(radius, tube, 8, 24);
  const torus = new THREE.Mesh(geometry, material);
  torus.position.set(position.x, position.y, position.z);
  if (rotation) {
    torus.rotation.set(rotation.x, rotation.y, rotation.z);
  }
  group.add(torus);
  return torus;
}

function addTubeBetween(group, from, to, radius, material) {
  const start = new THREE.Vector3(from.x, from.y, from.z);
  const end = new THREE.Vector3(to.x, to.y, to.z);
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  if (length <= 0) {
    return null;
  }

  const geometry = new THREE.CylinderGeometry(radius, radius, length, 10);
  const tube = new THREE.Mesh(geometry, material);
  const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  const quaternion = new THREE.Quaternion();
  quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  tube.position.copy(mid);
  tube.quaternion.copy(quaternion);
  group.add(tube);
  return tube;
}

function createVehicleModel() {
  const group = new THREE.Group();
  const bodyMaterial = makeMaterial(WHITE_MODEL_COLOR);
  const windowMaterial = makeMaterial(WINDOW_COLOR, WINDOW_OPACITY);
  const detailMaterial = makeMaterial(SHADOW_COLOR, DETAIL_OPACITY);

  addBox(group, { x: 0.98, y: 0.88, z: 0.36 }, { x: 0, y: 0, z: -0.24 }, bodyMaterial);
  addBox(group, { x: 0.43, y: 0.66, z: 0.54 }, { x: -0.03, y: 0, z: 0.23 }, bodyMaterial);
  addBox(group, { x: 0.22, y: 0.58, z: 0.04 }, { x: 0.24, y: 0, z: 0.43 }, windowMaterial);
  addBox(group, { x: 0.18, y: 0.52, z: 0.04 }, { x: -0.25, y: 0, z: 0.43 }, windowMaterial);
  addBox(group, { x: 0.18, y: 0.08, z: 0.16 },
    { x: 0.04, y: 0.47, z: -0.42 }, detailMaterial, false);
  addBox(group, { x: 0.18, y: 0.08, z: 0.16 },
    { x: 0.04, y: -0.47, z: -0.42 }, detailMaterial, false);
  addBox(group, { x: 0.18, y: 0.08, z: 0.16 },
    { x: -0.30, y: 0.47, z: -0.42 }, detailMaterial, false);
  addBox(group, { x: 0.18, y: 0.08, z: 0.16 },
    { x: -0.30, y: -0.47, z: -0.42 }, detailMaterial, false);

  return group;
}

function createTruckModel() {
  const group = new THREE.Group();
  const bodyMaterial = makeMaterial(WHITE_MODEL_COLOR);
  const windowMaterial = makeMaterial(WINDOW_COLOR, WINDOW_OPACITY);
  const detailMaterial = makeMaterial(SHADOW_COLOR, DETAIL_OPACITY);

  addBox(group, { x: 0.64, y: 0.96, z: 0.90 }, { x: -0.13, y: 0, z: 0.03 }, bodyMaterial);
  addBox(group, { x: 0.30, y: 0.90, z: 0.58 }, { x: 0.35, y: 0, z: -0.08 }, bodyMaterial);
  addBox(group, { x: 0.20, y: 0.70, z: 0.05 }, { x: 0.47, y: 0, z: 0.20 }, windowMaterial);
  addBox(group, { x: 0.14, y: 0.09, z: 0.18 },
    { x: 0.20, y: 0.48, z: -0.41 }, detailMaterial, false);
  addBox(group, { x: 0.14, y: 0.09, z: 0.18 },
    { x: 0.20, y: -0.48, z: -0.41 }, detailMaterial, false);
  addBox(group, { x: 0.14, y: 0.09, z: 0.18 },
    { x: -0.22, y: 0.48, z: -0.41 }, detailMaterial, false);
  addBox(group, { x: 0.14, y: 0.09, z: 0.18 },
    { x: -0.22, y: -0.48, z: -0.41 }, detailMaterial, false);

  return group;
}

function createPedestrianModel() {
  const group = new THREE.Group();
  const bodyMaterial = makeMaterial(WHITE_MODEL_COLOR);
  const detailMaterial = makeMaterial(DARK_DETAIL_COLOR, DETAIL_OPACITY);

  addSphere(group, 0.14, { x: 0.0, y: 0.0, z: 0.36 }, bodyMaterial);
  addCylinder(
    group,
    0.11,
    0.14,
    0.42,
    { x: 0.0, y: 0.0, z: 0.02 },
    bodyMaterial,
    { x: Math.PI / 2, y: 0, z: 0 },
  );
  addTubeBetween(group, { x: -0.05, y: 0, z: -0.18 },
    { x: -0.13, y: 0, z: -0.43 }, 0.025, bodyMaterial);
  addTubeBetween(group, { x: 0.05, y: 0, z: -0.18 },
    { x: 0.13, y: 0, z: -0.43 }, 0.025, bodyMaterial);
  addTubeBetween(group, { x: -0.12, y: 0, z: 0.12 },
    { x: -0.23, y: 0, z: -0.08 }, 0.02, detailMaterial);
  addTubeBetween(group, { x: 0.12, y: 0, z: 0.12 },
    { x: 0.23, y: 0, z: -0.08 }, 0.02, detailMaterial);

  return group;
}

function createBicycleModel(isMotorbike = false) {
  const group = new THREE.Group();
  const bodyMaterial = makeMaterial(WHITE_MODEL_COLOR);
  const detailMaterial = makeMaterial(DARK_DETAIL_COLOR, DETAIL_OPACITY);
  const wheelMaterial = makeMaterial(SHADOW_COLOR, DETAIL_OPACITY);
  const wheelRotation = { x: Math.PI / 2, y: 0, z: 0 };
  const rearWheel = { x: -0.34, y: 0, z: -0.30 };
  const frontWheel = { x: 0.34, y: 0, z: -0.30 };
  const crank = { x: -0.03, y: 0, z: -0.17 };
  const seat = { x: -0.15, y: 0, z: 0.10 };
  const handle = { x: 0.26, y: 0, z: 0.08 };

  addTorus(group, 0.18, 0.02, rearWheel, wheelMaterial, wheelRotation);
  addTorus(group, 0.18, 0.02, frontWheel, wheelMaterial, wheelRotation);
  addTubeBetween(group, rearWheel, crank, 0.018, bodyMaterial);
  addTubeBetween(group, frontWheel, crank, 0.018, bodyMaterial);
  addTubeBetween(group, rearWheel, seat, 0.018, bodyMaterial);
  addTubeBetween(group, seat, handle, 0.018, bodyMaterial);
  addTubeBetween(group, handle, frontWheel, 0.018, bodyMaterial);
  addBox(group, { x: 0.20, y: 0.10, z: 0.035 }, { x: -0.17, y: 0, z: 0.12 }, detailMaterial, false);
  addBox(group, { x: 0.10, y: 0.70, z: 0.035 }, { x: 0.32, y: 0, z: 0.12 }, detailMaterial, false);
  addSphere(group, 0.08, { x: -0.08, y: 0, z: 0.42 }, bodyMaterial);
  addTubeBetween(group, { x: -0.10, y: 0, z: 0.34 },
    { x: -0.14, y: 0, z: 0.13 }, 0.045, bodyMaterial);
  addTubeBetween(group, { x: -0.12, y: 0, z: 0.25 },
    { x: 0.20, y: 0, z: 0.10 }, 0.018, detailMaterial);

  if (isMotorbike) {
    addBox(group, { x: 0.48, y: 0.22, z: 0.16 }, { x: -0.02, y: 0, z: -0.05 }, bodyMaterial);
    addBox(group, { x: 0.18, y: 0.18, z: 0.12 }, { x: 0.17, y: 0, z: 0.08 }, bodyMaterial);
  }

  return group;
}

export function getWhiteObstacleModelKind(obstacle) {
  if (!obstacle) {
    return null;
  }

  const length = obstacle.length || 0;
  const width = obstacle.width || 0;
  const height = obstacle.height || 0;
  const isLargeVehicle = length >= TRUCK_LENGTH_THRESHOLD
    || width >= TRUCK_WIDTH_THRESHOLD
    || height >= TRUCK_HEIGHT_THRESHOLD;

  if (obstacle.type === 'VEHICLE' || obstacle.type === 'CIPV') {
    if (isLargeVehicle || obstacle.subType === 'ST_TRUCK'
      || obstacle.subType === 'ST_BUS' || obstacle.subType === 'ST_VAN') {
      return WHITE_MODEL_KIND.TRUCK;
    }
    return WHITE_MODEL_KIND.VEHICLE;
  }

  if (obstacle.type === 'PEDESTRIAN') {
    return WHITE_MODEL_KIND.PEDESTRIAN;
  }

  if (obstacle.type === 'BICYCLE') {
    if (obstacle.subType === 'ST_MOTORCYCLIST' || obstacle.subType === 'ST_TRICYCLIST') {
      return WHITE_MODEL_KIND.MOTORBIKE;
    }
    return WHITE_MODEL_KIND.BICYCLE;
  }

  return null;
}

export function hasValidWhiteModelDimension(obstacle) {
  return obstacle && obstacle.length > 0 && obstacle.width > 0 && obstacle.height > 0;
}

export function createWhiteObstacleModel(kind) {
  let model = null;
  switch (kind) {
    case WHITE_MODEL_KIND.TRUCK:
      model = createTruckModel();
      break;
    case WHITE_MODEL_KIND.PEDESTRIAN:
      model = createPedestrianModel();
      break;
    case WHITE_MODEL_KIND.BICYCLE:
      model = createBicycleModel(false);
      break;
    case WHITE_MODEL_KIND.MOTORBIKE:
      model = createBicycleModel(true);
      break;
    case WHITE_MODEL_KIND.VEHICLE:
    default:
      model = createVehicleModel();
      break;
  }

  model.userData.whiteModelKind = kind;
  model.visible = false;
  return model;
}

export function disposeWhiteObstacleModel(model) {
  if (!model) {
    return;
  }

  model.traverse((child) => {
    if (child.geometry) {
      child.geometry.dispose();
    }
    if (child.material) {
      child.material.dispose();
    }
  });
}
