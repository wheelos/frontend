import * as THREE from 'three';

const LABEL_SCALE = 2;
const LABEL_PADDING_X = 12;
const LABEL_PADDING_Y = 9;
const LABEL_MIN_WIDTH = 168;
const LABEL_MAX_WIDTH = 360;
const LABEL_CORNER_RADIUS = 8;
const LABEL_FADE_DURATION = 160;
const METRIC_FONT = '600 12px "Roboto Mono", "SFMono-Regular", monospace';
const ID_FONT = '700 14px "Roboto Mono", "SFMono-Regular", monospace';
const TAG_FONT = '700 10px "Roboto Mono", "SFMono-Regular", monospace';

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

  update(content, position, accentColor, scene) {
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
    label.sprite.position.set(position.x, position.y, position.z);
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
    const verticalFov = THREE.Math.degToRad(camera.fov);
    this.labels.forEach((labelEntry) => {
      const {
        sprite, material, fadeStartedAt, pixelHeight, aspectRatio,
      } = labelEntry;
      if (!sprite.visible) {
        return;
      }

      if (!this.reducedMotion && material.opacity < 1) {
        const elapsed = timestamp - fadeStartedAt;
        material.opacity = Math.min(1, elapsed / LABEL_FADE_DURATION);
      }

      const distance = sprite.position.distanceTo(camera.position);
      const visibleWorldHeight = (
        2
        * Math.tan(verticalFov / 2)
        * distance
        * pixelHeight
      ) / safeViewportHeight;
      const worldHeight = Math.max(0.55, Math.min(visibleWorldHeight, 4.5));
      sprite.scale.set(worldHeight * aspectRatio, worldHeight, 1);
    });
  }
}
