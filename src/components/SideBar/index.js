import React from 'react';
import { inject, observer } from 'mobx-react';
import ReactTooltip from 'react-tooltip';

import SideBarButton from 'components/SideBar/SideBarButton';

import TasksIcon from 'assets/images/sidebar/tasks.png';
import ModuleControllerIcon from 'assets/images/sidebar/module_controller.png';
import LayerMenuIcon from 'assets/images/sidebar/layer_menu.png';
import RouteEditingIcon from 'assets/images/sidebar/route_editing.png';
import DataRecorderIcon from 'assets/images/sidebar/data_recorder.png';

const sidebarIconMapping = {
  showTasks: TasksIcon,
  showModuleController: ModuleControllerIcon,
  showMenu: LayerMenuIcon,
  showRouteEditingBar: RouteEditingIcon,
  showDataRecorder: DataRecorderIcon,
};

const sidebarLabelMapping = {
  showTasks: 'Tasks',
  showModuleController: 'Modules',
  showMenu: 'Layers',
  showRouteEditingBar: 'Route',
  showDataRecorder: 'Recorder',
  showPOI: 'Default route',
};

@inject('store') @observer
export default class SideBar extends React.Component {
  render() {
    const {
      options, enableHMIButtonsOnly, hmi, pluginRegistry,
    } = this.props.store;
    const pluginNavigationItems = pluginRegistry.navigationItems;
    const pluginNavigationActive = pluginNavigationItems.some((item) => (
      pluginRegistry.activeSurface && pluginRegistry.activeSurface.key === item.key
    ));

    const settings = {};
    const optionNames = [...options.mainSideBarOptions, ...options.secondarySideBarOptions];
    optionNames.forEach((optionName) => {
      settings[optionName] = {
        label: sidebarLabelMapping[optionName],
        active: options[optionName],
        onClick: () => {
          this.props.store.handleOptionToggle(optionName);
        },
        disabled: options.isSideBarButtonDisabled(
          optionName,
          enableHMIButtonsOnly,
          hmi.inNavigationMode,
        ),
        iconSrc: sidebarIconMapping[optionName],
      };
    });

    return (
            <div className="side-bar">
                <div className="main-panel">
                    <SideBarButton type="main" {...settings.showTasks} />
                    <SideBarButton type="main" {...settings.showModuleController} />
                    <SideBarButton type="main" {...settings.showMenu} />
                    <SideBarButton type="main" {...settings.showRouteEditingBar} />
                    <SideBarButton type="main" {...settings.showDataRecorder} />
                    {pluginNavigationItems.length > 0 && (
                      <div
                        className={`studio-navigation${
                          pluginNavigationActive ? ' studio-navigation-active' : ''
                        }`}
                        role="group"
                        aria-label="Wheel.OS Studio"
                      >
                        <div className="studio-navigation-title" aria-hidden="true">
                          <span>WHEEL.OS</span>
                          <span>STUDIO</span>
                        </div>
                        <div className="studio-navigation-items">
                          {pluginNavigationItems.map((item) => (
                            <SideBarButton
                              key={item.key}
                              type="main"
                              label={item.title}
                              iconSrc={item.icon}
                              active={pluginRegistry.activeSurface
                                && pluginRegistry.activeSurface.key === item.key}
                              disabled={item.disabled}
                              onClick={() => {
                                if (pluginRegistry.activeSurface
                                  && pluginRegistry.activeSurface.key === item.key) {
                                  pluginRegistry.requestCloseSurface();
                                } else {
                                  pluginRegistry.requestOpenSurface(item);
                                }
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                </div>
                <div className="sub-button-panel">
                    <SideBarButton
                        type="sub"
                        {...settings.showPOI}
                        active={!options.showRouteEditingBar && options.showPOI}
                    />
                </div>
                <ReactTooltip id="sidebar-button" place="right" delayShow={500} />
            </div>
    );
  }
}
