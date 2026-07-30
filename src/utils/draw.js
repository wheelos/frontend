import * as THREE from 'three';
import ThreeLine2D from 'three-line-2d';
import ThreeLine2DBasicShader from 'three-line-2d/shaders/basic';
import { copyProperty } from './misc';

const _ = require('lodash');

const DELTA_Z_OFFSET = 0.04;
const Line = ThreeLine2D(THREE);
const BasicShader = ThreeLine2DBasicShader(THREE);
const textureLoader = new THREE.TextureLoader();

function createLineGeometry(points) {
  const geometry = new THREE.Geometry();
  points.forEach((point) => {
    geometry.vertices.push(new THREE.Vector3(point.x, point.y, point.z || 0));
  });
  geometry.computeBoundingSphere();
  return geometry;
}

export function addOffsetZ(mesh, value) {
  if (value) {
    const zOffset = value * DELTA_Z_OFFSET;
    mesh.position.z += zOffset;
  }
}

export function drawImage(img, width, height, x = 0, y = 0, z = 0) {
  const material = new THREE.MeshBasicMaterial(
    {
      map: textureLoader.load(img),
      transparent: true,
      depthWrite: false,
    },
  );
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.material.side = THREE.DoubleSide;
  mesh.position.set(x, y, z);
  mesh.overdraw = true;

  return mesh;
}

export function drawDashedLineFromPoints(
  points, color = 0xff0000, linewidth = 1, dashSize = 4, gapSize = 2,
  zOffset = 0, opacity = 1, matrixAutoUpdate = true,
) {
  const geometry = createLineGeometry(points);
  geometry.computeLineDistances();
  const material = new THREE.LineDashedMaterial({
    color,
    dashSize,
    linewidth,
    gapSize,
    transparent: true,
    opacity,
  });
  const mesh = new THREE.Line(geometry, material);
  addOffsetZ(mesh, zOffset);
  mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = matrixAutoUpdate;
  if (!matrixAutoUpdate) {
    mesh.updateMatrix();
  }
  return mesh;
}

export function drawCircle(radius, material, segments = 32) {
  const geometry = new THREE.CircleGeometry(radius, segments);
  const circleMesh = new THREE.Mesh(geometry, material);
  return circleMesh;
}

export function drawEllipse(aRadius, bRadius, material) {
  const path = new THREE.Shape();
  path.absellipse(0, 0, aRadius, bRadius, 0, Math.PI * 2, false, 0);
  const geometry = new THREE.ShapeBufferGeometry(path);
  const ellipse = new THREE.Mesh(geometry, material);
  return ellipse;
}

export function drawThickBandFromPoints(
  points, thickness = 0.5, color = 0xffffff, opacity = 1, zOffset = 0,
) {
  const geometry = Line(points.map((p) => [p.x, p.y]));
  const material = new THREE.ShaderMaterial(BasicShader({
    side: THREE.DoubleSide,
    diffuse: color,
    thickness,
    opacity,
    transparent: true,
  }));
  const mesh = new THREE.Mesh(geometry, material);
  addOffsetZ(mesh, zOffset);
  return mesh;
}

function normalizePolyline(points) {
  if (!points || points.length < 2) {
    return [];
  }

  const normalized = [];
  points.forEach((point) => {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      return;
    }

    const normalizedPoint = new THREE.Vector3(
      point.x,
      point.y,
      Number.isFinite(point.z) ? point.z : 0,
    );
    const previous = normalized[normalized.length - 1];
    const deltaX = previous ? previous.x - normalizedPoint.x : 0;
    const deltaY = previous ? previous.y - normalizedPoint.y : 0;
    if (!previous || deltaX * deltaX + deltaY * deltaY > 0.000001) {
      normalized.push(normalizedPoint);
    }
  });
  return normalized;
}

function getLineNormal(points, index) {
  const previousIndex = Math.max(0, index - 1);
  const nextIndex = Math.min(points.length - 1, index + 1);
  const previousDirection = new THREE.Vector2(
    points[index].x - points[previousIndex].x,
    points[index].y - points[previousIndex].y,
  );
  const nextDirection = new THREE.Vector2(
    points[nextIndex].x - points[index].x,
    points[nextIndex].y - points[index].y,
  );

  if (previousDirection.lengthSq() > 0) {
    previousDirection.normalize();
  }
  if (nextDirection.lengthSq() > 0) {
    nextDirection.normalize();
  }

  let direction = previousDirection.add(nextDirection);
  if (direction.lengthSq() < 0.000001) {
    direction = nextDirection.lengthSq() > 0
      ? nextDirection.clone()
      : previousDirection.clone();
  }
  direction.normalize();
  return new THREE.Vector2(-direction.y, direction.x);
}

