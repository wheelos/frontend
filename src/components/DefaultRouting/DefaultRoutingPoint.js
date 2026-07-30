import React from 'react';
import { observer } from 'mobx-react';

@observer
export default class DefaultRoutingPoint extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      error: '',
    };
  }

  render() {
    const { routeEditingManager, options, onClose } = this.props;
    const inRouteEditingMode = options.showRouteEditingBar;
    const routingNames = Object.keys(routeEditingManager.defaultRoutings);

    if (routingNames.length === 0) {
      return (
        <div className="routing-library-empty">
          <span className="routing-library-empty-icon route" aria-hidden="true" />
          <strong>No saved routings yet</strong>
          <p>
            Enter Route mode, draw one or more points, then use Add Default Routing
            to save a reusable route.
          </p>
          <button type="button" onClick={onClose}>Return to map</button>
        </div>
      );
    }

    const entries = routingNames.map((key) => {
      const waypoints = routeEditingManager.defaultRoutings[key] || [];
      return (
        <button
          type="button"
          className="routing-library-item"
          key={`default_routing_${key}`}
          onClick={() => {
            this.setState({ error: '' });
            if (!inRouteEditingMode) {
              routeEditingManager.removeAllRoutingPoints();
            }
            if (!routeEditingManager.addDefaultRoutingPoint(key)) {
              this.setState({ error: 'This saved routing is not available.' });
              return;
            }
            if (!inRouteEditingMode) {
              routeEditingManager.currentDefaultRouting = key;
              options.showCycleNumberInput = true;
            }
            onClose();
          }}
        >
          <span className="routing-library-item-icon route" aria-hidden="true" />
          <span className="routing-library-item-copy">
            <strong>{key}</strong>
            <small>
              {waypoints.length} {waypoints.length === 1 ? 'waypoint' : 'waypoints'}
            </small>
          </span>
          <span className="routing-library-item-status">SAVED</span>
          <span className="routing-library-item-action">
            {inRouteEditingMode ? 'Add to route' : 'Review & send'}
            <span aria-hidden="true">→</span>
          </span>
        </button>
      );
    });

    return (
      <div className="routing-library-content">
        <div className="routing-library-section-heading">
          <div>
            <strong>Reusable routes</strong>
            <span>Review a route before sending it.</span>
          </div>
          <small>{routingNames.length} total</small>
        </div>
        {this.state.error && (
          <div className="routing-library-error" role="alert">{this.state.error}</div>
        )}
        <div className="routing-library-grid">{entries}</div>
      </div>
    );
  }
}
