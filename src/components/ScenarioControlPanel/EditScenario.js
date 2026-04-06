import React, { Component } from 'react';
import { observer } from 'mobx-react';
import WS from 'store/websocket';

@observer
export default class EditScenario extends Component {
  constructor(props) {
    super(props);
    this.state = {
      showClearOptions: false
    };
  }

  handleMapChange = (e) => {
    WS.changeMap(e.target.value);
  }

  handleSave = () => {
    alert('Scenario saved! (Mock)');
  }

  handleClearAll = () => {
    alert('Cleared all obstacles and road! (Mock)');
  }

  render() {
    const { store, onRun } = this.props;
    const { hmi } = store;
    const currentScenario = store.scenarioStore.currentScenario;

    return (
      <div className="edit-scenario-panel">
        <div className="edit-info">
          <h3>{currentScenario ? currentScenario.scenarioName : 'Untitled'}</h3>
          <span className="subtitle">Last Saved: Unsaved</span>
        </div>

        <div className="edit-map">
          <label>Map:</label>
          <select value={hmi.currentMap || (currentScenario && currentScenario.mapName)} onChange={this.handleMapChange}>
            {hmi.maps.map(mapName => (
              <option key={mapName} value={mapName}>{mapName}</option>
            ))}
          </select>
        </div>

        <div className="edit-actions">
           <button className="action-btn" onClick={() => alert('Edit Road')}><i className="fa fa-map" /> Road</button>
           <button className="action-btn" onClick={() => alert('Edit Static Obstacles')}><i className="fa fa-cube" /> Static Obstacles</button>
           <button className="action-btn" onClick={() => alert('Edit Dynamic Obstacles')}><i className="fa fa-car" /> Dynamic Obstacles</button>
        </div>

        <div className="edit-clear">
          <button className="danger-btn" onClick={() => this.setState({showClearOptions: !this.state.showClearOptions})}>
            Clear...
          </button>
          {this.state.showClearOptions && (
            <div className="clear-options">
               <button onClick={this.handleClearAll}>All</button>
               <button>Dynamic</button>
               <button>Static</button>
               <button>Road</button>
            </div>
          )}
        </div>

        <div className="edit-save-run">
          <button className="success-btn" onClick={this.handleSave} title="Save Scenario">
             <i className="fa fa-save" /> Save
          </button>
          
          <button className="run-btn block-btn" onClick={onRun}>
            <i className="fa fa-play" /> Run
          </button>
        </div>
      </div>
    );
  }
}
