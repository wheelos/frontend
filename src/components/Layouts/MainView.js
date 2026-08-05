import React from 'react';
import { inject, observer } from 'mobx-react';
import Loadable from 'react-loadable';
import classNames from 'classnames';

import EmergencyNotification from 'components/common/EmergencyNotification';
import Loader from 'components/common/Loader';
import PlaybackControls from 'components/PlaybackControls';
import RouteEditingBar from 'components/RouteEditingBar';
import Scene from 'components/Scene';
import StatusBar from 'components/StatusBar';
import PluginSlotHost from '../../plugin/PluginSlotHost';

const Navigation = Loadable({
  loader: () => import('components/Navigation'),
  loading() {
    return <div className="navigation-view">Loading...</div>;
  },
});

@inject('store') @observer
class SceneView extends React.Component {
  render() {
    const {
      dimension, meters, monitor,
      hmi, options, trafficSignal,
    } = this.props.store;

    return (
            <React.Fragment>
                <Scene
                    width={dimension.scene.width}
                    height={dimension.scene.height}
                    options={options}
                    themeMode={options.themeMode}
                    shouldDisplayOnRight={dimension.shouldDivideSceneAndMapSpace}
                />
                <PluginSlotHost slot="mapOverlay" />
                <PluginSlotHost slot="topToolbar" />
                <PluginSlotHost slot="leftToolbar" />
                <PluginSlotHost slot="rightSidebar" />
                <PluginSlotHost slot="floatingPanel" />
                <PluginSlotHost slot="statusBar" />
                {monitor.isSirenOn &&
                  <EmergencyNotification msg="Emergency Siren Detected" />}
                {options.showRouteEditingBar
                  ? <RouteEditingBar />
                  : (
                        <StatusBar
                            meters={meters}
                            trafficSignal={trafficSignal}
                            showNotification={!options.showTasks}
                            showPlanningRSSInfo={options.showPlanningRSSInfo}
                            cameraAngle={options.cameraAngle}
                            monitor={monitor}
                        />
                  )}
                {OFFLINE_PLAYBACK && <PlaybackControls />}
                {hmi.shouldDisplayNavigationMap
                    && (
                        <Navigation
                            onResize={() => dimension.toggleNavigationSize()}
                            hasRoutingControls={hmi.inNavigationMode}
                            {...dimension.navigation}
                        />
                    )}
            </React.Fragment>
    );
  }
}

@inject('store') @observer
export default class MainView extends React.Component {
  render() {
    const { isInitialized, dimension, options } = this.props.store;

    const height = dimension.main.height;
    return (
            <div
                className={classNames({
                  'main-view': true,
                  'tools-visible': options.showTools,
                })}
                style={{ height }}
            >
                {(!isInitialized && !OFFLINE_PLAYBACK) ? <Loader /> : <SceneView />}
            </div>
    );
  }
}
