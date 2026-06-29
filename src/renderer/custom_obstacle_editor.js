import * as THREE from 'three';

import STORE from 'store';
import WS from 'store/websocket';
import {
  drawArrow,
  drawBox,
  drawDashedLineFromPoints,
  drawSegmentsFromPoints,
  disposeMeshGroup,
} from 'utils/draw';

const DIMENSIONS = {
  Vehicle: { length: 4.8, width: 2.0, height: 1.6 },
  Truck: { length: 8.0, width: 2.5, height: 3.0 },
  Bicycle: { length: 1.8, width: 0.7, height: 1.6 },
  Pedestrian: { length: 0.6, width: 0.6, height: 1.7 },
};

const COLOR_NORMAL = 0x37d8ff;
const COLOR_SELECTED = 0xffd34d;
const COLOR_GHOST = 0x7fe8ff;
const COLOR_PATH = 0xb65cff;
const MODE = {
  SELECT: 'Select',
  PLACE: 'Place',
  EDIT_PATH: 'EditPath',
};

function dimensionFor(type) {
  return DIMENSIONS[type] || DIMENSIONS.Vehicle;
}

function cloneObstacle(obstacle) {
  return {
    ...obstacle,
    waypoints: (obstacle.waypoints || []).map((point) => ({ ...point })),
  };
}

function pointInObstacle(point, obstacle) {
  const { length, width } = dimensionFor(obstacle.type);
  const heading = obstacle.heading || 0;
  const dx = point.x - obstacle.x;
  const dy = point.y - obstacle.y;
  const cos = Math.cos(heading);
  const sin = Math.sin(heading);
  const localX = cos * dx + sin * dy;
  const localY = -sin * dx + cos * dy;
  return Math.abs(localX) <= length / 2 && Math.abs(localY) <= width / 2;
}

function rotateHandlePoint(obstacle) {
  const { length } = dimensionFor(obstacle.type);
  const heading = obstacle.heading || 0;
  const distance = length / 2 + 3.0;
  return {
    x: obstacle.x + Math.cos(heading) * distance,
    y: obstacle.y + Math.sin(heading) * distance,
    z: obstacle.z || 0,
  };
}

