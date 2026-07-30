import * as THREE from 'three';
import STORE from 'store';
import _ from 'lodash';

import carMaterial from 'assets/models/car.mtl';
import carObject from 'assets/models/car.obj';
import iconRssUnsafe from 'assets/images/icons/rss-unsafe.png';
import { loadObject } from 'utils/models';
import { drawEllipse, drawImage } from 'utils/draw';

const CAR_PROPERTIES = {
  adc: {
    menuOptionName: 'showPositionLocalization',
    carMaterial,
  },
  planningAdc: {
    menuOptionName: 'showPlanningCar',
    carMaterial: null,
  },
  shadowAdc: {
    menuOptionName: 'showPositionShadow',
    carMaterial: null,
  },
};

const RSS_UNSAFE_MESH = drawImage(iconRssUnsafe, 1.5, 1.5);
const RSS_UNSAFE_MARKER_OFFSET = {
  x: 1,
  y: 1,
  z: 2.6,
};

const ADC_MATERIAL_STYLES = {
  body_color: {
    color: 0xC4D2DD,
    specular: 0xA6D5FA,
    shininess: 88,
  },
  glass3: {
    color: 0x142A3A,
    specular: 0x6E9DBD,
    shininess: 96,
    opacity: 0.74,
  },
  Black_Plastic: {
    color: 0x111820,
    specular: 0x3D4A54,
    shininess: 42,
  },
  tire: {
    color: 0x11151A,
    specular: 0x252C32,
    shininess: 18,
  },
  tirehouse: {
    color: 0x0D1318,
    specular: 0x202A31,
    shininess: 22,
  },
  metal: {
    color: 0x7F8C96,
    specular: 0xDDE8EF,
    shininess: 72,
  },
  metal2: {
    color: 0xAAB5BD,
    specular: 0xF3F8FA,
    shininess: 82,
  },
  plt3: {
    color: 0xFF3B30,
    emissive: 0x5C0906,
    shininess: 54,
    opacity: 0.92,
  },
  plt4: {
    color: 0xFFE1A3,
    emissive: 0x5B4310,
    shininess: 62,
    opacity: 0.94,
  },
};

function styleAdcMaterial(material) {
  const styledMaterial = material.clone();
  const style = ADC_MATERIAL_STYLES[styledMaterial.name];
  if (!style) {
    return styledMaterial;
  }

  if (style.color && styledMaterial.color) {
    styledMaterial.color.setHex(style.color);
  }
  if (style.specular && styledMaterial.specular) {
    styledMaterial.specular.setHex(style.specular);
  }
  if (style.emissive && styledMaterial.emissive) {
    styledMaterial.emissive.setHex(style.emissive);
  }
  if (style.shininess !== undefined) {
    styledMaterial.shininess = style.shininess;
  }
  if (style.opacity !== undefined) {
    styledMaterial.opacity = style.opacity;
    styledMaterial.transparent = style.opacity < 1;
    styledMaterial.depthWrite = style.opacity >= 1;
  }
  styledMaterial.needsUpdate = true;
  return styledMaterial;
}

function styleAdcMesh(object) {
  object.traverse((child) => {
    if (!child.material) {
      return;
    }
    const mesh = child;
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(styleAdcMaterial)
      : styleAdcMaterial(mesh.material);
  });
}

function createContactShadow(scene) {
  const material = new THREE.MeshBasicMaterial({
    color: 0x02070B,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const shadow = drawEllipse(2.55, 1.12, material);
  shadow.position.z = 0.025;
  shadow.renderOrder = 2;
  shadow.visible = false;
  scene.add(shadow);
  return shadow;
}

export default class AutoDrivingCar {
  constructor(name, scene) {
    this.mesh = null;
    this.name = name;
    this.desiredScale = null;
    this.rssUnsafeMarker = RSS_UNSAFE_MESH;
    this.rssUnsafeMarker.visible = false;
    scene.add(this.rssUnsafeMarker);
    this.contactShadow = name === 'adc' ? createContactShadow(scene) : null;

    const properties = CAR_PROPERTIES[name];
    if (!properties) {
      console.error('Car properties not found for car:', name);
      return;
    }

    // NOTE: loadObject takes some time to update this.mesh.
    // This call is asynchronous.
    loadObject(properties.carMaterial, carObject, { x: 1, y: 1, z: 1 }, (object) => {
      this.mesh = object;
      if (this.name === 'adc') {
        styleAdcMesh(this.mesh);
      }
      this.mesh.rotation.x = Math.PI / 2;
      this.mesh.visible = false;
      scene.add(this.mesh);
      // Apply stored scale that may have been set before mesh loaded.
      if (this.desiredScale) {
        this.mesh.scale.set(this.desiredScale.x, this.desiredScale.y, this.desiredScale.z);
      }
    });
  }

  update(coordinates, pose) {
    if (!this.mesh || !pose || !_.isNumber(pose.positionX) || !_.isNumber(pose.positionY)) {
      return;
    }

    const optionName = CAR_PROPERTIES[this.name].menuOptionName;
    this.mesh.visible = STORE.options[optionName];
    const position = coordinates.applyOffset({ x: pose.positionX, y: pose.positionY });
    if (position === null) {
      return;
    }

    this.mesh.position.set(position.x, position.y, 0);
    this.mesh.rotation.y = pose.heading;
    if (this.contactShadow) {
      this.contactShadow.position.set(position.x, position.y, 0.025);
      this.contactShadow.rotation.z = pose.heading;
      this.contactShadow.visible = this.mesh.visible;
    }
  }

  updateRssMarker(isRssSafe) {
    this.rssUnsafeMarker.visible = false;
    if (isRssSafe === false && STORE.options.showPlanningRSSInfo) {
      this.rssUnsafeMarker.position.set(this.mesh.position.x + RSS_UNSAFE_MARKER_OFFSET.x,
        this.mesh.position.y + RSS_UNSAFE_MARKER_OFFSET.y,
        this.mesh.position.z + RSS_UNSAFE_MARKER_OFFSET.z);
      this.rssUnsafeMarker.rotation.set(Math.PI / 2, this.mesh.rotation.y - Math.PI / 2, 0);
      this.rssUnsafeMarker.visible = true;
    }
  }

  resizeCarScale(x, y, z) {
    this.desiredScale = { x, y, z };
    if (!this.mesh) {
      return;
    }
    this.mesh.scale.set(x, y, z);
  }
}
