import * as THREE from 'three';

const LABEL_SCALE = 2;
const LABEL_PADDING_X = 12;
const LABEL_PADDING_Y = 9;
const LABEL_MIN_WIDTH = 168;
const LABEL_MAX_WIDTH = 360;
const LABEL_CORNER_RADIUS = 8;
const LABEL_FADE_DURATION = 160;
const LABEL_VIEWPORT_MARGIN = 10;
const LABEL_OBSTACLE_GAP = 10;
const LABEL_COLLISION_GAP = 4;
const LABEL_MIN_FOOTPRINT_RADIUS = 10;
const LABEL_MAX_FOOTPRINT_RADIUS = 96;
const METRIC_FONT = '600 12px "Roboto Mono", "SFMono-Regular", monospace';
const ID_FONT = '700 14px "Roboto Mono", "SFMono-Regular", monospace';
const TAG_FONT = '700 10px "Roboto Mono", "SFMono-Regular", monospace';

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(value, maximum));
}

function createRect(centerX, centerY, width, height) {
  return {
    left: centerX - width / 2,
    right: centerX + width / 2,
    top: centerY - height / 2,
    bottom: centerY + height / 2,
  };
}

function expandRect(rect, amount) {
  return {
    left: rect.left - amount,
    right: rect.right + amount,
    top: rect.top - amount,
    bottom: rect.bottom + amount,
  };
}

function getIntersectionArea(first, second) {
  const width = Math.max(
    0,
    Math.min(first.right, second.right) - Math.max(first.left, second.left),
  );
  const height = Math.max(
    0,
    Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top),
  );
  return width * height;
}

function getViewportOverflow(rect, viewportWidth, viewportHeight) {
  return Math.max(0, LABEL_VIEWPORT_MARGIN - rect.left)
    + Math.max(0, rect.right - viewportWidth + LABEL_VIEWPORT_MARGIN)
    + Math.max(0, LABEL_VIEWPORT_MARGIN - rect.top)
    + Math.max(0, rect.bottom - viewportHeight + LABEL_VIEWPORT_MARGIN);
}

function projectToScreen(position, camera, viewportWidth, viewportHeight) {
  const projected = position.clone().project(camera);
  return {
    x: ((projected.x + 1) * viewportWidth) / 2,
    y: ((1 - projected.y) * viewportHeight) / 2,
  };
}

function getCandidateOffsets(labelWidth, labelHeight, footprintRadius) {
  const horizontal = footprintRadius + LABEL_OBSTACLE_GAP + labelWidth / 2;
  const vertical = footprintRadius + LABEL_OBSTACLE_GAP + labelHeight / 2;
  return [
    { x: -horizontal, y: -vertical },
    { x: horizontal, y: -vertical },
    { x: -horizontal, y: vertical },
    { x: horizontal, y: vertical },
    { x: 0, y: -vertical },
    { x: -horizontal, y: 0 },
    { x: horizontal, y: 0 },
    { x: 0, y: vertical },
  ];
}

function drawRoundedRect(context, x, y, width, height, radius) {
  const clampedRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + clampedRadius, y);
  context.lineTo(x + width - clampedRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + clampedRadius);
  context.lineTo(x + width, y + height - clampedRadius);
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - clampedRadius,
    y + height,
  );
  context.lineTo(x + clampedRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - clampedRadius);
  context.lineTo(x, y + clampedRadius);
  context.quadraticCurveTo(x, y, x + clampedRadius, y);
  context.closePath();
}

function colorToCss(color) {
  const threeColor = new THREE.Color(color);
  return `rgb(${Math.round(threeColor.r * 255)}, `
    + `${Math.round(threeColor.g * 255)}, ${Math.round(threeColor.b * 255)})`;
}

function getTextWidth(context, text, font) {
  context.font = font;
  return context.measureText(text).width;
}

function createLabel(scene) {
  const canvas = document.createElement('canvas');
  const texture = new THREE.Texture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.visible = false;
  sprite.renderOrder = 1000;
  scene.add(sprite);

  return {
    canvas,
    texture,
    material,
    sprite,
    signature: '',
    aspectRatio: 1,
    pixelHeight: 48,
    fadeStartedAt: 0,
    anchor: new THREE.Vector3(),
    footprintRadius: 1,
    heading: null,
  };
}

function getMetricText(metrics) {
  return metrics.map((metric) => `${metric.label} ${metric.value}`).join('   ');
}

