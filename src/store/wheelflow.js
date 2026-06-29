import { observable, action } from 'mobx';

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

  @action updateStatus(status) {
    this.status = {
      ...this.status,
      ...status,
    };
  }
}
