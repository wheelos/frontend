import * as THREE from 'three';

import { ObstacleState, TriggerType } from 'utils/dynamic_obstacle_constants';
import { drawSegmentsFromPoints, drawImage } from 'utils/draw';
import routingPointPin from 'assets/images/routing/pin.png';

const OBSTACLE_COLORS = {
  [ObstacleState.IDLE]: 0xFF6600,
  [ObstacleState.MOVING]: 0x00FF88,
  [ObstacleState.FINISHED]: 0x888888,
};

const TRIGGER_ZONE_COLOR = 0xFFDD00;
const TRIGGER_ZONE_OPACITY = 0.35;
const WIRE_COLOR = 0xFFDD00;
const PATH_COLOR = 0xFF6600;
const PATH_COLOR_ACTIVE = 0x00FF88;
const LINE_THICKNESS = 1.5;

export default class DynamicObstacleRenderer {
  constructor() {
    // Map from obstacleId -> group of Three.js objects
    this.obstacleGroups = {};

    // Editor state
    this.editingId = null;
    this.editingPathPoints = []; // raw world-space {x, y} points
    this.editingPathMeshes = []; // pin meshes for each path point
    this.editingPathLine = null;
    this.camera = null;
    this.coordinates = null;
    this.scene = null;
  }

  // ---- Editing mode --------------------------------------------------------

  enableEditing(obstacleId, camera, coordinates, scene) {
    this.disableEditing(scene);
    this.editingId = obstacleId;
    this.camera = camera;
    this.coordinates = coordinates;
    this.scene = scene;
    this.editingPathPoints = [];
  }

