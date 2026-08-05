import * as THREE from 'three';
import STORE from 'store';
import { MAP_WS } from 'store/websocket';
import _ from 'lodash';

import {
  drawSegmentsFromPoints,
  drawPolylineBandFromPoints,
  drawDashedBandFromPoints,
  drawPolygonSurfaceFromRings,
  offsetPolylinePoints,
  drawShapeFromPoints,
  changeMaterial,
} from 'utils/draw';
import Text3D, { TEXT_ALIGN } from 'renderer/text3d';
import TrafficSigns from 'renderer/traffic_controls/traffic_signs';
import TrafficSignals from 'renderer/traffic_controls/traffic_signals';

import stopSignMaterial from 'assets/models/stop_sign.mtl';
import stopSignObject from 'assets/models/stop_sign.obj';
import yieldSignMaterial from 'assets/models/yield_sign.mtl';
import yieldSignObject from 'assets/models/yield_sign.obj';

const STOP_SIGN_SCALE = 0.01;
const YIELD_SIGN_SCALE = 1.5;

const colorMapping = {
  YELLOW: 0XDAA520,
  WHITE: 0xCCCCCC,
  CORAL: 0xFF7F50,
  RED: 0xFF6666,
  GREEN: 0x006400,
  BLUE: 0x30A5FF,
  PURE_WHITE: 0xFFFFFF,
  DEFAULT: 0xC0C0C0,
};

const MAP_VISUAL_THEME = {
  dark: {
    laneSurface: { color: 0x263F4B, opacity: 1 },
    roadSurface: { color: 0x1D323C, opacity: 1 },
    junctionSurface: { color: 0x233B46, opacity: 1 },
    roadEdge: { color: 0x82919D, opacity: 0.72 },
    laneCenter: { color: 0x4D7180, opacity: 0.38 },
    laneWhite: { color: 0xEDF3F7, opacity: 0.92 },
    laneYellow: { color: 0xF3C75D, opacity: 0.96 },
    laneCurb: { color: 0x92A3AE, opacity: 0.82 },
    laneDefault: { color: 0xA7B4BD, opacity: 0.72 },
    junctionBorder: { color: 0x4CAEFF, opacity: 0.78 },
  },
  light: {
    laneSurface: { color: 0xAEB8C0, opacity: 1 },
    roadSurface: { color: 0xBCC4CA, opacity: 1 },
    junctionSurface: { color: 0xA7B3BC, opacity: 1 },
    roadEdge: { color: 0x526875, opacity: 0.84 },
    laneCenter: { color: 0x627D89, opacity: 0.44 },
    laneWhite: { color: 0xF9FBFC, opacity: 1 },
    laneYellow: { color: 0xB77A00, opacity: 0.98 },
    laneCurb: { color: 0x455D6C, opacity: 0.9 },
    laneDefault: { color: 0x5B7180, opacity: 0.84 },
    junctionBorder: { color: 0x147DE1, opacity: 0.88 },
  },
};

const CAMERA_HIDDEN_MAP_ROLES = new Set([
  'laneSurface', 'roadSurface', 'junctionSurface',
]);
const MAP_LAYER_FADE_DURATION = 220;
const ASPHALT_TEXTURE_SIZE = 128;

function createAsphaltSurfaceTexture() {
  const data = new Uint8Array(ASPHALT_TEXTURE_SIZE * ASPHALT_TEXTURE_SIZE * 3);
  let seed = 1831565813;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let y = 0; y < ASPHALT_TEXTURE_SIZE; y += 1) {
    for (let x = 0; x < ASPHALT_TEXTURE_SIZE; x += 1) {
      const wave = Math.sin(x * 0.17) * 2.2
        + Math.sin(y * 0.11) * 1.8
        + Math.sin((x + y) * 0.07) * 1.4;
      const grain = (random() - 0.5) * 9;
      const aggregate = random() < 0.018 ? -24 : 0;
      const value = Math.max(208, Math.min(255, Math.round(
        244 + wave + grain + aggregate,
      )));
      const index = (y * ASPHALT_TEXTURE_SIZE + x) * 3;
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
    }
  }

  const texture = new THREE.DataTexture(
    data,
    ASPHALT_TEXTURE_SIZE,
    ASPHALT_TEXTURE_SIZE,
    THREE.RGBFormat,
  );
  texture.name = 'AsphaltSurfaceTexture';
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipMapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function distanceSquared(pointA, pointB) {
  const deltaX = pointA.x - pointB.x;
  const deltaY = pointA.y - pointB.y;
  return deltaX * deltaX + deltaY * deltaY;
}