function buildRibbonData(points, width) {
  const normalized = normalizePolyline(points);
  if (normalized.length < 2) {
    return { positions: [], indices: [] };
  }

  const halfWidth = width / 2;
  const positions = [];
  const indices = [];

  normalized.forEach((point, index) => {
    const normal = getLineNormal(normalized, index);
    let miterLength = halfWidth;

    if (index > 0 && index < normalized.length - 1) {
      const nextDirection = new THREE.Vector2(
        normalized[index + 1].x - point.x,
        normalized[index + 1].y - point.y,
      ).normalize();
      const nextNormal = new THREE.Vector2(-nextDirection.y, nextDirection.x);
      const denominator = Math.abs(normal.dot(nextNormal));
      miterLength = Math.min(halfWidth / Math.max(denominator, 0.35), width * 1.25);
    }

    positions.push(
      point.x + normal.x * miterLength,
      point.y + normal.y * miterLength,
      point.z,
      point.x - normal.x * miterLength,
      point.y - normal.y * miterLength,
      point.z,
    );

    if (index < normalized.length - 1) {
      const vertexIndex = index * 2;
      indices.push(
        vertexIndex,
        vertexIndex + 1,
        vertexIndex + 2,
        vertexIndex + 2,
        vertexIndex + 1,
        vertexIndex + 3,
      );
    }
  });

  return { positions, indices };
}

function createBandMesh(ribbonData, color, opacity, zOffset, matrixAutoUpdate) {
  const geometry = new THREE.BufferGeometry();
  geometry.addAttribute(
    'position',
    new THREE.Float32BufferAttribute(ribbonData.positions, 3),
  );
  geometry.setIndex(ribbonData.indices);
  geometry.computeBoundingSphere();

  const material = new THREE.MeshBasicMaterial({
    color,
    side: THREE.DoubleSide,
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity >= 1,
  });
  const mesh = new THREE.Mesh(geometry, material);
  addOffsetZ(mesh, zOffset);
  mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = matrixAutoUpdate;
  if (!matrixAutoUpdate) {
    mesh.updateMatrix();
  }
  return mesh;
}

export function drawPolylineBandFromPoints(
  points, width = 0.1, color = 0xffffff, zOffset = 0,
  opacity = 1, matrixAutoUpdate = true,
) {
  return createBandMesh(
    buildRibbonData(points, width),
    color,
    opacity,
    zOffset,
    matrixAutoUpdate,
  );
}

export function drawDashedBandFromPoints(
  points, width = 0.1, color = 0xffffff, dashSize = 1.2,
  gapSize = 0.8, zOffset = 0, opacity = 1, matrixAutoUpdate = true,
) {
  const normalized = normalizePolyline(points);
  const dashLines = [];
  let dashLine = normalized.length ? [normalized[0].clone()] : [];
  let drawingDash = true;
  let patternRemaining = dashSize;

  for (let index = 0; index < normalized.length - 1; index += 1) {
    let current = normalized[index].clone();
    const segmentEnd = normalized[index + 1];
    let segmentRemaining = current.distanceTo(segmentEnd);

    while (segmentRemaining > 0.000001) {
      const step = Math.min(segmentRemaining, patternRemaining);
      const ratio = step / segmentRemaining;
      const next = current.clone().lerp(segmentEnd, ratio);

      if (drawingDash) {
        if (!dashLine.length) {
          dashLine.push(current.clone());
        }
        dashLine.push(next.clone());
      }

      current = next;
      segmentRemaining -= step;
      patternRemaining -= step;

      if (patternRemaining <= 0.000001) {
        if (drawingDash && dashLine.length > 1) {
          dashLines.push(dashLine);
        }
        drawingDash = !drawingDash;
        patternRemaining = drawingDash ? dashSize : gapSize;
        dashLine = drawingDash ? [current.clone()] : [];
      }
    }
  }

  if (drawingDash && dashLine.length > 1) {
    dashLines.push(dashLine);
  }

  const ribbonData = { positions: [], indices: [] };
  dashLines.forEach((line) => {
    const dashData = buildRibbonData(line, width);
    const vertexOffset = ribbonData.positions.length / 3;
    ribbonData.positions.push(...dashData.positions);
    ribbonData.indices.push(...dashData.indices.map((index) => index + vertexOffset));
  });

  return createBandMesh(
    ribbonData,
    color,
    opacity,
    zOffset,
    matrixAutoUpdate,
  );
}

