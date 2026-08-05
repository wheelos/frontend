import * as THREE from 'three';
import Stats from 'stats.js';

import Styles from 'styles/main.scss';

import Coordinates from 'renderer/coordinates';
import AutoDrivingCar from 'renderer/adc';
import CheckPoints from 'renderer/check_points.js';
import Ground from 'renderer/ground';
import TileGround from 'renderer/tileground';
import Map from 'renderer/map';
import PlanningTrajectory from 'renderer/trajectory.js';
import PlanningStatus from 'renderer/status.js';
import PerceptionObstacles from 'renderer/obstacles.js';
import Decision from 'renderer/decision.js';
import Prediction from 'renderer/prediction.js';
import Routing from 'renderer/routing.js';
import RoutingEditor from 'renderer/routing_editor.js';
import Gnss from 'renderer/gnss.js';
import OccDebugOverlay from 'renderer/occ_debug.js';
import PluginSceneRenderer from 'renderer/plugin_scene.js';
import PointCloud from 'renderer/point_cloud.js';
import STORE from 'store';

const _ = require('lodash');

const THEME_SCENE_COLORS = {
  dark: 0x07131F,
  light: 0xF2F5F7,
};

const CAMERA_TRANSITION_DURATION = 360;
const ROUTE_CAMERA_TRANSITION_DURATION = 680;

function easeInOutCubic(progress) {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - ((-2 * progress + 2) ** 3) / 2;
}

