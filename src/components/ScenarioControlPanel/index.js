import React, { Component } from 'react';
import { observer, inject } from 'mobx-react';
import ScenarioService from 'store/websocket/scenario_service';
import WS from 'store/websocket';
import Switch from 'react-switch';
import ScenarioModal from './ScenarioModal';
import EditScenario from './EditScenario';
import './style.scss';

@inject('store')
@observer
export default class ScenarioControlPanel extends Component {
  constructor(props) {
    super(props);
    this.state = {
      isEditMode: false,
      showLoadModal: false,
    };
  }

  componentDidMount() {
    ScenarioService.fetchLocalScenarios();
  }

  handleToggleSimControl = (checked) => {
    const { store } = this.props;
    WS.toggleSimControl(checked);
    if (!checked) {
      WS.getDymaticModelList();
      WS.switchToDefaultDynamicModel();
    }
    store.handleOptionToggle('enableSimControl');
  };

  handleOpenLoadModal = () => {
    this.setState({ showLoadModal: true });
  }

  handleCloseLoadModal = () => {
    this.setState({ showLoadModal: false });
  }

  handleLoadScenario = (scenario) => {
    const { store } = this.props;
    store.scenarioStore.setCurrentScenario(scenario);
    ScenarioService.changeScenario(scenario.scenarioId, scenario.scenarioName, scenario.mapName);
    this.setState({ showLoadModal: false });
  };

  handlePlayPause = () => {
    const { store } = this.props;
    const currentSrc = store.scenarioStore.currentScenario;
    if (!currentSrc) return;

    if (store.scenarioStore.simulationStatus === 'running') {
      // Typically we pause, for now mapped to stop/reset
      ScenarioService.resetSimulation();
      store.scenarioStore.updateSimulationStatus('stopped');
    } else {
      ScenarioService.startSimulation(currentSrc.scenarioId);
      store.scenarioStore.updateSimulationStatus('running');
    }
  };

  handleReset = () => {
    const { store } = this.props;
    ScenarioService.resetSimulation();
    store.scenarioStore.updateSimulationStatus('stopped');
  };

  toggleEditMode = () => {
    this.setState({ isEditMode: !this.state.isEditMode });
  }

  renderMainMode() {
    const { store } = this.props;
    const currentScenario = store.scenarioStore.currentScenario;
    const isRunning = store.scenarioStore.simulationStatus === 'running';

    return (
      <div className="main-scenario-mode">
        <div className="sim-control-toggle">
          <label>Enable Sim Control</label>
          <Switch
            onChange={this.handleToggleSimControl}
            checked={store.options.enableSimControl || false}
            onColor="#00FF88"
            offColor="#888"
            height={20}
            width={40}
          />
        </div>

        {store.options.enableSimControl && (
          <div className="scenario-controls">
             <div className="info-box">
                <div className="title">Current Scenario</div>
                <div className="name">{currentScenario ? currentScenario.scenarioName : 'None Selected'}</div>
             </div>

             <div className="control-group action-buttons">
                <button className="dark-btn" onClick={this.toggleEditMode}>
                  Edit Scenario
                </button>
                <button className="dark-btn" onClick={this.handleOpenLoadModal}>
                  Load Scenario
                </button>
             </div>

             {currentScenario && (
               <div className="playback-group">
                 <div className="play-pause-row">
                   <button className={`play-btn ${isRunning ? 'running' : ''}`} onClick={this.handlePlayPause}>
                     {isRunning ? '|| Pause' : '▶ Play'}
                   </button>
                 </div>
                 <div className="reset-row">
                   <button className="reset-btn" onClick={this.handleReset}>
                     ↺ Reset
                   </button>
                 </div>
               </div>
             )}
          </div>
        )}
      </div>
    );
  }

  render() {
    const { store } = this.props;
    const { isEditMode, showLoadModal } = this.state;

    return (
      <div className="scenario-control-panel-container">
        {isEditMode ? (
          <EditScenario store={store} onRun={this.toggleEditMode} />
        ) : (
          this.renderMainMode()
        )}

        {showLoadModal && (
          <ScenarioModal store={store} onClose={this.handleCloseLoadModal} onLoad={this.handleLoadScenario} />
        )}
      </div>
    );
  }
}