function renderLabel(label, content, accentColor) {
  const { canvas, texture } = label;
  const context = canvas.getContext('2d');
  const accentCss = colorToCss(accentColor);
  const metricText = getMetricText(content.metrics);
  const textWidths = [];

  if (content.id) {
    textWidths.push(getTextWidth(context, `#${content.id}`, ID_FONT));
  }
  if (metricText) {
    textWidths.push(getTextWidth(context, metricText, METRIC_FONT));
  }
  content.tags.forEach((tag) => {
    textWidths.push(getTextWidth(context, tag, TAG_FONT) + 16);
  });

  const contentWidth = textWidths.length ? Math.max(...textWidths) : LABEL_MIN_WIDTH;
  const logicalWidth = Math.min(
    LABEL_MAX_WIDTH,
    Math.max(LABEL_MIN_WIDTH, Math.ceil(contentWidth + LABEL_PADDING_X * 2)),
  );
  let logicalHeight = LABEL_PADDING_Y * 2;
  if (content.id) {
    logicalHeight += 20;
  }
  if (metricText) {
    logicalHeight += 20;
  }
  logicalHeight += content.tags.length * 18;

  canvas.width = logicalWidth * LABEL_SCALE;
  canvas.height = logicalHeight * LABEL_SCALE;
  context.scale(LABEL_SCALE, LABEL_SCALE);
  context.clearRect(0, 0, logicalWidth, logicalHeight);

  drawRoundedRect(
    context,
    0.5,
    0.5,
    logicalWidth - 1,
    logicalHeight - 1,
    LABEL_CORNER_RADIUS,
  );
  context.fillStyle = 'rgba(7, 15, 24, 0.92)';
  context.fill();
  context.strokeStyle = 'rgba(139, 163, 181, 0.42)';
  context.lineWidth = 1;
  context.stroke();

  drawRoundedRect(context, 1.5, 5, 3, logicalHeight - 10, 1.5);
  context.fillStyle = accentCss;
  context.fill();

  let cursorY = LABEL_PADDING_Y;
  const textX = LABEL_PADDING_X;
  context.textBaseline = 'top';

  if (content.id) {
    context.font = ID_FONT;
    context.fillStyle = '#F5F8FA';
    context.fillText(`#${content.id}`, textX, cursorY);
    cursorY += 20;
  }

  if (metricText) {
    context.font = METRIC_FONT;
    context.fillStyle = '#C9D5DD';
    context.fillText(metricText, textX, cursorY);
    cursorY += 20;
  }

  content.tags.forEach((tag) => {
    context.font = TAG_FONT;
    const tagWidth = Math.min(
      logicalWidth - LABEL_PADDING_X * 2,
      getTextWidth(context, tag, TAG_FONT) + 14,
    );
    drawRoundedRect(context, textX, cursorY, tagWidth, 14, 4);
    context.save();
    context.globalAlpha = 0.16;
    context.fillStyle = accentCss;
    context.fill();
    context.restore();
    context.fillStyle = accentCss;
    context.fillText(tag, textX + 7, cursorY + 2);
    cursorY += 18;
  });

  texture.needsUpdate = true;
  return {
    aspectRatio: logicalWidth / logicalHeight,
    pixelHeight: logicalHeight,
  };
}

