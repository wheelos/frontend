import React from 'react';
import { observer } from 'mobx-react';

@observer
export default class POI extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      error: '',
    };
  }

  render() {
    const {
      routeEditingManager, options, inNavigationMode, onClose,
    } = this.props;
    const poiNames = Object.keys(routeEditingManager.defaultRoutingEndPoint);

    if (poiNames.length === 0) {
      return (
        <div className="routing-library-empty">
          <span className="routing-library-empty-icon poi" aria-hidden="true" />
          <strong>No saved points of interest</strong>
          <p>
            This map does not contain a saved POI list. You can still close this panel
            and click directly on the map to add routing points.
          </p>
          <button type="button" onClick={onClose}>Return to map</button>
        </div>
      );
    }

    const entries = poiNames.map((key) => {
      const waypoints = routeEditingManager.defaultRoutingEndPoint[key] || [];
      return (
        <button
          type="button"
          className="routing-library-item"
          key={`poi_${key}`}
          onClick={() => {
            this.setState({ error: '' });
            const added = routeEditingManager.addDefaultEndPoint(key, inNavigationMode);
            if (!added) {
              this.setState({ error: 'This point of interest is not available.' });
              return;
            }
            if (!options.showRouteEditingBar
                && !routeEditingManager.sendRoutingRequest(inNavigationMode)) {
              routeEditingManager.removeAllRoutingPoints();
              this.setState({
                error: 'The routing request was not sent. Check the connection and try again.',
              });
              return;
            }
            onClose();
          }}
        >
          <span className="routing-library-item-icon poi" aria-hidden="true" />
          <span className="routing-library-item-copy">
            <strong>{key}</strong>
            <small>
              {waypoints.length} {waypoints.length === 1 ? 'waypoint' : 'waypoints'}
            </small>
          </span>
          <span className="routing-library-item-action">
            {options.showRouteEditingBar ? 'Add to route' : 'Route here'}
            <span aria-hidden="true">→</span>
          </span>
        </button>
      );
    });

    return (
      <div className="routing-library-content">
        <div className="routing-library-section-heading">
          <div>
            <strong>Saved destinations</strong>
            <span>Select one destination to continue.</span>
          </div>
          <small>{poiNames.length} total</small>
        </div>
        {this.state.error && (
          <div className="routing-library-error" role="alert">{this.state.error}</div>
        )}
        <div className="routing-library-grid">{entries}</div>
      </div>
    );
  }
}