class Renderer {
  constructor() {
    // Disable antialias for mobile devices.
    const useAntialias = !this.isMobileDevice();

    this.coordinates = new Coordinates();
    this.renderer = new THREE.WebGLRenderer({
      antialias: useAntialias,
      // Transparent background
      alpha: true,
    });
    this.scene = new THREE.Scene();
    this.sceneThemeMode = 'dark';
    if (OFFLINE_PLAYBACK) {
      this.scene.background = new THREE.Color(
        THEME_SCENE_COLORS.dark,
      );
    }

    // The dimension of the scene
    this.dimension = {
      width: 0,
      height: 0,
    };

    // The ground.
    this.ground = (PARAMETERS.ground.type === 'tile' || OFFLINE_PLAYBACK)
      ? new TileGround(this.renderer) : new Ground();

    // The map.
    this.map = new Map();

    // The main autonomous driving car.
    this.adc = new AutoDrivingCar('adc', this.scene);

    // The car that projects the starting point of the planning trajectory
    this.planningAdc = OFFLINE_PLAYBACK ? null : new AutoDrivingCar('planningAdc', this.scene);

    // The shadow localization
    this.shadowAdc = new AutoDrivingCar('shadowAdc', this.scene);

    // The planning trajectory.
    this.planningTrajectory = new PlanningTrajectory();

    // The planning status
    this.planningStatus = new PlanningStatus();

    // The perception obstacles.
    this.perceptionObstacles = new PerceptionObstacles({
      lineThickness: 3,
    });

    // The decision.
    this.decision = new Decision();

    // The prediction.
    this.prediction = new Prediction();

    // The routing.
    this.routing = new Routing();

    // The route editor
    this.routingEditor = new RoutingEditor();
    this.routingEditor.setMap(this.map);
    this.routingEditor.setCoordinates(this.coordinates);
    this.routingPoint = null;

    // Distinguish between drawing point and drawing arrow
    this.startMove = false;

    // The GNSS/GPS
    this.gnss = new Gnss();

    this.occDebug = new OccDebugOverlay();

    // Declarative scene boundary for plugins. Raw Three.js objects stay
    // private to Dreamview so renderer changes do not leak into extensions.
    this.pluginScene = new PluginSceneRenderer(this);
    this.lastWorld = null;

    this.pointCloud = new PointCloud();

    this.checkPoints = OFFLINE_PLAYBACK && new CheckPoints(this.coordinates, this.scene);

    // The Performance Monitor
    this.stats = null;
    if (PARAMETERS.debug.performanceMonitor) {
      this.stats = new Stats();
      this.stats.showPanel(1);
      this.stats.domElement.style.position = 'absolute';
      this.stats.domElement.style.top = null;
      this.stats.domElement.style.bottom = '0px';
      document.body.appendChild(this.stats.domElement);
    }

    // Geolocation of the mouse
    this.geolocation = { x: 0, y: 0 };

    // FPS tracking for the point cloud metrics panel.
    this._fpsFrameCount = 0;
    this._fpsLastTimestamp = performance.now();

    this.lastCameraPov = null;
    this.cameraTransition = null;
    this.routeEditingCameraActive = false;
    this.initialized = false;
    this.prefersReducedMotion = Boolean(
      window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
  }

  initialize(canvasId, width, height, options, cameraData) {
    this.options = options;
    this.cameraData = cameraData;
    this.canvasId = canvasId;
    this.sceneThemeMode = THEME_SCENE_COLORS[options.themeMode]
      ? options.themeMode
      : 'dark';
    this.map.updateTheme(this.sceneThemeMode);
    if (this.ground.updateTheme) {
      this.ground.updateTheme(this.sceneThemeMode);
    }
    this.map.updateViewMode(options.showCameraView && !options.showRouteEditingBar);

    const container = document.getElementById(canvasId);
    if (this.initialized) {
      // Scene is temporarily unmounted while a plugin App is open. Reattach
      // the existing WebGL canvas when returning instead of constructing a
      // second camera and another full light rig in the same scene. Duplicate
      // lights progressively overexpose the vehicle material from blue to
      // white on every page round trip.
      this.updateDimension(width, height);
      this.renderer.setPixelRatio(window.devicePixelRatio);
      if (container && this.renderer.domElement.parentNode !== container) {
        container.appendChild(this.renderer.domElement);
      }
      this.updateSceneTheme(this.sceneThemeMode);
      return;
    }

    // Camera
    this.viewAngle = PARAMETERS.camera.viewAngle;
    this.viewDistance = (
      PARAMETERS.camera.laneWidth
            * PARAMETERS.camera.laneWidthToViewDistanceRatio);
    this.camera = new THREE.PerspectiveCamera(
      PARAMETERS.camera[this.options.cameraAngle].fov,
      width / height,
      PARAMETERS.camera[this.options.cameraAngle].near,
      PARAMETERS.camera[this.options.cameraAngle].far,
    );
    this.cameraPoseHelper = new THREE.PerspectiveCamera();
    this.camera.name = 'camera';
    this.scene.add(this.camera);

    this.updateDimension(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    container.appendChild(this.renderer.domElement);

    const ambient = new THREE.AmbientLight(0x71808C, 0.58);
    const hemisphere = new THREE.HemisphereLight(0xDCEEFF, 0x101820, 0.72);
    const directionalLight = new THREE.DirectionalLight(0xFFFFFF, 0.92);
    const fillLight = new THREE.DirectionalLight(0x78BFFF, 0.32);
    directionalLight.position.set(-3, -4, 8).normalize();
    fillLight.position.set(4, 3, 5).normalize();

    // The orbit axis of the OrbitControl depends on camera's up vector
    // and can only be set during creation of the controls. Thus,
    // setting camera up here. Note: it's okay if the camera.up doesn't
    // match the point of view setting, the value will be adjusted during
    // each update cycle.
    this.camera.up.set(0, 0, 1);

    // Orbit control for moving map
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enabled = false;

    // handler for route editing with mouse down events
    this.onMouseDownHandler = this.editRoute.bind(this);
    this.onMouseMoveHandler = this.onMouseMoveHandler.bind(this);
    this.onMouseUpHandler = this.onMouseUpHandler.bind(this);

    this.scene.add(ambient);
    this.scene.add(hemisphere);
    this.scene.add(directionalLight);
    this.scene.add(fillLight);

    this.initialized = true;

    // TODO maybe add sanity check.

    // Actually start the animation.
    this.animate();
  }

  maybeInitializeOffest(x, y, forced_update = false) {
    if (!this.coordinates.isInitialized() || forced_update) {
      this.coordinates.initialize(x, y);
    }
  }

  updateSceneTheme(themeMode) {
    this.sceneThemeMode = THEME_SCENE_COLORS[themeMode] ? themeMode : 'dark';
    if (!this.options.showCameraView || this.options.showRouteEditingBar) {
      this.scene.background = new THREE.Color(
        THEME_SCENE_COLORS[this.sceneThemeMode],
      );
    }
    this.map.updateTheme(themeMode);
    if (this.ground.updateTheme) {
      this.ground.updateTheme(this.sceneThemeMode);
    }
  }

  updateDimension(width, height) {
    if (width < Styles.MIN_MAIN_VIEW_WIDTH / 2 && this.dimension.width >= width) {
      // Reach minimum, do not update camera/renderer dimension anymore.
      return;
    }

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);

    this.dimension.width = width;
    this.dimension.height = height;
  }

  getCameraPose(target, pov) {
    const cameraParameters = PARAMETERS.camera[pov];
    const position = new THREE.Vector3();
    const lookAt = new THREE.Vector3();
    const up = new THREE.Vector3(0, 0, 1);
    const quaternion = new THREE.Quaternion();

    switch (pov) {
      case 'Default':
      case 'Near': {
        const distanceRatio = pov === 'Near' ? 0.5 : 1;
        const deltaX = this.viewDistance * distanceRatio
          * Math.cos(target.rotation.y)
          * Math.cos(this.viewAngle);
        const deltaY = this.viewDistance * distanceRatio
          * Math.sin(target.rotation.y)
          * Math.cos(this.viewAngle);
        const deltaZ = this.viewDistance * distanceRatio * Math.sin(this.viewAngle);
        position.set(
          target.position.x - deltaX,
          target.position.y - deltaY,
          target.position.z + deltaZ,
        );
        lookAt.set(
          target.position.x + deltaX,
          target.position.y + deltaY,
          0,
        );
        break;
      }
      case 'Overhead': {
        const deltaY = this.viewDistance * 0.5
          * Math.sin(target.rotation.y)
          * Math.cos(this.viewAngle);
        const deltaZ = this.viewDistance * 2 * Math.sin(this.viewAngle);
        position.set(
          target.position.x,
          target.position.y + deltaY,
          (target.position.z + deltaZ) * 2,
        );
        lookAt.set(target.position.x, target.position.y + deltaY, 0);
        if (this.coordinates.systemName === 'FLU') {
          up.set(1, 0, 0);
        } else {
          up.set(0, 1, 0);
        }
        break;
      }
      case 'Map':
        position.set(target.position.x, target.position.y, 50);
        lookAt.set(target.position.x, target.position.y, 0);
        if (this.coordinates.systemName === 'FLU') {
          up.set(1, 0, 0);
        }
        break;
      case 'CameraView': {
        const cameraData = this.cameraData.get();
        const offsetPosition = this.coordinates.applyOffset(cameraData.position);
        position.copy(offsetPosition);
        up.copy(this.camera.up);
        quaternion.setFromEuler(new THREE.Euler(
          cameraData.rotation.x + Math.PI,
          -cameraData.rotation.y,
          -cameraData.rotation.z,
        ));
        break;
      }
      default:
        position.copy(this.camera.position);
        up.copy(this.camera.up);
        quaternion.copy(this.camera.quaternion);
        break;
    }

    if (pov !== 'CameraView' && ['Default', 'Near', 'Overhead', 'Map'].includes(pov)) {
      this.cameraPoseHelper.position.copy(position);
      this.cameraPoseHelper.up.copy(up);
      this.cameraPoseHelper.lookAt(lookAt);
      quaternion.copy(this.cameraPoseHelper.quaternion);
    }

    return {
      position,
      lookAt,
      up,
      quaternion,
      fov: cameraParameters.fov,
      near: cameraParameters.near,
      far: cameraParameters.far,
    };
  }

  applyCameraPose(pose) {
    this.camera.position.copy(pose.position);
    this.camera.up.copy(pose.up);
    this.camera.quaternion.copy(pose.quaternion);
    this.camera.fov = pose.fov;
    this.camera.near = pose.near;
    this.camera.far = pose.far;
    this.camera.updateProjectionMatrix();
  }

  activateOrbitControls(pose, enableRotate) {
    this.controls.target.copy(pose.lookAt);
    this.controls.target0 = pose.lookAt.clone();
    this.controls.position0 = pose.position.clone();
    this.controls.zoom0 = this.camera.zoom;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 4000;
    this.controls.minPolarAngle = 0;
    this.controls.maxPolarAngle = Math.PI / 2;
    this.controls.enabled = true;
    this.controls.enableRotate = enableRotate;
    this.controls.update();
  }

  enableOrbitControls(enableRotate) {
    const pose = this.getCameraPose(this.adc.mesh, 'Map');
    this.applyCameraPose(pose);
    this.activateOrbitControls(pose, enableRotate);
    this.lastCameraPov = 'Map';
    this.cameraTransition = null;
  }

  updateCameraImage() {
    const image = document.getElementById('camera-image');
    if (image && this.cameraData.imageSrcData) {
      image.src = this.cameraData.imageSrcData;
    }
  }

  adjustCamera(target, pov, timestamp) {
    const routeEditingActive = this.routingEditor.isInEditingMode();
    const routeModeChanged = this.routeEditingCameraActive !== routeEditingActive;
    const targetPov = routeEditingActive ? 'Map' : pov;
    const pose = this.getCameraPose(target, targetPov);
    const povChanged = this.lastCameraPov !== targetPov;
    this.routeEditingCameraActive = routeEditingActive;

    if (targetPov === 'CameraView') {
      this.updateCameraImage();
    }

    if (povChanged && targetPov === 'Map' && this.controls.enabled) {
      this.controls.enableRotate = !routeEditingActive;
      this.lastCameraPov = targetPov;
      this.cameraTransition = null;
      return;
    }

    if (this.lastCameraPov === null || this.prefersReducedMotion) {
      this.controls.enabled = false;
      this.applyCameraPose(pose);
      if (targetPov === 'Map') {
        this.activateOrbitControls(pose, !routeEditingActive);
      }
      this.lastCameraPov = targetPov;
      this.cameraTransition = null;
      return;
    }

    if (povChanged) {
      this.controls.enabled = false;
      this.cameraTransition = {
        pov: targetPov,
        startedAt: timestamp,
        duration: routeModeChanged
          ? ROUTE_CAMERA_TRANSITION_DURATION
          : CAMERA_TRANSITION_DURATION,
        position: this.camera.position.clone(),
        quaternion: this.camera.quaternion.clone(),
        up: this.camera.up.clone(),
        fov: this.camera.fov,
      };
      this.lastCameraPov = targetPov;
    }

    if (this.cameraTransition && this.cameraTransition.pov === targetPov) {
      const elapsed = timestamp - this.cameraTransition.startedAt;
      const progress = Math.min(1, elapsed / this.cameraTransition.duration);
      const easedProgress = routeModeChanged || this.cameraTransition.duration
        === ROUTE_CAMERA_TRANSITION_DURATION
        ? easeInOutCubic(progress)
        : 1 - ((1 - progress) ** 3);
      this.camera.position
        .copy(this.cameraTransition.position)
        .lerp(pose.position, easedProgress);
      this.camera.quaternion
        .copy(this.cameraTransition.quaternion)
        .slerp(pose.quaternion, easedProgress);
      this.camera.up
        .copy(this.cameraTransition.up)
        .lerp(pose.up, easedProgress)
        .normalize();
      this.camera.fov = this.cameraTransition.fov
        + (pose.fov - this.cameraTransition.fov) * easedProgress;
      this.camera.near = pose.near;
      this.camera.far = pose.far;
      this.camera.updateProjectionMatrix();

      if (progress >= 1) {
        this.cameraTransition = null;
        this.applyCameraPose(pose);
        if (targetPov === 'Map') {
          this.activateOrbitControls(pose, !routeEditingActive);
        }
      }
      return;
    }

    if (targetPov !== 'Map') {
      this.controls.enabled = false;
      this.applyCameraPose(pose);
    } else if (this.controls.enabled) {
      this.controls.enableRotate = !routeEditingActive;
    }
  }

  enableRouteEditing() {
    this.controls.enableRotate = false;
    this.routingEditor.enableEditingMode();

    document.getElementById(this.canvasId).addEventListener('mousedown',
      this.onMouseDownHandler,
      false);
    document.getElementById(this.canvasId).addEventListener('mouseup',
      this.onMouseUpHandler,
      false);
    document.getElementById(this.canvasId).addEventListener('mousemove',
      this.onMouseMoveHandler,
      false);
  }

  disableRouteEditing() {
    this.routingEditor.disableEditingMode(this.scene);

    const element = document.getElementById(this.canvasId);
    if (element) {
      element.removeEventListener('mousedown',
        this.onMouseDownHandler,
        false);
      element.removeEventListener('mouseup',
        this.onMouseUpHandler,
        false);
      element.removeEventListener('mousemove',
        this.onMouseMoveHandler,
        false);
      this.startMove = false;
      this.routingPoint = null;
    }
  }

  addDefaultEndPoint(points) {
    for (let i = 0; i < points.length; i++) {
      this.routingEditor.addRoutingPoint(points[i], this.coordinates, this.scene, true);
    }
  }

  addDefaultRouting(routingName) {
    return this.routingEditor.addDefaultRouting(routingName, this.coordinates);
  }

  getRoutingPointCount() {
    return this.routingEditor.getRoutePointCount();
  }

  removeInvalidRoutingPoint(pointId, error) {
    const index = this.routingEditor.removeInvalidRoutingPoint(pointId, error, this.scene);
    if (index !== -1) {
      this.map.changeSelectedParkingSpaceColor(index, 0xDAA520);
    }
  }

  setParkingInfo(info) {
    this.routingEditor.setParkingInfo(info);
  }

  removeAllRoutingPoints() {
    const indexArr = this.routingEditor.removeAllRoutePoints(this.scene);
    if (!_.isEmpty(indexArr)) {
      indexArr.forEach(item => {
        this.map.changeSelectedParkingSpaceColor(item, 0xDAA520);
      });
    }
  }

  removeLastRoutingPoint() {
    const index = this.routingEditor.removeLastRoutingPoint(this.scene);
    if (index !== -1) {
      this.map.changeSelectedParkingSpaceColor(index, 0xDAA520);
    }
  }

  sendRoutingRequest(points = []) {
    return this.routingEditor.sendRoutingRequest(this.adc.mesh.position,
      this.adc.mesh.rotation.y,
      this.coordinates, points);
  }

  sendCycleRoutingRequest(defaultRoutingName, points, cycleNumber) {
    return this.routingEditor.sendCycleRoutingRequest(
      defaultRoutingName,
      points,
      cycleNumber,
      this.adc.mesh.position,
      this.adc.mesh.rotation.y,
      this.coordinates);
  }

  editRoute(event) {
    // Distinguish between operating on the screen and
    // selecting points on the screen
    if (event.target && !_.isEqual('CANVAS', event.target.tagName)) {
      return;
    }
    if (!this.routingEditor.isInEditingMode()
        || event.button !== THREE.MOUSE.LEFT) {
      return;
    }

    // return if the ground or coordinates is not loaded yet
    if (!this.coordinates.isInitialized() || !this.ground.mesh) {
      return;
    }

    this.routingPoint = this.getGeolocation(event);
  }

  onMouseMoveHandler(event) {
    if (this.routingPoint) {
      this.routingEditor.drawRoutingPointArrow(
        this.getGeolocation(event), this.routingPoint, this.coordinates, this.scene, this.startMove,
      );
      this.startMove = true;
    }
  }

  onMouseUpHandler() {
    if (this.routingPoint) {
      const selectedParkingSpaceIndex = this.routingEditor.addRoutingPoint(
        this.routingPoint, this.coordinates, this.scene, false,
      );
      if (selectedParkingSpaceIndex !== -1) {
        this.map.changeSelectedParkingSpaceColor(selectedParkingSpaceIndex);
      }
    }
    this.routingPoint = null;
    this.startMove = false;
  }

  // Render one frame. This supports the main draw/render loop.
  render(timestamp = performance.now()) {
    // TODO should also return when no need to update.
    if (!this.coordinates.isInitialized()) {
      return;
    }

    // Return if the car mesh is not loaded yet, or the ground is not
    // loaded yet.
    if (!this.adc.mesh || !this.ground.mesh) {
      return;
    }

    // Upon the first time in render() it sees ground mesh loaded,
    // added it to the scene.
    if (this.ground.type === 'default' && !this.ground.initialized) {
      this.ground.initialize(this.coordinates);
      this.ground.mesh.name = 'ground';
      this.scene.add(this.ground.mesh);
    }

    if (this.pointCloud.initialized === false) {
      this.pointCloud.initialize();
    }

    const cameraViewActive = this.options.showCameraView
      && !this.options.showRouteEditingBar;
    if (cameraViewActive) {
      this.scene.background = null;
    } else {
      const sceneColor = THEME_SCENE_COLORS[this.sceneThemeMode];
      if (!this.scene.background
          || !this.scene.background.isColor
          || this.scene.background.getHex() !== sceneColor) {
        this.scene.background = new THREE.Color(sceneColor);
      }
    }

    this.map.updateViewMode(cameraViewActive);
    this.map.animate(timestamp);
    this.adjustCamera(this.adc.mesh, this.options.cameraAngle, timestamp);
    this.perceptionObstacles.animate(timestamp, this.camera, this.dimension.height);
    this.pluginScene.animate(timestamp);
    this.renderer.render(this.scene, this.camera);
  }

  animate() {
    requestAnimationFrame(() => {
      this.animate();
    });

    // Track FPS and push to the metrics store once per second.
    this._fpsFrameCount += 1;
    const now = performance.now();
    const elapsed = now - this._fpsLastTimestamp;
    if (elapsed >= 1000) {
      STORE.pointCloudMetrics.updateFps(
        Math.round(this._fpsFrameCount * 1000 / elapsed),
      );
      this._fpsFrameCount = 0;
      this._fpsLastTimestamp = now;
    }

    if (this.stats) {
      this.stats.update();
    }
    this.render(now);
  }

  updateWorld(world) {
    this.lastWorld = world;
    const adcPose = world.autoDrivingCar;
    this.adc.update(this.coordinates, adcPose);
    if (!_.isNumber(adcPose.positionX) || !_.isNumber(adcPose.positionY)) {
      console.error(`Invalid ego car position: ${adcPose.positionX}, ${adcPose.positionY}!`);
      return;
    }

    this.adc.updateRssMarker(world.isRssSafe);
    this.ground.update(world, this.coordinates, this.scene);
    this.planningTrajectory.update(world, world.planningData, this.coordinates, this.scene);
    this.planningStatus.update(world.planningData, this.coordinates, this.scene);

    this.perceptionObstacles.update(world, this.coordinates, this.scene);
    this.decision.update(world, this.coordinates, this.scene);
    this.prediction.update(world, this.coordinates, this.scene);
    this.updateRouting(world.routingTime, world.routePath);
    this.gnss.update(world, this.coordinates, this.scene);
    this.map.update(world);
    this.occDebug.update(world, this.coordinates, this.scene);
    this.pluginScene.redrawAll();

    const planningAdcPose = _.get(world, 'planningData.initPoint.pathPoint');
    if (this.planningAdc && planningAdcPose) {
      const pose = {
        positionX: planningAdcPose.x,
        positionY: planningAdcPose.y,
        heading: planningAdcPose.theta,
      };
      this.planningAdc.update(this.coordinates, pose);
    }

    const shadowLocalizationPose = world.shadowLocalization;
    if (shadowLocalizationPose) {
      const shadowAdcPose = {
        positionX: shadowLocalizationPose.positionX,
        positionY: shadowLocalizationPose.positionY,
        heading: shadowLocalizationPose.heading,
      };
      this.shadowAdc.update(this.coordinates, shadowAdcPose);
    }
  }

  updateRouting(routingTime, routePath) {
    this.routing.update(routingTime, routePath, this.coordinates, this.scene);
  }

  updateGroundImage(mapName) {
    this.ground.updateImage(mapName);
  }

  updateGroundMetadata(mapInfo) {
    this.ground.initialize(mapInfo);
  }

  updateMap(newData, removeOldMap = false) {
    if (removeOldMap) {
      this.map.removeAllElements(this.scene);
    }
    this.map.appendMapData(newData, this.coordinates, this.scene);
  }

  invalidateMap() {
    this.map.invalidate(this.scene);
  }

  updatePointCloud(pointCloud) {
    if (!this.coordinates.isInitialized() || !this.adc.mesh) {
      return;
    }
    this.pointCloud.update(pointCloud, this.adc.mesh, this.scene);
    STORE.pointCloudMetrics.updatePointCount(this.pointCloud.getPointCount());
  }

  createPluginLayer(id, options) {
    return this.pluginScene.createLayer(id, options);
  }

  removePluginLayer(id) {
    this.pluginScene.removeLayer(id);
  }

  removePluginLayers(prefix) {
    this.pluginScene.removeLayers(prefix);
  }

  upsertPluginEntities(layerId, entities) {
    this.pluginScene.upsertEntities(layerId, entities);
  }

  replacePluginEntities(layerId, entities) {
    this.pluginScene.replaceEntities(layerId, entities);
  }

  removePluginEntities(layerId, entityIds) {
    this.pluginScene.removeEntities(layerId, entityIds);
  }

  clearPluginLayer(layerId) {
    this.pluginScene.clearLayer(layerId);
  }

  setPluginLayerVisible(layerId, visible) {
    this.pluginScene.setLayerVisible(layerId, visible);
  }

  pluginWorldToScreen(point) {
    return this.pluginScene.worldToScreen(point);
  }

  pickPluginEntity(event) {
    return this.pluginScene.pickEntity(event);
  }

  fitPluginBounds(bounds) {
    this.pluginScene.fitBounds(bounds);
  }

  updateMapIndex(hash, elementIds, radius) {
    if (!this.routingEditor.isInEditingMode()
            || PARAMETERS.routingEditor.radiusOfMapRequest === radius) {
      this.map.updateIndex(hash, elementIds, this.scene);
    }
  }

  isMobileDevice() {
    return navigator.userAgent.match(/Android/i)
            || navigator.userAgent.match(/webOS/i)
            || navigator.userAgent.match(/iPhone/i)
            || navigator.userAgent.match(/iPad/i)
            || navigator.userAgent.match(/iPod/i);
  }

  getGeolocation(event) {
    if (!this.coordinates.isInitialized()) {
      return;
    }

    const canvasPosition = event.currentTarget.getBoundingClientRect();

    const vector = new THREE.Vector3(
      ((event.clientX - canvasPosition.left) / this.dimension.width) * 2 - 1,
      -((event.clientY - canvasPosition.top) / this.dimension.height) * 2 + 1,
      0,
    );

    vector.unproject(this.camera);

    const direction = vector.sub(this.camera.position).normalize();
    const distance = -this.camera.position.z / direction.z;
    const pos = this.camera.position.clone().add(direction.multiplyScalar(distance));
    const geo = this.coordinates.applyOffset(pos, true);

    return geo;
  }

  // Debugging purpose function:
  //  For detecting names of the lanes that your mouse cursor points to.
  getMouseOverLanes(event) {
    const canvasPosition = event.currentTarget.getBoundingClientRect();
    const mouse = new THREE.Vector3(
      ((event.clientX - canvasPosition.left) / this.dimension.width) * 2 - 1,
      -((event.clientY - canvasPosition.top) / this.dimension.height) * 2 + 1,
      0,
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);
    const objects = this.map.data.lane.reduce(
      (result, current) => result.concat(current.drewObjects), []);
    const intersects = raycaster.intersectObjects(objects);
    const names = intersects.map((intersect) => intersect.object.name);
    return names;
  }

  checkCycleRoutingAvailable(points, threshold) {
    return this.routingEditor.checkCycleRoutingAvailable(points,
      this.adc.mesh.position, threshold);
  }
}

const RENDERER = new Renderer();

export default RENDERER;