export default class ObstacleLabels {
  constructor() {
    this.labels = [];
    this.activeCount = 0;
    this.reducedMotion = window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  beginFrame() {
    this.activeCount = 0;
  }

  update(
    content,
    position,
    accentColor,
    scene,
    footprintRadius = 1,
    heading = null,
  ) {
    if (!content.id && !content.metrics.length && !content.tags.length) {
      return;
    }

    let label = this.labels[this.activeCount];
    if (!label) {
      label = createLabel(scene);
      this.labels.push(label);
    }

    const signature = JSON.stringify({ content, accentColor });
    if (signature !== label.signature) {
      const dimensions = renderLabel(label, content, accentColor);
      label.aspectRatio = dimensions.aspectRatio;
      label.pixelHeight = dimensions.pixelHeight;
      label.signature = signature;
    }

    if (!label.sprite.visible) {
      label.fadeStartedAt = performance.now();
      label.material.opacity = this.reducedMotion ? 1 : 0;
    }
    label.anchor.set(position.x, position.y, position.z);
    label.footprintRadius = Math.max(0.1, footprintRadius);
    label.heading = Number.isFinite(heading) ? heading : null;
    label.sprite.position.copy(label.anchor);
    label.sprite.visible = true;
    this.activeCount += 1;
  }

  endFrame() {
    for (let index = this.activeCount; index < this.labels.length; index += 1) {
      this.labels[index].sprite.visible = false;
    }
  }

  animate(timestamp, camera, viewportHeight) {
    const safeViewportHeight = Math.max(viewportHeight, 1);
    const safeViewportWidth = Math.max(safeViewportHeight * camera.aspect, 1);
    const verticalFov = THREE.Math.degToRad(camera.fov);
    camera.updateMatrixWorld();
    const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const activeLabels = this.labels.filter((labelEntry) => labelEntry.sprite.visible);

    const layoutEntries = activeLabels.map((labelEntry) => {
      const {
        anchor, footprintRadius, pixelHeight, aspectRatio,
      } = labelEntry;
      const distance = anchor.distanceTo(camera.position);
      const worldPerPixel = (
        2 * Math.tan(verticalFov / 2) * distance
      ) / safeViewportHeight;
      const worldHeight = Math.max(
        0.55,
        Math.min(worldPerPixel * pixelHeight, 4.5),
      );
      const renderedPixelHeight = worldHeight / Math.max(worldPerPixel, 0.000001);
      const renderedPixelWidth = renderedPixelHeight * aspectRatio;
      const screenAnchor = projectToScreen(
        anchor,
        camera,
        safeViewportWidth,
        safeViewportHeight,
      );
      const footprintPixels = clamp(
        footprintRadius / Math.max(worldPerPixel, 0.000001),
        LABEL_MIN_FOOTPRINT_RADIUS,
        LABEL_MAX_FOOTPRINT_RADIUS,
      );

      let screenHeading = null;
      if (labelEntry.heading !== null) {
        const headingPoint = anchor.clone();
        headingPoint.x += Math.cos(labelEntry.heading);
        headingPoint.y += Math.sin(labelEntry.heading);
        const projectedHeading = projectToScreen(
          headingPoint,
          camera,
          safeViewportWidth,
          safeViewportHeight,
        );
        const deltaX = projectedHeading.x - screenAnchor.x;
        const deltaY = projectedHeading.y - screenAnchor.y;
        const magnitude = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        if (magnitude > 0.001) {
          screenHeading = {
            x: deltaX / magnitude,
            y: deltaY / magnitude,
          };
        }
      }

      return {
        labelEntry,
        distance,
        worldPerPixel,
        worldHeight,
        width: renderedPixelWidth,
        height: renderedPixelHeight,
        footprintPixels,
        screenAnchor,
        screenHeading,
      };
    }).sort((first, second) => first.distance - second.distance);

    const obstacleRects = layoutEntries.map((entry) => expandRect(
      createRect(
        entry.screenAnchor.x,
        entry.screenAnchor.y,
        entry.footprintPixels * 2,
        entry.footprintPixels * 2,
      ),
      LABEL_COLLISION_GAP,
    ));
    const placedLabelRects = [];

    layoutEntries.forEach((entry) => {
      const {
        labelEntry, width, height, footprintPixels, screenAnchor, screenHeading,
      } = entry;
      const {
        sprite, material, fadeStartedAt, aspectRatio,
      } = labelEntry;

      if (!this.reducedMotion && material.opacity < 1) {
        const elapsed = timestamp - fadeStartedAt;
        material.opacity = Math.min(1, elapsed / LABEL_FADE_DURATION);
      }

      const candidates = getCandidateOffsets(width, height, footprintPixels);
      let bestCandidate = candidates[0];
      let bestRect = null;
      let bestScore = Number.POSITIVE_INFINITY;

      candidates.forEach((candidate, candidateIndex) => {
        const rect = createRect(
          screenAnchor.x + candidate.x,
          screenAnchor.y + candidate.y,
          width,
          height,
        );
        const collisionRect = expandRect(rect, LABEL_COLLISION_GAP);
        const viewportPenalty = getViewportOverflow(
          collisionRect,
          safeViewportWidth,
          safeViewportHeight,
        );
        const obstaclePenalty = obstacleRects.reduce(
          (total, obstacleRect) => total + getIntersectionArea(collisionRect, obstacleRect),
          0,
        );
        const labelPenalty = placedLabelRects.reduce(
          (total, labelRect) => total + getIntersectionArea(collisionRect, labelRect),
          0,
        );
        const candidateMagnitude = Math.sqrt(
          candidate.x * candidate.x + candidate.y * candidate.y,
        );
        const headingAlignment = screenHeading && candidateMagnitude > 0
          ? (candidate.x * screenHeading.x + candidate.y * screenHeading.y)
            / candidateMagnitude
          : 0;
        const directionPenalty = Math.max(0, headingAlignment) * width * height * 0.4;
        const score = viewportPenalty * 100000
          + obstaclePenalty * 40
          + labelPenalty * 80
          + directionPenalty
          + candidateIndex;

        if (score < bestScore) {
          bestScore = score;
          bestCandidate = candidate;
          bestRect = collisionRect;
        }
      });

      placedLabelRects.push(bestRect);
      sprite.position.copy(labelEntry.anchor);
      sprite.position.addScaledVector(
        cameraRight,
        bestCandidate.x * entry.worldPerPixel,
      );
      sprite.position.addScaledVector(
        cameraUp,
        -bestCandidate.y * entry.worldPerPixel,
      );
      sprite.scale.set(entry.worldHeight * aspectRatio, entry.worldHeight, 1);
    });
  }

  dispose(scene) {
    this.labels.forEach((label) => {
      scene.remove(label.sprite);
      if (label.material) {
        label.material.dispose();
      }
      if (label.texture) {
        label.texture.dispose();
      }
    });
    this.labels = [];
    this.activeCount = 0;
  }
}