export function offsetPolylinePoints(points, distance) {
  const normalized = normalizePolyline(points);
  return normalized.map((point, index) => {
    const normal = getLineNormal(normalized, index);
    return new THREE.Vector3(
      point.x + normal.x * distance,
      point.y + normal.y * distance,
      point.z,
    );
  });
}

function normalizePolygonRing(points) {
  const ring = normalizePolyline(points);
  if (ring.length > 2 && ring[0].distanceToSquared(ring[ring.length - 1]) < 0.000001) {
    ring.pop();
  }
  return ring;
}

export function drawPolygonSurfaceFromRings(
  contourPoints, holePoints = [],
  material = new THREE.MeshBasicMaterial({ color: 0x1a2732 }),
  zOffset = 0, matrixAutoUpdate = false,
  uvWorldSize = 10,
) {
  const contour = normalizePolygonRing(contourPoints);
  if (contour.length < 3) {
    return null;
  }

  const contourVectors = contour.map((point) => new THREE.Vector2(point.x, point.y));
  if (!THREE.ShapeUtils.isClockWise(contourVectors)) {
    contour.reverse();
    contourVectors.reverse();
  }

  const holes = holePoints
    .map(normalizePolygonRing)
    .filter((ring) => ring.length >= 3);
  const holeVectors = holes.map((ring) => {
    let vectors = ring.map((point) => new THREE.Vector2(point.x, point.y));
    if (THREE.ShapeUtils.isClockWise(vectors)) {
      ring.reverse();
      vectors = vectors.reverse();
    }
    return vectors;
  });

  const faces = THREE.ShapeUtils.triangulateShape(contourVectors, holeVectors);
  if (!faces.length) {
    return null;
  }

  const vertices = contour.concat(...holes);
  const positions = [];
  const uvs = [];
  const safeUvWorldSize = Math.max(0.001, uvWorldSize);
  vertices.forEach((point) => {
    positions.push(point.x, point.y, point.z);
    uvs.push(point.x / safeUvWorldSize, point.y / safeUvWorldSize);
  });

  const geometry = new THREE.BufferGeometry();
  geometry.addAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.addAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex([].concat(...faces));
  geometry.computeBoundingSphere();

  const mesh = new THREE.Mesh(geometry, material);
  addOffsetZ(mesh, zOffset);
  mesh.matrixAutoUpdate = matrixAutoUpdate;
  mesh.frustumCulled = false;
  if (!matrixAutoUpdate) {
    mesh.updateMatrix();
  }
  return mesh;
}

export function drawSegmentsFromPoints(
  points, color = 0xff0000, linewidth = 1, zOffset = 0,
  matrixAutoUpdate = true, transparent = false, opacity = 1,
) {
  const geometry = createLineGeometry(points);
  const material = new THREE.LineBasicMaterial({
    color,
    linewidth,
    transparent,
    opacity,
  });
  const pathLine = new THREE.Line(geometry, material);
  addOffsetZ(pathLine, zOffset);
  pathLine.frustumCulled = false;
  pathLine.matrixAutoUpdate = matrixAutoUpdate;
  if (matrixAutoUpdate === false) {
    pathLine.updateMatrix();
  }
  return pathLine;
}

export function drawSolidPolygonFace(
  color = 0xff0000, zOffset = 0,
  matrixAutoUpdate = true, transparent = true, opacity = 0.8,
) {
  const geometry = new THREE.PlaneGeometry(1, 1);
  const material = new THREE.MeshBasicMaterial({
    color,
    side: THREE.DoubleSide,
    transparent,
    opacity,
  });
  const rect = new THREE.Mesh(geometry, material);
  addOffsetZ(rect, zOffset);
  rect.matrixAutoUpdate = matrixAutoUpdate;
  if (matrixAutoUpdate === false) {
    rect.updateMatrix();
  }
  return rect;
}

function addOutlineToObject(object, objectGeometry, color, thickness = 1, opacity = 1) {
  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(objectGeometry),
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      shadowSide: THREE.DoubleSide,
      depthTest: false,
      linewidth: thickness,
    }),
  );
  object.add(outline);
}

