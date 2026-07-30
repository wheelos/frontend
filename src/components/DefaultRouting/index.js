import React from 'react';
import {
  Tab, Tabs, TabList, TabPanel,
} from 'react-tabs';
import { observer } from 'mobx-react';

import POI from './POI';
import DefaultRoutingPoint from './DefaultRoutingPoint';


@observer
export default class DefaultRouting extends React.Component {
  render() {
    const {
      routeEditingManager, options, inNavigationMode, onClose,
    } = this.props;
    const isRouteEditing = options.showRouteEditingBar;
    const poiCount = Object.keys(routeEditingManager.defaultRoutingEndPoint).length;
    const routingCount = Object.keys(routeEditingManager.defaultRoutings).length;

    return (
      <div className="tool-view-menu default-routing-library" id="poi-list">
        <div className="card data-recorder default-routing-library-card">
          <header className="default-routing-library-header">
            <div>
              <span className="default-routing-library-kicker">
                {isRouteEditing ? 'ROUTE EDITOR' : 'ROUTE LIBRARY'}
              </span>
              <h2>{isRouteEditing ? 'Add a saved location' : 'Default routing'}</h2>
              <p>
                {isRouteEditing
                  ? 'Choose a saved point or route to add to the map.'
                  : 'Select a reusable route, review it, then send it.'}
              </p>
            </div>
            <button
              type="button"
              className="default-routing-library-close"
              aria-label="Close default routing"
              onClick={onClose}
            >
              ×
            </button>
          </header>
          <Tabs defaultIndex={isRouteEditing ? 0 : 1}>
            <TabList>
              <Tab>
                <span>Points of interest</span>
                <small>{poiCount}</small>
              </Tab>
              <Tab>
                <span>Saved routings</span>
                <small>{routingCount}</small>
              </Tab>
            </TabList>
            <TabPanel>
              <POI
                routeEditingManager={routeEditingManager}
                options={options}
                inNavigationMode={inNavigationMode}
                onClose={onClose}
              />
            </TabPanel>
            <TabPanel>
              <DefaultRoutingPoint
                routeEditingManager={routeEditingManager}
                options={options}
                onClose={onClose}
              />
            </TabPanel>
          </Tabs>
        </div>
      </div>
    );
  }
}
