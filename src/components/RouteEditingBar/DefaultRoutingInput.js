import React from 'react';
import _ from 'lodash';

import RoutingDialog from 'components/common/RoutingDialog';

export default class DefaultRoutingInput extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      routingName: '',
      error: '',
    };

    this.saveDefaultRouting = this.saveDefaultRouting.bind(this);
    this.removeDefaultRouting = this.removeDefaultRouting.bind(this);
    this.handleNameChange = this.handleNameChange.bind(this);
  }

  saveDefaultRouting() {
    const { routeEditingManager, options } = this.props;
    const routingName = this.state.routingName.trim();
    if (_.isEmpty(routingName)) {
      this.setState({ error: 'Enter a name for this saved routing.' });
      return;
    }

    if (routeEditingManager.getRoutingPointCount() < 1) {
      this.setState({
        error: 'Add at least one routing point before saving.',
      });
      return;
    }

    if (routeEditingManager.addDefaultRouting(routingName)) {
      options.showDefaultRoutingInput = false;
      routeEditingManager.removeAllRoutingPoints();
      return;
    }

    this.setState({
      error: 'The routing service is not ready. Keep this dialog open and try again.',
    });
  }

  removeDefaultRouting() {
    const { routeEditingManager, options } = this.props;
    routeEditingManager.removeAllRoutingPoints();
    options.showDefaultRoutingInput = false;
  }

  handleNameChange(event) {
    this.setState({
      routingName: event.target.value,
      error: '',
    });
  }

  render() {
    const { routeEditingManager } = this.props;
    const pointCount = routeEditingManager.getRoutingPointCount();
    const actions = (
      <React.Fragment>
        <button
          type="button"
          className="routing-dialog-button secondary"
          onClick={this.removeDefaultRouting}
        >
          Cancel
        </button>
        <button
          type="button"
          className="routing-dialog-button primary"
          onClick={this.saveDefaultRouting}
        >
          Save routing
          <span aria-hidden="true">→</span>
        </button>
      </React.Fragment>
    );

    return (
      <RoutingDialog
        eyebrow="ROUTE LIBRARY"
        title="Save default routing"
        description="Store the points currently drawn on the map as a reusable route."
        error={this.state.error}
        onClose={this.removeDefaultRouting}
        actions={actions}
      >
        <div className="routing-dialog-summary">
          <div>
            <span>Route points</span>
            <strong>{pointCount}</strong>
          </div>
          <div>
            <span>Source</span>
            <strong>Map editor</strong>
          </div>
        </div>
        <label className="routing-dialog-field" htmlFor="default-routing-name">
          <span>Routing name</span>
          <input
            id="default-routing-name"
            autoFocus
            type="text"
            value={this.state.routingName}
            onChange={this.handleNameChange}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                this.saveDefaultRouting();
              }
            }}
            placeholder="e.g. Depot to test loop"
          />
        </label>
      </RoutingDialog>
    );
  }
}
