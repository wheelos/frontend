/* eslint-disable react/prop-types, react/jsx-filename-extension */
/* eslint-disable jsx-a11y/label-has-associated-control */
import React from 'react';
import { inject, observer } from 'mobx-react';

import WS from 'store/websocket';

import './style.scss';

const MAPS = ['Town03', 'Town05', 'Town10HD'];
const SCENARIOS = ['EmptyRoad', 'UrbanLoop'];
const SENSOR_PRESETS = ['FrontCameraLidar', 'BEV6CameraLidar'];

function SelectRow({
  label,
  value,
  disabled,
  options,
  onChange,
}) {
  return (
    <label className="wheelflow-row">
      <span>{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function StatusItem({ label, value }) {
  let normalized = value;
  if (value === true) {
    normalized = 'Running';
  } else if (value === false) {
    normalized = 'Stopped';
  }
  return (
    <div className="wheelflow-status-item">
      <span>{label}</span>
      <strong>{normalized}</strong>
    </div>
  );
}

@inject('store') @observer
export default class WheelFlow extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      mapName: 'Town03',
      scenarioName: 'EmptyRoad',
      sensorPreset: 'FrontCameraLidar',
    };
  }

  componentDidMount() {
    WS.requestWheelFlowStatus();
    this.timer = setInterval(() => WS.requestWheelFlowStatus(), 1000);
  }

  componentWillUnmount() {
    clearInterval(this.timer);
  }

  requestPayload() {
    const {
      mapName,
      scenarioName,
      sensorPreset,
    } = this.state;
    return {
      mapName,
      scenarioName,
      sensorPreset,
      simulationMode: 'PnCGroundTruth',
    };
  }

  handleStart() {
    const { mapName } = this.state;
    const { modes } = this.props.store.hmi;
    const wheelFlowMode = modes.find(
      (mode) => mode.toLowerCase().replace(/\s/g, '') === 'wheelflow',
    ) || 'Wheelflow';
    WS.changeSetupMode(wheelFlowMode);
    WS.changeMap(mapName);
    WS.startWheelFlow(this.requestPayload());
  }

  render() {
    const {
      mapName,
      scenarioName,
      sensorPreset,
    } = this.state;
    const { store } = this.props;
    const { status } = store.wheelflow;
    const busy = !['IDLE', 'READY', 'RUNNING', 'ERROR', 'STOPPED'].includes(status.stage);
    const running = status.bridgeRunning || status.stage === 'RUNNING' || status.stage === 'READY';
    const controlsDisabled = busy || running;
    const sensorsEnabled = !!status.sensorDataEnabled;

    return (
      <div className="wheelflow-panel">
        <div className="wheelflow-grid">
          <section className="wheelflow-column">
            <div className="wheelflow-section-title">Configuration</div>
            <div className="wheelflow-content">
              <SelectRow
                label="Map"
                value={mapName}
                disabled={controlsDisabled}
                options={MAPS}
                onChange={(nextMapName) => this.setState({ mapName: nextMapName })}
              />
              <SelectRow
                label="Scenario"
                value={scenarioName}
                disabled={controlsDisabled}
                options={SCENARIOS}
                onChange={(nextScenarioName) => (
                  this.setState({ scenarioName: nextScenarioName })
                )}
              />
              <SelectRow
                label="Sensor Preset"
                value={sensorPreset}
                disabled={controlsDisabled}
                options={SENSOR_PRESETS}
                onChange={(nextSensorPreset) => (
                  this.setState({ sensorPreset: nextSensorPreset })
                )}
              />
            </div>
          </section>

          <section className="wheelflow-column">
            <div className="wheelflow-section-title">Actions</div>
            <div className="wheelflow-actions">
              <button
                type="button"
                disabled={busy || running}
                onClick={() => this.handleStart()}
              >
                Start
              </button>
              <button type="button" onClick={() => WS.stopWheelFlow()}>Stop</button>
              <button
                type="button"
                disabled={busy && status.stage !== 'ERROR'}
                onClick={() => WS.resetWheelFlow()}
              >
                Reset
              </button>
              <button
                type="button"
                disabled={!running || busy}
                onClick={() => WS.setWheelFlowSensors(!sensorsEnabled)}
              >
                {sensorsEnabled ? 'Disable Sensors' : 'Enable Sensors'}
              </button>
              <button
                type="button"
                disabled={!running}
                onClick={() => WS.engageWheelFlow()}
              >
                Engage
              </button>
              <button
                type="button"
                disabled={!running}
                onClick={() => WS.disengageWheelFlow()}
              >
                Disengage
              </button>
            </div>
          </section>

          <section className="wheelflow-column">
            <div className="wheelflow-section-title">Status</div>
            <div className="wheelflow-status-grid">
              <StatusItem label="Server" value={status.wheelflowServerRunning} />
              <StatusItem label="RPC" value={status.wheelflowRpcConnected ? 'Connected' : 'Disconnected'} />
              <StatusItem label="World" value={status.worldLoaded ? 'Loaded' : 'Not Loaded'} />
              <StatusItem label="Ego" value={status.egoSpawned ? 'Spawned' : 'Not Spawned'} />
              <StatusItem label="Sensor Data" value={sensorsEnabled ? 'Enabled' : 'Disabled'} />
              <StatusItem label="Sensors" value={status.sensorsReady ? 'Ready' : 'Not Ready'} />
              <StatusItem label="NPC" value={status.npcReady ? 'Ready' : 'Not Ready'} />
              <StatusItem label="Bridge" value={status.bridgeRunning} />
              <StatusItem label="Stage" value={status.stage} />
              <StatusItem label="Map" value={status.mapName} />
              <StatusItem label="Scenario" value={status.scenarioName} />
              <StatusItem label="GT Obstacles" value={Number(status.gtObstacleCount || status.perceptionObstacleCount || 0)} />
              <StatusItem label="Fallback GT" value={status.perceptionFallbackActive ? 'Publishing' : 'Standby'} />
              <StatusItem label="Frame" value={Number(status.simFrame || 0)} />
            </div>
          </section>

          <section className="wheelflow-column wheelflow-log-column">
            <div className="wheelflow-section-title">Error Log</div>
            <pre className="wheelflow-error-log">{status.lastError || 'No errors'}</pre>
          </section>
        </div>
      </div>
    );
  }
}
