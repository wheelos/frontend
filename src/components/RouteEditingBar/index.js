import React from 'react';
import { inject, observer } from 'mobx-react';

import EditingTip from 'components/RouteEditingBar/EditingTip';

import removeAllIcon from 'assets/images/routing/remove_all.png';
import removeLastIcon from 'assets/images/routing/remove_last.png';
import sendRouteIcon from 'assets/images/routing/send_request.png';
import addPoiIcon from 'assets/images/routing/add_poi.png';
import inDefaultRoutingModeIcon from 'assets/images/routing/in_default_routing_mode.png';
import exitDefaultRoutingModeIcon from 'assets/images/routing/exit_default_routing_mode.png';

class RouteEditingButton extends React.Component {
  render() {
    const {
      label, icon, onClick, disabled, active,
    } = this.props;

    return (
            <button
                type="button"
                onClick={onClick}
                className={`button ${active ? 'active' : ''}`}
                disabled={disabled}
            >
                <img src={icon} alt="" aria-hidden="true" />
                <span>{label}</span>
            </button>
    );
  }
}

@inject('store') @observer
export default class RouteEditingMenu extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      requestError: '',
    };
    this.sendRoutingRequest = this.sendRoutingRequest.bind(this);
    this.toggleDefaultRoutingMode = this.toggleDefaultRoutingMode.bind(this);
  }

  sendRoutingRequest() {
    const { routeEditingManager } = this.props.store;
    if (routeEditingManager.getRoutingPointCount() < 1) {
      this.setState({
        requestError: 'Add at least one point on the map before sending.',
      });
      return;
    }

    if (routeEditingManager.sendRoutingRequest(false)) {
      this.props.store.setOptionStatus('showRouteEditingBar', false);
      return;
    }

    this.setState({
      requestError: 'The routing request was not sent. Check the connection and try again.',
    });
  }

  toggleDefaultRoutingMode() {
    const { routeEditingManager, options } = this.props.store;
    const pointCount = routeEditingManager.getRoutingPointCount();
    this.setState({ requestError: '' });

    if (routeEditingManager.inDefaultRoutingMode) {
      if (pointCount < 1) {
        this.setState({
          requestError: 'Add at least one point on the map before saving.',
        });
        return;
      }
      options.showDefaultRoutingInput = true;
      routeEditingManager.toggleDefaultRoutingMode();
      return;
    }

    if (pointCount > 0) {
      options.showDefaultRoutingInput = true;
      return;
    }

    routeEditingManager.toggleDefaultRoutingMode();
  }

  render() {
    const { routeEditingManager } = this.props.store;

    return (
            <div className="route-editing-bar">
                <div className="editing-panel">
                    <RouteEditingButton
                        label="Use Saved POI"
                        icon={addPoiIcon}
                        onClick={() => {
                          if (Object.keys(
                            routeEditingManager.defaultRoutingEndPoint,
                          ).length === 0) {
                            this.setState({
                              requestError: 'No saved POIs are configured for this map. '
                                + 'Click directly on the map to add a routing point.',
                            });
                            return;
                          }
                          this.setState({ requestError: '' });
                          this.props.store.handleOptionToggle('showPOI');
                        }}
                    />
                    <RouteEditingButton
                        label="Remove Last Point"
                        icon={removeLastIcon}
                        onClick={() => {
                          this.setState({ requestError: '' });
                          routeEditingManager.removeLastRoutingPoint();
                        }}
                    />
                    <RouteEditingButton
                        label="Remove All Points"
                        icon={removeAllIcon}
                        onClick={() => {
                          this.setState({ requestError: '' });
                          routeEditingManager.removeAllRoutingPoints();
                        }}
                    />
                    <RouteEditingButton
                        label="Send Routing Request"
                        icon={sendRouteIcon}
                        disabled={routeEditingManager.inDefaultRoutingMode}
                        onClick={this.sendRoutingRequest}
                    />
                    <RouteEditingButton
                        label={routeEditingManager.inDefaultRoutingMode
                          ? 'Save Default Routing' : 'Add Default Routing'}
                        icon={routeEditingManager.inDefaultRoutingMode
                          ? exitDefaultRoutingModeIcon : inDefaultRoutingModeIcon}
                        active={routeEditingManager.inDefaultRoutingMode}
                        onClick={this.toggleDefaultRoutingMode}
                    />
                    <EditingTip />
                </div>
                {this.state.requestError && (
                    <div className="route-editing-feedback" role="alert">
                        <span aria-hidden="true">!</span>
                        <p>{this.state.requestError}</p>
                        <button
                            type="button"
                            aria-label="Dismiss"
                            onClick={() => this.setState({ requestError: '' })}
                        >
                            ×
                        </button>
                    </div>
                )}
            </div>
    );
  }
}
