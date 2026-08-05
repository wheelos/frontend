import React from 'react';
import { inject, observer } from 'mobx-react';
import { ConfigProvider } from 'antd';

import SplitPane from 'react-split-pane';
import Header from 'components/Header';
import MainView from 'components/Layouts/MainView';
import ToolView from 'components/Layouts/ToolView';
import MonitorPanel from 'components/Layouts/MonitorPanel';
import SideBar from 'components/SideBar';

import ApplicationGuideModal from 'components/ApplicationGuideModal';
import AppHost from '../plugin/AppHost';
import PluginLifecycleHost from '../plugin/PluginLifecycleHost';
import '../plugin/style.scss';

import WS, { MAP_WS, POINT_CLOUD_WS, CAMERA_WS } from 'store/websocket';

@inject('store') @observer
export default class Dreamview extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isPaneResizing: false,
    };
    this.handleDrag = this.handleDrag.bind(this);
    this.handleDragStarted = this.handleDragStarted.bind(this);
    this.handleDragFinished = this.handleDragFinished.bind(this);
    this.updateDimension = this.props.store.dimension.update.bind(this.props.store.dimension);
  }

  handleDrag(masterViewWidth) {
    const { options, dimension } = this.props.store;
    if (options.showMonitor) {
      dimension.updateMonitorWidth(
        Math.min(
          Math.max(window.innerWidth - masterViewWidth, 0),
          window.innerWidth,
        ),
      );
    }
  }

  handleDragStarted() {
    this.setState({ isPaneResizing: true });
  }

  handleDragFinished() {
    this.setState({ isPaneResizing: false });
  }

  componentWillMount() {
    this.props.store.dimension.initialize();
  }

  componentDidMount() {
    WS.initialize();
    MAP_WS.initialize();
    POINT_CLOUD_WS.initialize();
    CAMERA_WS.initialize();
    this.props.store.pluginRegistry.initialize();
    window.addEventListener('resize', this.updateDimension, false);
  }

  componentWillUnmount() {
    this.props.store.pluginRegistry.dispose();
    window.removeEventListener('resize', this.updateDimension, false);
  }

  render() {
    const { dimension, options, hmi } = this.props.store;
    const { isPaneResizing } = this.state;
    const { currentVehicleType } = hmi;

    return (
            <ConfigProvider getPopupContainer={(node) => {
              if (node) {
                return node.parentNode;
              }
              return document.body;
            }}>
            <div className={`theme-${options.themeMode}`}>
                <PluginLifecycleHost />
                <Header />
                <div
                    className={[
                      'pane-container',
                      options.showMonitor ? 'monitor-visible' : '',
                      isPaneResizing ? 'pane-resizing' : '',
                    ].filter(Boolean).join(' ')}
                >
                    <SplitPane
                        split="vertical"
                        size={dimension.pane.width}
                        onChange={this.handleDrag}
                        onDragStarted={this.handleDragStarted}
                        onDragFinished={this.handleDragFinished}
                        allowResize={options.showMonitor}
                    >
                        <div className="left-pane">
                            <SideBar />
                            <div className="dreamview-body">
                                {options.pluginAppActive
                                  ? <AppHost />
                                  : (
                                    <React.Fragment>
                                      <MainView />
                                      <ToolView />
                                    </React.Fragment>
                                  )}
                            </div>
                        </div>
                        <MonitorPanel
                            hmi={hmi}
                            viewName={options.monitorName}
                            showVideo={options.showVideo}
                        />
                    </SplitPane>
                </div>
              {
                (currentVehicleType > 0 && currentVehicleType <= 7) &&
                <ApplicationGuideModal />}
            </div>
            </ConfigProvider>
    );
  }
}