// parallel=1 0-1 2-3
const order1 = [
  [0, 1, 2, 3],
  [1, 0, 3, 2],
  [2, 3, 0, 1],
  [3, 2, 1, 0],
];
// parallel=2 0-3 1-2
const order2 = [
  [0, 3, 2, 1],
  [1, 2, 3, 0],
  [2, 1, 0, 3],
  [3, 0, 1, 2],
];
export default class Map {
  constructor() {
    this.textRender = new Text3D();
    this.hash = -1;
    this.data = {};
    this.initialized = false;
    this.elementKindsDrawn = '';
    this.forceReload = false;

    this.trafficSignals = new TrafficSignals();
    this.stopSigns = new TrafficSigns(
      stopSignMaterial, stopSignObject, STOP_SIGN_SCALE,
    );
    this.yieldSigns = new TrafficSigns(
      yieldSignMaterial, yieldSignObject, YIELD_SIGN_SCALE,
    );

    this.zOffsetFactor = 1;
    this.themeMode = 'dark';
    this.cameraViewEnabled = false;
    this.fadingObjects = new Set();
    this.surfaceTexture = createAsphaltSurfaceTexture();
    this.reducedMotion = window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  applyVisualStyle(object) {
    const role = _.get(object, 'userData.mapVisualRole');
    const theme = MAP_VISUAL_THEME[this.themeMode] || MAP_VISUAL_THEME.dark;
    const style = theme[role];
    if (style && object.material) {
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      object.userData.mapVisualTargetOpacity = style.opacity;
      materials.forEach((material) => {
        if (material.color) {
          material.color.setHex(style.color);
        }
        if (object.userData.mapVisualFadeStartedAt === undefined) {
          material.opacity = style.opacity;
          material.transparent = style.opacity < 1;
          material.depthWrite = style.opacity >= 1;
        }
        material.needsUpdate = true;
      });
    }
    if (role) {
      object.visible = !this.cameraViewEnabled
        || !CAMERA_HIDDEN_MAP_ROLES.has(role);
    }
  }

  startVisualFade(object) {
    if (this.reducedMotion || !object.material || !object.visible) {
      return;
    }
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    object.userData.mapVisualFadeStartedAt = performance.now();
    materials.forEach((material) => {
      material.opacity = 0;
      material.transparent = true;
      material.depthWrite = false;
    });
    this.fadingObjects.add(object);
  }

  setVisualRole(object, role) {
    if (!object) {
      return object;
    }
    object.traverse((child) => {
      const isNewVisual = !child.userData.mapVisualRole;
      child.userData.mapVisualRole = role;
      this.applyVisualStyle(child);
      if (isNewVisual) {
        this.startVisualFade(child);
      }
    });
    return object;
  }

  forEachDrewObject(callback) {
    Object.keys(this.data).forEach((kind) => {
      this.data[kind].forEach((element) => {
        if (element.drewObjects) {
          element.drewObjects.forEach((object) => object.traverse(callback));
        }
      });
    });
  }

  updateTheme(themeMode) {
    this.themeMode = MAP_VISUAL_THEME[themeMode] ? themeMode : 'dark';
    this.forEachDrewObject((object) => this.applyVisualStyle(object));
  }

  updateViewMode(cameraViewEnabled) {
    if (this.cameraViewEnabled === cameraViewEnabled) {
      return;
    }
    this.cameraViewEnabled = cameraViewEnabled;
    this.forEachDrewObject((object) => {
      const wasVisible = object.visible;
      this.applyVisualStyle(object);
      if (!object.visible) {
        delete object.userData.mapVisualFadeStartedAt;
        this.fadingObjects.delete(object);
      } else if (!wasVisible) {
        this.startVisualFade(object);
      }
    });
  }

  animate(timestamp) {
    this.fadingObjects.forEach((object) => {
      if (!object.visible || !object.material) {
        this.fadingObjects.delete(object);
        return;
      }
      const startedAt = object.userData.mapVisualFadeStartedAt;
      const targetOpacity = object.userData.mapVisualTargetOpacity;
      const progress = Math.min(1, (timestamp - startedAt) / MAP_LAYER_FADE_DURATION);
      const easedProgress = 1 - ((1 - progress) ** 3);
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      materials.forEach((material) => {
        material.opacity = targetOpacity * easedProgress;
        material.transparent = progress < 1 || targetOpacity < 1;
        material.depthWrite = progress >= 1 && targetOpacity >= 1;
      });
      if (progress >= 1) {
        delete object.userData.mapVisualFadeStartedAt;
        this.fadingObjects.delete(object);
      }
    });
  }

  // The result will be the all the elements in current but not in data.
  diffMapElements(elementIds, data) {
    const result = {};
    let empty = true;

    for (const kind in elementIds) {
      if (!this.shouldDrawObjectOfThisElementKind(kind)) {
        continue;
      }

      result[kind] = [];
      const newIds = elementIds[kind];
      const oldData = data[kind];
      for (let i = 0; i < newIds.length; ++i) {
        const found = oldData ? oldData.find((old) => old.id.id === newIds[i]) : false;

        if (!found) {
          empty = false;
          result[kind].push(newIds[i]);
        }
      }
    }

    return empty ? {} : result;
  }

  addLaneMesh(laneType, points) {
    switch (laneType) {
      case 'DOTTED_YELLOW':
        return this.setVisualRole(
          drawDashedBandFromPoints(
            points, 0.11, colorMapping.YELLOW, 2.2, 1.4,
            this.zOffsetFactor, 1, false,
          ),
          'laneYellow',
        );
      case 'DOTTED_WHITE':
        return this.setVisualRole(
          drawDashedBandFromPoints(
            points, 0.1, colorMapping.WHITE, 1.4, 0.9,
            this.zOffsetFactor, 1, false,
          ),
          'laneWhite',
        );
      case 'SOLID_YELLOW':
        return this.setVisualRole(
          drawPolylineBandFromPoints(
            points, 0.11, colorMapping.YELLOW, this.zOffsetFactor, 1, false,
          ),
          'laneYellow',
        );
      case 'SOLID_WHITE':
        return this.setVisualRole(
          drawPolylineBandFromPoints(
            points, 0.1, colorMapping.WHITE, this.zOffsetFactor, 1, false,
          ),
          'laneWhite',
        );
      case 'DOUBLE_YELLOW': {
        const left = drawPolylineBandFromPoints(
          offsetPolylinePoints(points, -0.13),
          0.09,
          colorMapping.YELLOW,
          this.zOffsetFactor,
          1,
          false,
        );
        const right = drawPolylineBandFromPoints(
          offsetPolylinePoints(points, 0.13),
          0.09,
          colorMapping.YELLOW,
          0,
          1,
          false,
        );
        left.add(right);
        return this.setVisualRole(left, 'laneYellow');
      }
      case 'CURB':
        return this.setVisualRole(
          drawPolylineBandFromPoints(
            points, 0.14, colorMapping.CORAL, this.zOffsetFactor, 1, false,
          ),
          'laneCurb',
        );
      default:
        return this.setVisualRole(
          drawPolylineBandFromPoints(
            points, 0.08, colorMapping.DEFAULT, this.zOffsetFactor, 1, false,
          ),
          'laneDefault',
        );
    }
  }

  getLaneBoundaryPoints(boundary, coordinates) {
    const points = [];
    _.get(boundary, 'curve.segment', []).forEach((segment) => {
      const segmentPoints = coordinates.applyOffsetToArray(
        _.get(segment, 'lineSegment.point', []),
      ) || [];
      segmentPoints.forEach((point) => {
        const previous = points[points.length - 1];
        if (!previous || distanceSquared(previous, point) > 0.000001) {
          points.push(point);
        }
      });
    });
    return points;
  }

  addLaneSurface(lane, coordinates, scene) {
    const leftBoundary = this.getLaneBoundaryPoints(lane.leftBoundary, coordinates);
    let rightBoundary = this.getLaneBoundaryPoints(lane.rightBoundary, coordinates);
    if (leftBoundary.length < 2 || rightBoundary.length < 2) {
      return null;
    }

    const leftStart = leftBoundary[0];
    const leftEnd = leftBoundary[leftBoundary.length - 1];
    const rightStart = rightBoundary[0];
    const rightEnd = rightBoundary[rightBoundary.length - 1];
    const sameDirectionClosure = distanceSquared(leftEnd, rightEnd)
      + distanceSquared(leftStart, rightStart);
    const oppositeDirectionClosure = distanceSquared(leftEnd, rightStart)
      + distanceSquared(leftStart, rightEnd);
    if (sameDirectionClosure <= oppositeDirectionClosure) {
      rightBoundary = rightBoundary.slice().reverse();
    }

    const material = new THREE.MeshBasicMaterial({
      color: MAP_VISUAL_THEME[this.themeMode].laneSurface.color,
      map: this.surfaceTexture,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 2,
      polygonOffsetUnits: 2,
    });
    const surface = drawPolygonSurfaceFromRings(
      leftBoundary.concat(rightBoundary),
      [],
      material,
      0.16,
      false,
    );
    if (!surface) {
      material.dispose();
      return null;
    }

    surface.name = `LaneSurface-${lane.id.id}`;
    surface.renderOrder = -11;
    this.setVisualRole(surface, 'laneSurface');
    scene.add(surface);
    return surface;
  }

  addLane(lane, coordinates, scene) {
    const drewObjects = [];

    const laneSurface = this.addLaneSurface(lane, coordinates, scene);
    if (laneSurface) {
      drewObjects.push(laneSurface);
    }

    const centralLine = lane.centralCurve.segment;
    centralLine.forEach((segment) => {
      const points = coordinates.applyOffsetToArray(segment.lineSegment.point);
      const centerLine = this.setVisualRole(
        drawPolylineBandFromPoints(
          points, 0.025, colorMapping.GREEN, this.zOffsetFactor, 0.4, false,
        ),
        'laneCenter',
      );
      centerLine.name = `CentralLine-${lane.id.id}`;
      scene.add(centerLine);
      drewObjects.push(centerLine);
    });

    const rightLaneType = _.get(
      lane,
      'rightBoundary.boundaryType[0].types[0]',
      'UNKNOWN',
    );
    // TODO: this is a temp. fix for repeated boundary types.
    lane.rightBoundary.curve.segment.forEach((segment, index) => {
      const points = coordinates.applyOffsetToArray(segment.lineSegment.point);
      const boundary = this.addLaneMesh(rightLaneType, points);
      boundary.name = `RightBoundary-${lane.id.id}`;
      scene.add(boundary);
      drewObjects.push(boundary);
    });

    const leftLaneType = _.get(
      lane,
      'leftBoundary.boundaryType[0].types[0]',
      'UNKNOWN',
    );
    lane.leftBoundary.curve.segment.forEach((segment, index) => {
      const points = coordinates.applyOffsetToArray(segment.lineSegment.point);
      const boundary = this.addLaneMesh(leftLaneType, points);
      boundary.name = `LeftBoundary-${lane.id.id}`;
      scene.add(boundary);
      drewObjects.push(boundary);
    });

    return drewObjects;
  }

  addLaneId(lane, coordinates, scene) {
    const centralLine = lane.centralCurve.segment;
    let position = _.get(centralLine, '[0].startPosition');
    if (position) {
      position.z = 0.04;
      position = coordinates.applyOffset(position);
    }

    const rotation = { x: 0.0, y: 0.0, z: 0.0 };
    const points = _.get(centralLine, '[0].lineSegment.point', []);
    if (points.length >= 2) {
      const p1 = points[0];
      const p2 = points[1];
      rotation.z = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    }

    const text = this.textRender.drawText(
      lane.id.id, scene, colorMapping.WHITE, TEXT_ALIGN.LEFT,
    );
    if (text) {
      const textPosition = position || _.get(points, '[0]');
      if (textPosition) {
        text.position.set(textPosition.x, textPosition.y, textPosition.z);
        text.rotation.set(rotation.x, rotation.y, rotation.z);
      }
      text.visible = false;
      scene.add(text);
    }

    return text;
  }

  getBoundaryEdgePoints(edge, coordinates) {
    const points = [];
    _.get(edge, 'curve.segment', []).forEach((segment) => {
      const segmentPoints = coordinates.applyOffsetToArray(
        _.get(segment, 'lineSegment.point', []),
      );
      segmentPoints.filter(Boolean).forEach((point) => {
        const previous = points[points.length - 1];
        if (!previous || distanceSquared(previous, point) > 0.000001) {
          points.push(point);
        }
      });
    });
    return points;
  }

  stitchBoundaryPolygon(boundaryPolygon, coordinates) {
    const edgeLines = _.get(boundaryPolygon, 'edge', [])
      .map((edge) => this.getBoundaryEdgePoints(edge, coordinates))
      .filter((points) => points.length > 1);
    if (!edgeLines.length) {
      return [];
    }

    const ring = edgeLines.shift().slice();
    while (edgeLines.length) {
      const end = ring[ring.length - 1];
      let nearestIndex = 0;
      let shouldReverse = false;
      let nearestDistance = Number.POSITIVE_INFINITY;

      edgeLines.forEach((line, index) => {
        const startDistance = distanceSquared(end, line[0]);
        const endDistance = distanceSquared(end, line[line.length - 1]);
        if (startDistance < nearestDistance) {
          nearestDistance = startDistance;
          nearestIndex = index;
          shouldReverse = false;
        }
        if (endDistance < nearestDistance) {
          nearestDistance = endDistance;
          nearestIndex = index;
          shouldReverse = true;
        }
      });

      let nextLine = edgeLines.splice(nearestIndex, 1)[0].slice();
      if (shouldReverse) {
        nextLine = nextLine.reverse();
      }
      if (distanceSquared(end, nextLine[0]) < 0.000001) {
        nextLine.shift();
      }
      ring.push(...nextLine);
    }

    if (ring.length > 2 && distanceSquared(ring[0], ring[ring.length - 1]) < 0.000001) {
      ring.pop();
    }
    return ring;
  }

  addRoadSurface(road, section, sectionIndex, coordinates, scene) {
    const contour = this.stitchBoundaryPolygon(
      _.get(section, 'boundary.outerPolygon'),
      coordinates,
    );
    const holes = _.get(section, 'boundary.hole', [])
      .map((hole) => this.stitchBoundaryPolygon(hole, coordinates))
      .filter((ring) => ring.length >= 3);
    const material = new THREE.MeshBasicMaterial({
      color: MAP_VISUAL_THEME[this.themeMode].roadSurface.color,
      map: this.surfaceTexture,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    const surface = drawPolygonSurfaceFromRings(
      contour,
      holes,
      material,
      0.08,
      false,
    );
    if (!surface) {
      material.dispose();
      return null;
    }

    surface.name = `RoadSurface-${road.id.id}-${sectionIndex}`;
    surface.renderOrder = -10;
    this.setVisualRole(surface, 'roadSurface');
    scene.add(surface);
    return surface;
  }

  addRoad(road, coordinates, scene) {
    const drewObjects = [];

    road.section.forEach((section, sectionIndex) => {
      const surface = this.addRoadSurface(
        road,
        section,
        sectionIndex,
        coordinates,
        scene,
      );
      if (surface) {
        drewObjects.push(surface);
      }

      _.get(section, 'boundary.outerPolygon.edge', []).forEach((edge) => {
        edge.curve.segment.forEach((segment, index) => {
          const points = coordinates.applyOffsetToArray(segment.lineSegment.point);
          const boundary = this.addLaneMesh('CURB', points);
          boundary.name = `Road-${road.id.id}`;
          this.setVisualRole(boundary, 'roadEdge');
          boundary.renderOrder = 1;
          scene.add(boundary);
          drewObjects.push(boundary);
        });
      });
    });

    return drewObjects;
  }

  addBorder(borderPolygon, color, coordinates, scene, visualRole = null) {
    const drewObjects = [];

    const border = coordinates.applyOffsetToArray(borderPolygon.polygon.point);
    if (!border || !border.length) {
      return drewObjects;
    }
    border.push(border[0]);

    const mesh = drawPolylineBandFromPoints(
      border, 0.08, color, this.zOffsetFactor, 1, true,
    );
    if (visualRole) {
      this.setVisualRole(mesh, visualRole);
    }
    scene.add(mesh);
    drewObjects.push(mesh);

    return drewObjects;
  }

  addJunction(junction, coordinates, scene) {
    const drewObjects = [];
    const contour = coordinates.applyOffsetToArray(
      _.get(junction, 'polygon.point', []),
    );
    const material = new THREE.MeshBasicMaterial({
      color: MAP_VISUAL_THEME[this.themeMode].junctionSurface.color,
      map: this.surfaceTexture,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    const surface = drawPolygonSurfaceFromRings(
      contour,
      [],
      material,
      0.35,
      false,
    );
    if (surface) {
      surface.name = `JunctionSurface-${junction.id.id}`;
      surface.renderOrder = -9;
      this.setVisualRole(surface, 'junctionSurface');
      scene.add(surface);
      drewObjects.push(surface);
    } else {
      material.dispose();
    }

    return drewObjects.concat(
      this.addBorder(
        junction,
        colorMapping.BLUE,
        coordinates,
        scene,
        'junctionBorder',
      ),
    );
  }

  addParkingSpaceId(parkingSpace, coordinates, scene) {
    const text = this.textRender.drawText(parkingSpace.id.id, scene, colorMapping.WHITE);
    const points = _.get(parkingSpace, 'polygon.point');
    if (points && points.length >= 3 && text) {
      const point1 = points[0];
      const point2 = points[1];
      const point3 = points[2];
      let textPosition = {
        x: (point1.x + point3.x) / 2,
        y: (point1.y + point3.y) / 2,
        z: 0.04,
      };
      textPosition = coordinates.applyOffset(textPosition);
      const textRotationZ = Math.atan2(point2.y - point1.y, point2.x - point1.x);

      text.position.set(textPosition.x, textPosition.y, textPosition.z);
      text.rotation.set(0, 0, textRotationZ);
      text.visible = true;
      scene.add(text);
    }
    return text;
  }

  addZone(zone, color, coordinates, scene) {
    const drewObjects = [];

    const border = coordinates.applyOffsetToArray(zone.polygon.point);
    border.push(border[0]);

    const zoneMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.15,
    });

    const zoneShape = drawShapeFromPoints(
      border, zoneMaterial, false, this.zOffsetFactor * 3, false,
    );
    scene.add(zoneShape);
    drewObjects.push(zoneShape);

    const mesh = drawSegmentsFromPoints(
      border, color, 2, this.zOffsetFactor, true, false, 1.0,
    );
    scene.add(mesh);
    drewObjects.push(mesh);

    return drewObjects;
  }

  addCurve(lines, color, coordinates, scene) {
    const drewObjects = [];
    lines.forEach((line) => {
      line.segment.forEach((segment) => {
        const points = coordinates.applyOffsetToArray(segment.lineSegment.point);
        const mesh = drawPolylineBandFromPoints(
          points, 0.16, color, this.zOffsetFactor * 2, 1, false,
        );
        scene.add(mesh);
        drewObjects.push(mesh);
      });
    });
    return drewObjects;
  }

  addStopLine(stopLine, coordinates, scene) {
    const drewObjects = this.addCurve(
      stopLine, colorMapping.PURE_WHITE, coordinates, scene,
    );
    return drewObjects;
  }

  removeDrewText(textMesh, scene) {
    if (textMesh) {
      textMesh.children.forEach((c) => c.visible = false);
      scene.remove(textMesh);
    }
  }

  removeDrewObjects(drewObjects, scene) {
    if (drewObjects) {
      drewObjects.forEach((object) => {
        scene.remove(object);
        object.traverse((child) => {
          this.fadingObjects.delete(child);
          if (child.geometry) {
            child.geometry.dispose();
          }
          if (child.material) {
            const materials = Array.isArray(child.material)
              ? child.material
              : [child.material];
            materials.forEach((material) => material.dispose());
          }
        });
      });
    }
  }

  removeAllElements(scene) {
    this.removeExpiredElements([], scene);
    this.trafficSignals.removeAll(scene);
    this.stopSigns.removeAll(scene);
    this.yieldSigns.removeAll(scene);
  }

  invalidate(scene) {
    this.removeAllElements(scene);
    this.hash = -1;
    this.data = {};
    this.initialized = false;
    this.elementKindsDrawn = '';
    this.forceReload = true;
  }

  removeExpiredElements(elementIds, scene) {
    const newData = {};
    for (const kind in this.data) {
      const drawThisKind = this.shouldDrawObjectOfThisElementKind(kind);
      newData[kind] = [];
      const oldDataOfThisKind = this.data[kind];
      const currentIds = elementIds[kind];
      oldDataOfThisKind.forEach((oldData) => {
        if (drawThisKind && currentIds && currentIds.includes(oldData.id.id)) {
          newData[kind].push(oldData);
        } else {
          this.removeDrewObjects(oldData.drewObjects, scene);
          this.removeDrewText(oldData.text, scene);
        }
      });
    }
    this.data = newData;
  }

  // I do not want to do premature optimization either. Should the
  // performance become an issue, all the diff should be done at the server
  // side. This also means that the server should maintain a state of
  // (possibly) visible elements, presummably in the global store.
  appendMapData(newData, coordinates, scene) {
    for (const kind in newData) {
      if (!newData[kind]) {
        continue;
      }

      if (!this.data[kind]) {
        this.data[kind] = [];
      }

      for (let i = 0; i < newData[kind].length; ++i) {
        switch (kind) {
          case 'lane':
            const lane = newData[kind][i];
            this.data[kind].push(Object.assign(newData[kind][i], {
              drewObjects: this.addLane(lane, coordinates, scene),
              text: this.addLaneId(lane, coordinates, scene),
            }));
            break;
          case 'clearArea':
            this.data[kind].push(Object.assign(newData[kind][i], {
              drewObjects: this.addZone(
                newData[kind][i], colorMapping.YELLOW, coordinates, scene,
              ),
            }));
            break;
          case 'crosswalk':
            this.data[kind].push(Object.assign(newData[kind][i], {
              drewObjects: this.addZone(
                newData[kind][i], colorMapping.PURE_WHITE, coordinates, scene,
              ),
            }));
            break;
          case 'junction':
            this.data[kind].push(Object.assign(newData[kind][i], {
              drewObjects: this.addJunction(newData[kind][i], coordinates, scene),
            }));
            break;
          case 'pncJunction':
            this.data[kind].push(Object.assign(newData[kind][i], {
              drewObjects: this.addZone(
                newData[kind][i], colorMapping.BLUE, coordinates, scene,
              ),
            }));
            break;
          case 'signal':
            this.data[kind].push(Object.assign(newData[kind][i], {
              drewObjects: this.addStopLine(
                newData[kind][i].stopLine, coordinates, scene,
              ),
            }));
            this.trafficSignals.add([newData[kind][i]], coordinates, scene);
            break;
          case 'stopSign':
            this.data[kind].push(Object.assign(newData[kind][i], {
              drewObjects: this.addStopLine(
                newData[kind][i].stopLine, coordinates, scene,
              ),
            }));
            this.stopSigns.add([newData[kind][i]], coordinates, scene);
            break;
          case 'yield':
            this.data[kind].push(Object.assign(newData[kind][i], {
              drewObjects: this.addStopLine(
                newData[kind][i].stopLine, coordinates, scene,
              ),
            }));
            this.yieldSigns.add([newData[kind][i]], coordinates, scene);
            break;
          case 'road':
            const road = newData[kind][i];
            this.data[kind].push(Object.assign(newData[kind][i], {
              drewObjects: this.addRoad(road, coordinates, scene),
            }));
            break;
          case 'parkingSpace':
            this.data[kind].push(Object.assign(newData[kind][i], {
              drewObjects: this.addBorder(
                newData[kind][i], colorMapping.YELLOW, coordinates, scene,
              ),
              text: this.addParkingSpaceId(newData[kind][i], coordinates, scene),
            }));
            break;
          case 'speedBump':
            this.data[kind].push(Object.assign(newData[kind][i], {
              drewObjects: this.addCurve(
                newData[kind][i].position, colorMapping.RED, coordinates, scene,
              ),
            }));
            break;
          default:
            this.data[kind].push(newData[kind][i]);
            break;
        }
      }
    }
    return;
  }

  shouldDrawObjectOfThisElementKind(kind) {
    // Ex: mapping 'lane' to 'showMapLane' option
    const optionName = `showMap${kind[0].toUpperCase()}${kind.slice(1)}`;

    // NOTE: return true if the option is not found
    return STORE.options[optionName] !== false;
  }

  shouldDrawTextOfThisElementKind(kind) {
    // showMapLaneId option controls both laneId and parkingSpaceId
    return STORE.options.showMapLaneId && ['parkingSpace', 'lane'].includes(kind);
  }

  updateText() {
    for (const kind in this.data) {
      const isVisible = this.shouldDrawTextOfThisElementKind(kind);
      this.data[kind].forEach((element) => {
        if (element.text) {
          element.text.visible = isVisible;
        }
      });
    }
  }

  updateIndex(hash, elementIds, scene) {
    if (STORE.hmi.inNavigationMode) {
      MAP_WS.requestRelativeMapData();
    } else {
      this.updateText();

      let newElementKindsDrawn = '';
      for (const kind of Object.keys(elementIds).sort()) {
        if (this.shouldDrawObjectOfThisElementKind(kind)) {
          newElementKindsDrawn += kind;
        }
      }

      if (hash !== this.hash
          || this.elementKindsDrawn !== newElementKindsDrawn
          || this.forceReload) {
        this.hash = hash;
        this.elementKindsDrawn = newElementKindsDrawn;
        if (this.forceReload) {
          // A response requested before the backend reload may arrive on the
          // independent map websocket after MapReloaded. Clear it again and
          // force a full fetch from the newly loaded map.
          this.removeAllElements(scene);
          this.data = {};
        }
        const diff = this.diffMapElements(elementIds, this.data);

        if (!_.isEmpty(diff) || !this.initialized) {
          MAP_WS.requestMapData(diff);
          this.initialized = true;
        }

        this.forceReload = false;

        this.removeExpiredElements(elementIds, scene);

        if (!this.shouldDrawObjectOfThisElementKind('signal')) {
          this.trafficSignals.removeAll(scene);
        } else {
          this.trafficSignals.removeExpired(elementIds.signal, scene);
        }

        if (!this.shouldDrawObjectOfThisElementKind('stopSign')) {
          this.stopSigns.removeAll(scene);
        } else {
          this.stopSigns.removeExpired(elementIds.stopSign, scene);
        }

        if (!this.shouldDrawObjectOfThisElementKind('yield')) {
          this.yieldSigns.removeAll(scene);
        } else {
          this.yieldSigns.removeExpired(elementIds.yield, scene);
        }
      }
    }
    // Do not set zOffset in camera view, since zOffset will affect the accuracy of matching
    // between hdmap and camera image
    const cameraViewEnabled = STORE.options.showCameraView
      && !STORE.options.showRouteEditingBar;
    this.zOffsetFactor = cameraViewEnabled ? 0 : 1;
    this.updateViewMode(cameraViewEnabled);
  }

  update(world) {
    this.trafficSignals.updateTrafficLightStatus(world.perceivedSignal);
  }

  changeSelectedParkingSpaceColor(index, color = 0xff0000) {
    this.data.parkingSpace[index].drewObjects.forEach(mesh => {
      changeMaterial(mesh, color);
    });
  }
}
