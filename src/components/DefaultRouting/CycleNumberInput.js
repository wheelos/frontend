import React from 'react';

import RoutingDialog from 'components/common/RoutingDialog';

export default class CycleNumberInput extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      cycleNumber: 1,
      isCycling: false,
      error: '',
    };
    this.sendCycleDefaultRouting = this.sendCycleDefaultRouting.bind(this);
    this.cancelSendDefaultRouting = this.cancelSendDefaultRouting.bind(this);
    this.toggleCycle = this.toggleCycle.bind(this);
    this.handleInput = (event) => {
      this.setState({
        cycleNumber: event.target.value,
        error: '',
      });
    };
  }

  toggleCycle() {
    this.setState((prevState) => ({
      isCycling: !prevState.isCycling,
      error: '',
    }));
  }

  sendCycleDefaultRouting() {
    const { routeEditingManager, options } = this.props;
    const routingName = routeEditingManager.currentDefaultRouting;
    const routingPoints = routeEditingManager.defaultRoutings[routingName];
    if (!routingPoints || routingPoints.length === 0) {
      this.setState({
        error: 'This saved route is no longer available. Close the dialog and select it again.',
      });
      return;
    }

    let success = false;
    if (this.state.isCycling) {
      const cycleNumber = parseInt(this.state.cycleNumber, 10);
      if (Number.isNaN(cycleNumber) || cycleNumber < 1) {
        this.setState({ error: 'Enter a cycle count of 1 or greater.' });
        return;
      }
      if (!routeEditingManager.checkCycleRoutingAvailable()) {
        this.setState({
          error: `The route end must be more than ${
            routeEditingManager.defaultRoutingDistanceThreshold
          } m from the vehicle to form a loop.`,
        });
        return;
      }
      success = routeEditingManager.sendCycleRoutingRequest(cycleNumber);
    } else {
      success = routeEditingManager.sendRoutingRequest(false, routingName);
    }

    if (!success) {
      this.setState({
        error: 'The routing request was not sent. Check the connection and try again.',
      });
      return;
    }

    options.showCycleNumberInput = false;
  }

  cancelSendDefaultRouting() {
    const { routeEditingManager, options } = this.props;
    routeEditingManager.removeAllRoutingPoints();
    options.showCycleNumberInput = false;
  }

  render() {
    const { routeEditingManager } = this.props;
    const routingName = routeEditingManager.currentDefaultRouting;
    const routingPoints = routeEditingManager.defaultRoutings[routingName] || [];
    const actions = (
      <React.Fragment>
        <button
          type="button"
          className="routing-dialog-button secondary"
          onClick={this.cancelSendDefaultRouting}
        >
          Cancel
        </button>
        <button
          type="button"
          className="routing-dialog-button primary"
          onClick={this.sendCycleDefaultRouting}
        >
          Send routing
          <span aria-hidden="true">→</span>
        </button>
      </React.Fragment>
    );

    return (
      <RoutingDialog
        eyebrow="DEFAULT ROUTING"
        title="Send saved routing"
        description="Review the saved route before sending it to the routing service."
        error={this.state.error}
        onClose={this.cancelSendDefaultRouting}
        actions={actions}
      >
        <div className="routing-dialog-summary">
          <div>
            <span>Route</span>
            <strong>{routingName}</strong>
          </div>
          <div>
            <span>Waypoints</span>
            <strong>{routingPoints.length}</strong>
          </div>
        </div>
        <div className="routing-dialog-option">
          <div>
            <strong>Cycle routing</strong>
            <span>Send this route with a cycle count.</span>
          </div>
          <button
            type="button"
            className={`routing-dialog-toggle ${this.state.isCycling ? 'active' : ''}`}
            role="switch"
            aria-checked={this.state.isCycling}
            aria-label="Enable cycle routing"
            onClick={this.toggleCycle}
          >
            <span />
          </button>
        </div>
        {this.state.isCycling && (
          <label className="routing-dialog-field compact" htmlFor="routing-cycle-count">
            <span>Cycle count</span>
            <input
              id="routing-cycle-count"
              min="1"
              type="number"
              value={this.state.cycleNumber}
              onChange={this.handleInput}
            />
          </label>
        )}
      </RoutingDialog>
    );
  }
}
