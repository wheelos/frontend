import React from 'react';
import { observer, inject } from 'mobx-react';
import classNames from 'classnames';

import Geolocation from 'components/Scene/Geolocation';
import PointCloudMetrics from 'components/Scene/PointCloudMetrics';
import RENDERER from 'renderer';
import STORE from 'store';
import DefaultRoutingInput from '../RouteEditingBar/DefaultRoutingInput';
import CycleNumberInput from '../DefaultRouting/CycleNumberInput';

@inject('store') @observer
export default class Scene extends React.Component {
  constructor(props) {
    super(props);
    this.lastThemeMode = props.themeMode;
  }

  componentDidMount() {
    RENDERER.initialize('canvas', this.props.width, this.props.height,
      this.props.options, this.props.store.cameraData);
  }

  componentWillUpdate(nextProps) {
    if (nextProps.width !== this.props.width
            || nextProps.height !== this.props.height) {
      // The dimension of the renderer should always be consistent with
      // the dimension of this component.
      RENDERER.updateDimension(nextProps.width, nextProps.height);
    }

    if (nextProps.themeMode !== this.lastThemeMode) {
      RENDERER.updateSceneTheme(nextProps.themeMode);
      this.lastThemeMode = nextProps.themeMode;
    }
  }

  render() {
    const { options, shouldDisplayOnRight } = this.props;
    const { routeEditingManager } = this.props.store;

    const shouldDisplayCameraImage = options.showCameraView && !options.showRouteEditingBar;
    const leftPosition = shouldDisplayOnRight ? '50%' : '0%';

    return (
            <React.Fragment>
                <img
                    id="camera-image"
                    className={classNames({
                      'camera-image': true,
                      'camera-image-visible': shouldDisplayCameraImage,
                    })}
                    aria-hidden="true"
                    alt=""
                />
                <div
                    id="canvas"
                    className={classNames({
                      'dreamview-canvas': true,
                      'camera-overlay-active': shouldDisplayCameraImage,
                    })}
                    style={{ left: leftPosition }}
                    onMouseMove={(event) => {
                      const geo = RENDERER.getGeolocation(event);
                      STORE.setGeolocation(geo);
                    }}
                >
                    {options.showGeo && <Geolocation />}
                    <PointCloudMetrics />
                </div>
                {options.showRouteEditingBar && options.showDefaultRoutingInput
                    && <DefaultRoutingInput
                        routeEditingManager={routeEditingManager}
                        options={options}
                    />}
                {!options.showRouteEditingBar && options.showCycleNumberInput
                    && <CycleNumberInput
                        routeEditingManager={routeEditingManager}
                        options={options}
                    />}
            </React.Fragment>
    );
  }
}