  disableEditing(scene) {
    if (this.editingPathLine) {
      scene.remove(this.editingPathLine);
      this.editingPathLine.geometry.dispose();
      this.editingPathLine.material.dispose();
      this.editingPathLine = null;
    }
    this.editingPathMeshes.forEach((mesh) => {
      scene.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) mesh.material.dispose();
    });
    this.editingPathMeshes = [];
    this.editingId = null;
  }

  addPathPoint(worldPoint, scene) {
    if (!this.editingId) {
      return;
    }
    this.editingPathPoints.push({ x: worldPoint.x, y: worldPoint.y, v: 5.0, t: 0 });
    const offsetPoint = this.coordinates.applyOffset({ x: worldPoint.x, y: worldPoint.y });
    const pin = drawImage(routingPointPin, 2.5, 2.5, offsetPoint.x, offsetPoint.y, 0.5);
    this.editingPathMeshes.push(pin);
    scene.add(pin);
    this._redrawEditingPath(scene);
  }

  removeLastPathPoint(scene) {
    if (this.editingPathPoints.length === 0) {
      return;
    }
    this.editingPathPoints.pop();
    const lastPin = this.editingPathMeshes.pop();
    if (lastPin) {
      scene.remove(lastPin);
      if (lastPin.geometry) lastPin.geometry.dispose();
      if (lastPin.material) lastPin.material.dispose();
    }
    this._redrawEditingPath(scene);
  }

  getEditingPathPoints() {
    return this.editingPathPoints.slice();
  }

  _redrawEditingPath(scene) {
    if (this.editingPathLine) {
      scene.remove(this.editingPathLine);
      if (this.editingPathLine.geometry) this.editingPathLine.geometry.dispose();
      if (this.editingPathLine.material) this.editingPathLine.material.dispose();
      this.editingPathLine = null;
    }
    if (this.editingPathPoints.length < 2 || !this.coordinates) {
      return;
    }
    const offsetPoints = this.editingPathPoints.map((p) =>
      this.coordinates.applyOffset({ x: p.x, y: p.y })
    );
    const threePoints = offsetPoints.map((p) => new THREE.Vector3(p.x, p.y, 0.1));
    this.editingPathLine = drawSegmentsFromPoints(threePoints, PATH_COLOR_ACTIVE, LINE_THICKNESS);
    scene.add(this.editingPathLine);
  }

  // ---- Per-obstacle world rendering ----------------------------------------

  update(obstacles, coordinates, scene) {
    // Remove groups for obstacles that no longer exist
    const currentIds = new Set(obstacles.map((o) => o.id));
    Object.keys(this.obstacleGroups).forEach((id) => {
      if (!currentIds.has(id)) {
        this._removeGroup(id, scene);
      }
    });

    // Add / update each obstacle
    obstacles.forEach((obstacle) => {
      this._updateObstacle(obstacle, coordinates, scene);
    });
  }

  _removeGroup(id, scene) {
    const group = this.obstacleGroups[id];
    if (!group) return;
    scene.remove(group);
    group.children.slice().forEach((child) => {
      scene.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
    delete this.obstacleGroups[id];
  }

  _updateObstacle(obstacle, coordinates, scene) {
    // Rebuild the group each update for simplicity
    this._removeGroup(obstacle.id, scene);

    const group = new THREE.Group();
    group.name = `dyn_obstacle_${obstacle.id}`;
    this.obstacleGroups[obstacle.id] = group;

    const color = OBSTACLE_COLORS[obstacle.state] || OBSTACLE_COLORS[ObstacleState.IDLE];

    // Draw polygon if vertices available
    if (obstacle.polygonVertices && obstacle.polygonVertices.length >= 3) {
      this._drawPolygon(obstacle.polygonVertices, color, coordinates, scene, group);
    }

    // Draw trajectory path
    if (obstacle.trajectory && obstacle.trajectory.length >= 2) {
      this._drawTrajectory(obstacle.trajectory, color, coordinates, scene, group);
    }

    // Draw trigger zone and wire
    if (obstacle.trigger) {
      this._drawTriggerAndWire(obstacle, coordinates, scene, group);
    }

    scene.add(group);
  }

  _drawPolygon(vertices, color, coordinates, scene, group) {
    const offsetVerts = vertices.map((v) =>
      coordinates.applyOffset({ x: v.x, y: v.y })
    );
    const threePoints = offsetVerts.map((v) => new THREE.Vector3(v.x, v.y, 0.2));
    // Close the polygon
    threePoints.push(threePoints[0].clone());
    const line = drawSegmentsFromPoints(threePoints, color, LINE_THICKNESS);
    group.add(line);
    scene.add(line);
  }

  _drawTrajectory(trajectory, color, coordinates, scene, group) {
    const offsetPoints = trajectory.map((p) =>
      coordinates.applyOffset({ x: p.x, y: p.y })
    );
    const threePoints = offsetPoints.map((p) => new THREE.Vector3(p.x, p.y, 0.1));
    const line = drawSegmentsFromPoints(threePoints, color, LINE_THICKNESS);
    group.add(line);
    scene.add(line);
  }

  _drawTriggerAndWire(obstacle, coordinates, scene, group) {
    const { trigger, trajectory } = obstacle;
    if (!trigger) return;

    let triggerWorldPos = null;

    if (trigger.type === TriggerType.REACH_POSITION && trigger.reachPosition) {
      triggerWorldPos = trigger.reachPosition;
      this._drawCircleZone(
        triggerWorldPos,
        trigger.reachPosition.radius || 5,
        TRIGGER_ZONE_COLOR,
        TRIGGER_ZONE_OPACITY,
        coordinates,
        scene,
        group,
      );
    } else if (trigger.type === TriggerType.DISTANCE_TO_EGO) {
      // Distance-to-ego trigger: draw a ring annotation near first trajectory point
      if (trajectory && trajectory.length > 0) {
        triggerWorldPos = { x: trajectory[0].x, y: trajectory[0].y };
        this._drawDistanceAnnotation(
          triggerWorldPos,
          trigger.distanceToEgo || 20,
          TRIGGER_ZONE_COLOR,
          coordinates,
          scene,
          group,
        );
      }
    } else if (trigger.type === TriggerType.TIME_DELAY) {
      // Time-delay trigger: small clock indicator near first trajectory point
      if (trajectory && trajectory.length > 0) {
        triggerWorldPos = { x: trajectory[0].x, y: trajectory[0].y };
      }
    }

    // Draw the "wire" connecting the trigger position to the first trajectory point
    if (triggerWorldPos && trajectory && trajectory.length > 0) {
      const startOffset = coordinates.applyOffset(triggerWorldPos);
      const endOffset = coordinates.applyOffset({ x: trajectory[0].x, y: trajectory[0].y });
      if (startOffset && endOffset) {
        const wirePoints = [
          new THREE.Vector3(startOffset.x, startOffset.y, 0.15),
          new THREE.Vector3(endOffset.x, endOffset.y, 0.15),
        ];
        const wire = drawSegmentsFromPoints(wirePoints, WIRE_COLOR, 1.0);
        group.add(wire);
        scene.add(wire);
      }
    }
  }

  _drawCircleZone(worldCenter, radius, color, opacity, coordinates, scene, group) {
    const offsetCenter = coordinates.applyOffset(worldCenter);
    if (!offsetCenter) return;

    const segments = 32;
    const geometry = new THREE.CircleGeometry(radius, segments);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const circle = new THREE.Mesh(geometry, material);
    circle.position.set(offsetCenter.x, offsetCenter.y, 0.05);
    group.add(circle);
    scene.add(circle);

    // Also draw an outline ring
    const ringGeo = new THREE.RingGeometry(radius - 0.3, radius, segments);
    const ringMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(offsetCenter.x, offsetCenter.y, 0.1);
    group.add(ring);
    scene.add(ring);
  }

  _drawDistanceAnnotation(worldCenter, distance, color, coordinates, scene, group) {
    // Draw a dashed circle of given radius around the center point
    const offsetCenter = coordinates.applyOffset(worldCenter);
    if (!offsetCenter) return;

    const segments = 32;
    const ringGeo = new THREE.RingGeometry(distance - 0.4, distance, segments);
    const ringMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(offsetCenter.x, offsetCenter.y, 0.1);
    group.add(ring);
    scene.add(ring);
  }

  dispose(scene) {
    Object.keys(this.obstacleGroups).forEach((id) => {
      this._removeGroup(id, scene);
    });
    this.disableEditing(scene);
  }
}