function distance2d(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export default class CustomObstacleEditor {
  constructor() {
    this.enabled = false;
    this.group = new THREE.Group();
    this.group.name = 'custom-obstacle-editor';
    this.obstacles = [];
    this.selectedId = null;
    this.mode = MODE.SELECT;
    this.draft = {};
    this.ghostPoint = null;
    this.drag = null;
  }

  enable(scene) {
    if (!scene.children.includes(this.group)) {
      scene.add(this.group);
    }
    this.enabled = true;
  }

  disable(scene) {
    this.enabled = false;
    this.ghostPoint = null;
    this.drag = null;
    this.clear(scene);
  }

  clear() {
    while (this.group.children.length) {
      const child = this.group.children.pop();
      disposeMeshGroup(child);
    }
  }

  update(obstacles, selectedId, mode, draft, coordinates) {
    this.obstacles = (obstacles || []).map(cloneObstacle);
    this.selectedId = selectedId;
    this.mode = mode || MODE.SELECT;
    this.draft = draft || {};
    this.redraw(coordinates);
  }

  redraw(coordinates) {
    if (!this.enabled || !coordinates || !coordinates.isInitialized()) {
      return;
    }
    this.clear();
    this.obstacles.forEach((obstacle) => this.drawObstacle(obstacle, coordinates, false));
    if (this.mode === MODE.PLACE && this.ghostPoint) {
      this.drawObstacle({
        ...this.draft,
        x: this.ghostPoint.x,
        y: this.ghostPoint.y,
        z: this.ghostPoint.z || 0,
        id: 'ghost',
      }, coordinates, true);
    }
  }

  drawObstacle(obstacle, coordinates, ghost) {
    const { length, width, height } = dimensionFor(obstacle.type);
    const selected = obstacle.id === this.selectedId && !ghost;
    const color = ghost ? COLOR_GHOST : (selected ? COLOR_SELECTED : COLOR_NORMAL);
    const position = coordinates.applyOffset({
      x: obstacle.x,
      y: obstacle.y,
      z: (obstacle.z || 0) + height / 2 + 0.2,
    });
    const box = drawBox({ x: length, y: width, z: height }, color, selected ? 3 : 2);
    box.position.set(position.x, position.y, position.z);
    box.rotation.set(0, 0, obstacle.heading || 0);
    box.material.transparent = true;
    box.material.opacity = ghost ? 0.45 : 1.0;
    this.group.add(box);

    const arrow = drawArrow(Math.max(2.0, length / 2 + 1.0), selected ? 3 : 2, 0.8, 0.8, color);
    arrow.position.set(position.x, position.y, position.z + height / 2 + 0.2);
    arrow.rotation.set(0, 0, (obstacle.heading || 0) - Math.PI / 2);
    this.group.add(arrow);

    if (selected) {
      const handle = rotateHandlePoint(obstacle);
      const handlePos = coordinates.applyOffset({ x: handle.x, y: handle.y, z: position.z });
      const handleBox = drawBox({ x: 0.8, y: 0.8, z: 0.2 }, COLOR_SELECTED, 2);
      handleBox.position.set(handlePos.x, handlePos.y, position.z + height / 2 + 0.35);
      this.group.add(handleBox);
    }

    if (!ghost && obstacle.waypoints && obstacle.waypoints.length) {
      const path = [
        { x: obstacle.x, y: obstacle.y, z: 0.4 },
        ...obstacle.waypoints.map((point) => ({ x: point.x, y: point.y, z: 0.4 })),
      ].map((point) => coordinates.applyOffset(point));
      this.group.add(drawDashedLineFromPoints(path, COLOR_PATH, 2, 2, 1, 0, 0.9));
      path.forEach((point, index) => {
        const marker = drawBox({ x: 1.2, y: 1.2, z: 0.2 }, COLOR_PATH, 2);
        marker.position.set(point.x, point.y, point.z + 0.2);
        marker.rotation.set(0, 0, Math.PI / 4);
        this.group.add(marker);
        if (index > 0) {
          const prev = path[index - 1];
          this.group.add(drawSegmentsFromPoints([prev, point], COLOR_PATH, 1, 0.15, true, true, 0.25));
        }
      });
    }
  }

  selectedObstacle() {
    return this.obstacles.find((obstacle) => obstacle.id === this.selectedId);
  }

  hitObstacle(point) {
    for (let i = this.obstacles.length - 1; i >= 0; --i) {
      if (pointInObstacle(point, this.obstacles[i])) {
        return this.obstacles[i];
      }
    }
    return null;
  }

  hitRotateHandle(point) {
    const selected = this.selectedObstacle();
    if (!selected) {
      return false;
    }
    return distance2d(point, rotateHandlePoint(selected)) < 2.0;
  }

  hitWaypoint(point) {
    const selected = this.selectedObstacle();
    if (!selected || !selected.waypoints) {
      return -1;
    }
    return selected.waypoints.findIndex((waypoint) => distance2d(point, waypoint) < 2.0);
  }

  handleMouseMove(point, coordinates) {
    if (!this.enabled || !point) {
      return;
    }
    if (this.mode === MODE.PLACE) {
      this.ghostPoint = point;
      this.redraw(coordinates);
      return;
    }
    if (!this.drag) {
      return;
    }
    const selected = this.selectedObstacle();
    if (!selected) {
      return;
    }
    if (this.drag.type === 'move') {
      const next = {
        ...selected,
        x: point.x - this.drag.offsetX,
        y: point.y - this.drag.offsetY,
      };
      this.replaceLocalObstacle(next);
      this.redraw(coordinates);
    } else if (this.drag.type === 'rotate') {
      const heading = Math.atan2(point.y - selected.y, point.x - selected.x);
      this.replaceLocalObstacle({ ...selected, heading });
      this.redraw(coordinates);
    } else if (this.drag.type === 'waypoint') {
      const waypoints = selected.waypoints.map((waypoint, index) => (
        index === this.drag.index ? { ...waypoint, x: point.x, y: point.y, z: point.z || 0 } : waypoint
      ));
      this.replaceLocalObstacle({ ...selected, waypoints });
      this.redraw(coordinates);
    }
  }

  handleMouseDown(point, event) {
    if (!this.enabled || !point || event.button !== THREE.MOUSE.LEFT) {
      return false;
    }
    if (this.mode === MODE.PLACE) {
      STORE.wheelflow.addCustomObstacleAt(point);
      this.ghostPoint = null;
      return true;
    }
    const selected = this.selectedObstacle();
    if (this.mode === MODE.EDIT_PATH && selected) {
      const waypointIndex = this.hitWaypoint(point);
      if (waypointIndex >= 0) {
        this.drag = { type: 'waypoint', index: waypointIndex };
      } else {
        const waypoints = [...(selected.waypoints || []), { x: point.x, y: point.y, z: point.z || 0 }];
        WS.updateWheelFlowCustomObstacle({ ...selected, waypoints });
      }
      return true;
    }
    if (selected && this.hitRotateHandle(point)) {
      this.drag = { type: 'rotate' };
      return true;
    }
    const obstacle = this.hitObstacle(point);
    if (obstacle) {
      STORE.wheelflow.selectCustomObstacle(obstacle.id);
      this.drag = {
        type: 'move',
        offsetX: point.x - obstacle.x,
        offsetY: point.y - obstacle.y,
      };
      return true;
    }
    STORE.wheelflow.selectCustomObstacle(null);
    return false;
  }

  handleMouseUp() {
    if (!this.drag) {
      return false;
    }
    const selected = this.selectedObstacle();
    this.drag = null;
    if (selected) {
      WS.updateWheelFlowCustomObstacle(selected);
      return true;
    }
    return false;
  }

  handleContextMenu(point) {
    if (!this.enabled || this.mode !== MODE.EDIT_PATH || !point) {
      return false;
    }
    const selected = this.selectedObstacle();
    if (!selected) {
      return false;
    }
    const waypointIndex = this.hitWaypoint(point);
    if (waypointIndex < 0) {
      return false;
    }
    const waypoints = selected.waypoints.filter((_, index) => index !== waypointIndex);
    WS.updateWheelFlowCustomObstacle({ ...selected, waypoints });
    return true;
  }

  handleKeyDown(event) {
    if (!this.enabled) {
      return false;
    }
    if (event.key === 'Escape') {
      STORE.wheelflow.setCustomObstacleMode(MODE.SELECT);
      return true;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      STORE.wheelflow.deleteSelectedCustomObstacle();
      return true;
    }
    return false;
  }

  replaceLocalObstacle(nextObstacle) {
    this.obstacles = this.obstacles.map((obstacle) => (
      obstacle.id === nextObstacle.id ? cloneObstacle(nextObstacle) : obstacle
    ));
  }

  focus(id, coordinates, camera, controls) {
    const obstacle = this.obstacles.find((item) => item.id === id);
    if (!obstacle || !coordinates || !coordinates.isInitialized()) {
      return;
    }
    const point = coordinates.applyOffset({ x: obstacle.x, y: obstacle.y, z: 0 });
    camera.position.x = point.x;
    camera.position.y = point.y;
    controls.target.set(point.x, point.y, 0);
    controls.update();
  }
}
