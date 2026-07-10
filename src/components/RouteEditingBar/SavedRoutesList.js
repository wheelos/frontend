import React from 'react';
import { observer } from 'mobx-react';

@observer
export default class SavedRoutesList extends React.Component {
  render() {
    const { routeEditingManager, options } = this.props;
    const savedRoutes = Object.keys(routeEditingManager.defaultRoutings);

    if (savedRoutes.length === 0) {
      return (
        <div className="saved-routes-list">
          <span className="no-routes-msg">No saved routes available.</span>
        </div>
      );
    }

    return (
      <div className="saved-routes-list">
        {savedRoutes.map((name) => (
          <button
            key={name}
            className="saved-route-item"
            onClick={() => {
              routeEditingManager.addDefaultRoutingPoint(name);
              options.showSavedRoutesList = false;
            }}
            title={`Load route: ${name}`}
          >
            {name}
          </button>
        ))}
      </div>
    );
  }
}
