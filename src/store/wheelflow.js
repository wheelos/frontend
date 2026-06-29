import { observable, action } from 'mobx';

import RENDERER from 'renderer';
import WS from 'store/websocket';

const DEFAULT_CUSTOM_OBSTACLE_DRAFT = {
  type: 'Vehicle',
  motionType: 'Static',
  speedMps: 3.0,
  endBehavior: 'StopAtEnd',
  heading: 0,
};

export default class WheelFlow {
  @observable status = {
    stage: 'IDLE',
    mapName: 'Town03',
    scenarioName: 'EmptyRoad',
    sensorPreset: 'FrontCameraLidar',
    simulationMode: 'PnCGroundTruth',
    wheelflowServerRunning: false,
    wheelflowRpcConnected: false,
    worldLoaded: false,
    egoSpawned: false,
    sensorsReady: false,
    sensorDataEnabled: false,
    sensorBridgeRunning: false,
    npcReady: false,
    bridgeRunning: false,
    apolloModulesReady: false,
    lastError: '',
    simFps: 0,
    lidarFps: 0,
    cameraFps: 0,
    perceptionFps: 0,
    perceptionObstacleCount: 0,
    gtObstacleCount: 0,
    perceptionFallbackActive: false,
    localizationFps: 0,
    chassisFps: 0,
    controlLatencyMs: 0,
    simFrame: 0,
    simTimeSec: 0,
  };

  @observable customObstaclePanelOpen = false;

  @observable customObstacleMode = 'Select';

  @observable customObstacleDraft = { ...DEFAULT_CUSTOM_OBSTACLE_DRAFT };

  @observable customObstacles = [];

  @observable selectedCustomObstacleId = null;

  @action updateStatus(status) {
    this.status = {
      ...this.status,
      ...status,
    };
  }

  @action updateCustomObstacles(obstacles) {
    this.customObstacles = obstacles || [];
    if (
      this.selectedCustomObstacleId
      && !this.customObstacles.some((obstacle) => obstacle.id === this.selectedCustomObstacleId)
    ) {
      this.selectedCustomObstacleId = null;
      if (this.customObstacleMode !== 'Place') {
        this.customObstacleMode = 'Select';
      }
    }
    RENDERER.updateCustomObstacles(
      this.customObstacles,
      this.selectedCustomObstacleId,
      this.customObstacleMode,
      this.customObstacleDraft,
    );
  }

  @action openCustomObstaclePanel() {
    this.customObstaclePanelOpen = true;
    this.customObstacleMode = 'Select';
    RENDERER.enableCustomObstacleEditing();
    RENDERER.updateCustomObstacles(
      this.customObstacles,
      this.selectedCustomObstacleId,
      this.customObstacleMode,
      this.customObstacleDraft,
    );
    WS.requestWheelFlowCustomObstacles();
  }

  @action closeCustomObstaclePanel() {
    this.customObstaclePanelOpen = false;
    this.customObstacleMode = 'Select';
    RENDERER.disableCustomObstacleEditing();
  }

  @action toggleCustomObstaclePanel() {
    if (this.customObstaclePanelOpen) {
      this.closeCustomObstaclePanel();
    } else {
      this.openCustomObstaclePanel();
    }
  }

  @action setCustomObstacleMode(mode) {
    this.customObstacleMode = mode;
    RENDERER.updateCustomObstacles(
      this.customObstacles,
      this.selectedCustomObstacleId,
      this.customObstacleMode,
      this.customObstacleDraft,
    );
  }

  @action updateCustomObstacleDraft(patch) {
    this.customObstacleDraft = {
      ...this.customObstacleDraft,
      ...patch,
    };
    RENDERER.updateCustomObstacles(
      this.customObstacles,
      this.selectedCustomObstacleId,
      this.customObstacleMode,
      this.customObstacleDraft,
    );
  }

  @action selectCustomObstacle(id) {
    this.selectedCustomObstacleId = id;
    if (id && this.customObstacleMode !== 'EditPath') {
      this.customObstacleMode = 'Select';
    }
    RENDERER.updateCustomObstacles(
      this.customObstacles,
      this.selectedCustomObstacleId,
      this.customObstacleMode,
      this.customObstacleDraft,
    );
  }

  selectedCustomObstacle() {
    return this.customObstacles.find(
      (obstacle) => obstacle.id === this.selectedCustomObstacleId,
    );
  }

  @action
  addCustomObstacleAt(point) {
    const obstacle = {
      ...this.customObstacleDraft,
      x: point.x,
      y: point.y,
      z: point.z || 0,
      waypoints: [],
      enabled: true,
    };
    WS.addWheelFlowCustomObstacle(obstacle);
    this.customObstacleMode = 'Select';
  }

  @action
  updateSelectedCustomObstacle(patch) {
    const selected = this.selectedCustomObstacle();
    if (!selected) {
      return;
    }
    WS.updateWheelFlowCustomObstacle({
      ...selected,
      ...patch,
    });
  }

  @action
  deleteSelectedCustomObstacle() {
    if (!this.selectedCustomObstacleId) {
      return;
    }
    WS.deleteWheelFlowCustomObstacle(this.selectedCustomObstacleId);
    this.selectedCustomObstacleId = null;
    this.customObstacleMode = 'Select';
  }

  @action
  focusCustomObstacle(id) {
    this.selectCustomObstacle(id);
    RENDERER.focusCustomObstacle(id);
  }
}