export function drawSolidBox(dimension, color, linewidth) {
  const geometry = new THREE.CubeGeometry(dimension.x, dimension.y, dimension.z);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.8,
  });
  const box = new THREE.Mesh(geometry, material);
  addOutlineToObject(box, geometry, color, linewidth);
  return box;
}

export function drawBox(dimension, color, linewidth) {
  const geometry = new THREE.CubeGeometry(dimension.x, dimension.y, dimension.z);
  const material = new THREE.MeshBasicMaterial({ color });
  const cube = new THREE.Mesh(geometry, material);
  const box = new THREE.BoxHelper(cube);
  box.material.linewidth = linewidth;
  return box;
}

export function drawDashedBox(dimension, color, linewidth, dashSize = 0.01, gapSize = 0.02) {
  let geometry = new THREE.CubeGeometry(dimension.x, dimension.y, dimension.z);
  geometry = new THREE.EdgesGeometry(geometry);
  geometry = new THREE.Geometry().fromBufferGeometry(geometry);
  geometry.computeLineDistances();
  const material = new THREE.LineDashedMaterial({
    color,
    linewidth,
    dashSize,
    gapSize,
  });
  const cube = new THREE.LineSegments(geometry, material);
  return cube;
}

export function drawArrow(length, linewidth, conelength, conewidth, color, thickBand = false) {
  const end = new THREE.Vector3(0, length, 0);
  const begin = new THREE.Vector3(0, 0, 0);
  const left = new THREE.Vector3(conewidth / 2, length - conelength, 0);
  const right = new THREE.Vector3(-conewidth / 2, length - conelength, 0);

  const arrow = (thickBand)
    ? drawThickBandFromPoints([begin, end, left, right, end], 0.3, color)
    : drawSegmentsFromPoints([begin, end, left, end, right], color, linewidth, 1);
  return arrow;
}

export function getShapeGeometryFromPoints(points, bezierCurve = false) {
  const shape = new THREE.Shape();
  if (bezierCurve) {
    shape.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 2; i += 1) {
      shape.bezierCurveTo(points[i].x, points[i].y,
        points[i + 1].x, points[i + 1].y,
        points[i + 2].x, points[i + 2].y);
    }
    shape.bezierCurveTo(_.takeRight(points, 2).concat(
      [{ x: points[0].x, y: points[0].y }],
    ));
    shape.bezierCurveTo(_.takeRight(points, 1).concat(
      [{ x: points[0].x, y: points[0].y },
        { x: points[1].x, y: points[1].y }],
    ));
  } else {
    shape.fromPoints(points);
  }
  return new THREE.ShapeGeometry(shape);
}

export function drawShapeFromPoints(points,
  material = new THREE.MeshBasicMaterial({ color: 0xff0000 }),
  bezierCurve = false, order = 0, matrixAutoUpdate = true) {
  const geometry = getShapeGeometryFromPoints(points, bezierCurve);
  const mesh = new THREE.Mesh(geometry, material);
  addOffsetZ(mesh, order);
  mesh.matrixAutoUpdate = matrixAutoUpdate;
  if (!matrixAutoUpdate) {
    mesh.updateMatrix();
  }
  return mesh;
}

export function disposeMeshGroup(mesh) {
  if (!mesh) {
    return;
  }

  mesh.traverse((child) => {
    if (child.geometry !== undefined) {
      child.geometry.dispose();
      child.material.dispose();
    }
  });
}

export function disposeMesh(mesh) {
  if (!mesh) {
    return;
  }

  mesh.geometry.dispose();
  mesh.material.dispose();
}

export function changeMaterial(mesh, color = 0xff0000, linewidth = 2,
  transparent = false, opacity = 1) {
  if (!mesh) {
    return;
  }
  mesh.material.dispose();
  const Material = mesh.isMesh ? THREE.MeshBasicMaterial : THREE.LineBasicMaterial;
  const properties = {
    color,
    transparent,
    opacity,
  };
  if (mesh.isMesh) {
    properties.side = THREE.DoubleSide;
  } else {
    properties.linewidth = linewidth;
  }
  mesh.material = new Material(properties);
}

export function drawRoutingPointArrow(origin, color, heading, length = 3) {
  const position = new THREE.Vector3(origin.x, origin.y, 0);
  const arrowMesh = drawArrow(length, 3, 0.5, 0.5, color, true);
  arrowMesh.rotation.set(0, 0, -Math.PI / 2);
  copyProperty(arrowMesh.position, position);
  arrowMesh.rotation.set(0, 0, -(Math.PI / 2 - heading));
  return arrowMesh;
}
