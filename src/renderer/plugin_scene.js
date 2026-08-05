import * as THREE from 'three';

import PerceptionObstacles from 'renderer/obstacles';
import {
  drawArrow,
  drawBox,
  drawDashedLineFromPoints,
  drawSegmentsFromPoints,
  disposeMeshGroup,
} from 'utils/draw';

function colorValue(value, fallback = 0x2F8CFF) {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    return new THREE.Color(value).getHex();
  }
  return fallback;
}

function setOpacity(object, opacity) {
  if (!Number.isFinite(opacity)) {
    return;
  }
  object.traverse((child) => {
    if (!child.material) {
      return;
    }
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      material.transparent = opacity < 1;
      material.opacity = opacity;
      material.needsUpdate = true;
    });
  });
}

export default class PluginSceneRenderer {
  constructor(owner) {
    this.owner = owner;
    this.layers = new Map();
  }

  createLayer(id, options = {}) {
    if (this.layers.has(id)) {
      return { id };
    }
    const group = new THREE.Group();
    group.name = `plugin-layer:${id}`;
    group.renderOrder = Number(options.zIndex || 0);
    group.visible = options.defaultVisible !== false;
    this.owner.scene.add(group);
    this.layers.set(id, {
      id,
      options,
      group,
      entities: new Map(),
      obstacleRenderer: null,
      obstacleBatch: null,
    });
    return { id };
  }

  removeLayer(id) {
    const layer = this.layers.get(id);
    if (!layer) {
      return;
    }
    this.clearGroup(layer);
    if (layer.obstacleRenderer) {
      layer.obstacleRenderer.dispose(this.owner.scene);
    }
    this.owner.scene.remove(layer.group);
    this.layers.delete(id);
  }

  removeLayers(prefix) {
    Array.from(this.layers.keys())
      .filter((id) => id.indexOf(prefix) === 0)
      .forEach((id) => this.removeLayer(id));
  }

  upsertEntities(layerId, entities) {
    const layer = this.layers.get(layerId);
    if (!layer) {
      throw new Error(`Plugin scene layer does not exist: ${layerId}`);
    }
    (entities || []).forEach((entity) => {
      if (!entity || !entity.id) {
        throw new Error(`Every scene entity in ${layerId} must declare an id`);
      }
      layer.entities.set(entity.id, entity);
    });
    this.redrawLayer(layer);
  }

  replaceEntities(layerId, entities) {
    const layer = this.layers.get(layerId);
    if (!layer) {
      throw new Error(`Plugin scene layer does not exist: ${layerId}`);
    }
    layer.entities.clear();
    (entities || []).forEach((entity) => {
      if (entity && entity.id) {
        layer.entities.set(entity.id, entity);
      }
    });
    this.redrawLayer(layer);
  }

  removeEntities(layerId, entityIds) {
    const layer = this.layers.get(layerId);
    if (!layer) {
      return;
    }
    (entityIds || []).forEach((id) => layer.entities.delete(id));
    this.redrawLayer(layer);
  }

  clearLayer(layerId) {
    const layer = this.layers.get(layerId);
    if (!layer) {
      return;
    }
    layer.entities.clear();
    layer.obstacleBatch = null;
    this.clearGroup(layer);
    if (layer.obstacleRenderer) {
      layer.obstacleRenderer.update({ object: [] }, this.owner.coordinates, this.owner.scene);
    }
  }

  setLayerVisible(layerId, visible) {
    const layer = this.layers.get(layerId);
    if (layer) {
      layer.group.visible = Boolean(visible);
      if (layer.obstacleRenderer) {
        layer.obstacleRenderer.setVisible(Boolean(visible));
      }
    }
  }

  clearGroup(layer) {
    while (layer.group.children.length) {
      const child = layer.group.children.pop();
      disposeMeshGroup(child);
    }
  }

  redrawAll() {
    this.layers.forEach((layer) => this.redrawLayer(layer));
  }

  redrawLayer(layer) {
    if (!this.owner.coordinates.isInitialized()) {
      return;
    }
    this.clearGroup(layer);
    layer.obstacleBatch = null;
    layer.entities.forEach((entity) => {
      if (entity.type === 'obstacleBatch') {
        layer.obstacleBatch = entity;
      } else {
        const object = this.drawEntity(entity);
        if (object) {
          object.userData.pluginEntityId = entity.id;
          object.renderOrder = Number(layer.options.zIndex || 0);
          layer.group.add(object);
        }
      }
    });
    this.drawObstacleBatch(layer);
  }

