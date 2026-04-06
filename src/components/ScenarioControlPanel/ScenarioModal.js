import React, { Component } from 'react';
import { observer } from 'mobx-react';
import ScenarioService from 'store/websocket/scenario_service';

@observer
export default class ScenarioModal extends Component {
  constructor(props) {
    super(props);
    this.state = {
      activeTab: 'local',
    };
  }

  componentDidMount() {
    ScenarioService.fetchLocalScenarios();
  }

  handleLoad = (scenario) => {
    this.props.onLoad(scenario);
  };

  renderCard = (scenario) => {
    return (
      <div key={scenario.scenarioId} className="modal-scenario-card" onClick={() => this.handleLoad(scenario)}>
        <div className="title">{scenario.scenarioName}</div>
        <div className="subtitle">Map: {scenario.mapName}</div>
      </div>
    );
  };

  render() {
    const { store, onClose } = this.props;
    const { localScenarios, marketScenarios } = store.scenarioStore;
    const { activeTab } = this.state;
    
    const scenarios = activeTab === 'local' ? localScenarios : marketScenarios;

    return (
      <div className="scenario-modal-overlay">
        <div className="scenario-modal-content">
          <div className="modal-header">
            <h3>Load Scenario</h3>
            <button className="close-btn" onClick={onClose}>&times;</button>
          </div>
          <div className="modal-tabs">
            <span className={activeTab === 'local' ? 'active' : ''} onClick={() => this.setState({activeTab: 'local'})}>Local</span>
            <span className={activeTab === 'market' ? 'active' : ''} onClick={() => this.setState({activeTab: 'market'})}>Cloud</span>
          </div>
          <div className="modal-list">
            {scenarios && scenarios.length > 0 ? (
              scenarios.map(this.renderCard)
            ) : (
              <p style={{padding: 20, textAlign: 'center'}}>No scenarios found.</p>
            )}
          </div>
        </div>
      </div>
    );
  }
}