  drawEntity(entity) {
    const color = colorValue(entity.color);
    if (entity.type === 'box' || entity.type === 'model') {
      const dimensions = entity.dimensions || { length: 1, width: 1, height: 1 };
      const height = Number(dimensions.height || 1);
      const position = this.owner.coordinates.applyOffset({
        x: Number(entity.position && entity.position.x),
        y: Number(entity.position && entity.position.y),
        z: Number((entity.position && entity.position.z) || 0) + height / 2,
      });
      const box = drawBox({
        x: Number(dimensions.length || dimensions.x || 1),
        y: Number(dimensions.width || dimensions.y || 1),
        z: height,
      }, color, Number(entity.lineWidth || 2));
      box.position.copy(position);
      box.rotation.set(0, 0, Number(entity.heading || 0));
      setOpacity(box, Number.isFinite(entity.opacity) ? entity.opacity : 1);
      return box;
    }
    if (entity.type === 'arrow') {
      const position = this.owner.coordinates.applyOffset(entity.position || {});
      const arrow = drawArrow(
        Number(entity.length || 3),
        Number(entity.lineWidth || 2),
        Number(entity.coneLength || 0.8),
        Number(entity.coneWidth || 0.8),
        color,
        Boolean(entity.thick),
      );
      arrow.position.copy(position);
      arrow.rotation.set(0, 0, Number(entity.heading || 0) - Math.PI / 2);
      setOpacity(arrow, Number.isFinite(entity.opacity) ? entity.opacity : 1);
      return arrow;
    }
    if (entity.type === 'polyline' || entity.type === 'polygon') {
      const points = (entity.points || []).map(
        (point) => this.owner.coordinates.applyOffset(point),
      );
      if (entity.type === 'polygon' && points.length > 2) {
        points.push(points[0].clone());
      }
      if (points.length < 2) {
        return null;
      }
      if (entity.dashed) {
        return drawDashedLineFromPoints(
          points,
          color,
          Number(entity.lineWidth || 2),
          Number(entity.dashSize || 2),
          Number(entity.gapSize || 1),
          Number(entity.zOffset || 0),
          Number.isFinite(entity.opacity) ? entity.opacity : 1,
        );
      }
      return drawSegmentsFromPoints(
        points,
        color,
        Number(entity.lineWidth || 2),
        Number(entity.zOffset || 0),
        true,
        Number.isFinite(entity.opacity) && entity.opacity < 1,
        Number.isFinite(entity.opacity) ? entity.opacity : 1,
      );
    }
    if (entity.type === 'point') {
      const position = this.owner.coordinates.applyOffset(entity.position || {});
      const size = Number(entity.size || 0.8);
      const marker = drawBox({ x: size, y: size, z: size / 3 }, color, 2);
      marker.position.set(position.x, position.y, position.z + size / 6);
      marker.rotation.set(0, 0, Number(entity.heading || Math.PI / 4));
      return marker;
    }
    return null;
  }

  drawObstacleBatch(layer) {
    if (!layer.obstacleBatch) {
      if (layer.obstacleRenderer) {
        layer.obstacleRenderer.update({ object: [] }, this.owner.coordinates, this.owner.scene);
      }
      return;
    }
    const entity = layer.obstacleBatch;
    if (!layer.obstacleRenderer) {
      layer.obstacleRenderer = new PerceptionObstacles({
        colorOverride: colorValue(entity.color, 0x1E8BFF),
        lineThickness: Number(entity.lineWidth || 2),
        zOffset: Number(entity.zOffset || 0.08),
        skipSensorMeasurements: true,
        skipLaneMarkers: true,
      });
    }
    const currentWorld = this.owner.lastWorld || {};
    layer.obstacleRenderer.update({
      object: entity.obstacles || [],
      autoDrivingCar: currentWorld.autoDrivingCar || {
        positionX: 0,
        positionY: 0,
        heading: 0,
      },
    }, this.owner.coordinates, this.owner.scene);
  }

  animate(timestamp) {
    this.layers.forEach((layer) => {
      if (layer.obstacleRenderer) {
        layer.obstacleRenderer.animate(timestamp, this.owner.camera, this.owner.dimension.height);
      }
    });
  }

  worldToScreen(point) {
    if (!this.owner.coordinates.isInitialized()) {
      return null;
    }
    const world = this.owner.coordinates.applyOffset(point).project(this.owner.camera);
    return {
      x: ((world.x + 1) * this.owner.dimension.width) / 2,
      y: ((1 - world.y) * this.owner.dimension.height) / 2,
    };
  }

  pickEntity(event) {
    if (!this.owner.camera || !event || !event.currentTarget) {
      return null;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.params.Line.threshold = 1.25;
    raycaster.params.Points.threshold = 1.25;
    raycaster.setFromCamera(mouse, this.owner.camera);
    const candidates = [];
    this.layers.forEach((layer) => {
      if (layer.options.selectable === false || !layer.group.visible) {
        return;
      }
      raycaster.intersectObjects(layer.group.children, true).forEach((hit) => {
        let object = hit.object;
        while (object && !object.userData.pluginEntityId
          && object !== layer.group) {
          object = object.parent;
        }
        if (object && object.userData.pluginEntityId) {
          candidates.push({
            distance: hit.distance,
            layerId: layer.options.id || layer.id,
            entityId: object.userData.pluginEntityId,
          });
        }
      });
    });
    candidates.sort((first, second) => first.distance - second.distance);
    if (!candidates.length) {
      return null;
    }
    const { layerId, entityId } = candidates[0];
    return { layerId, entityId };
  }

  fitBounds(bounds) {
    if (!bounds || !this.owner.coordinates.isInitialized()) {
      return;
    }
    const center = {
      x: (Number(bounds.min.x) + Number(bounds.max.x)) / 2,
      y: (Number(bounds.min.y) + Number(bounds.max.y)) / 2,
      z: (Number(bounds.min.z || 0) + Number(bounds.max.z || 0)) / 2,
    };
    const point = this.owner.coordinates.applyOffset(center);
    this.owner.camera.position.x = point.x;
    this.owner.camera.position.y = point.y;
    this.owner.controls.target.set(point.x, point.y, point.z || 0);
    this.owner.controls.update();
  }
}
