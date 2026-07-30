import React from 'react';
import { inject, observer } from 'mobx-react';
import { LineChartOutlined } from '@ant-design/icons';
import {
  Tab, Tabs, TabList, TabPanel,
} from 'react-tabs';

import ControlMonitor from 'components/PNCMonitor/ControlMonitor';
import LatencyMonitor from 'components/PNCMonitor/LatencyMonitor';
import PlanningMonitor from 'components/PNCMonitor/PlanningMonitor';
import StoryTellingMonitor from 'components/PNCMonitor/StoryTellingMonitor';

@inject('store') @observer
export default class PNCMonitor extends React.Component {
  render() {
    const {
      controlData,
      latency,
      planningData,
    } = this.props.store;
    const activeStreams = [
      Boolean(planningData.planningTimeSec),
      Boolean(controlData.lastUpdatedTime),
      Boolean(latency.lastUpdatedTime
        && latency.data
        && Object.keys(latency.data).length > 0),
    ].filter(Boolean).length;
    const isLive = activeStreams > 0;

    return (
            <div className="monitor pnc-monitor">
                <header className="pnc-monitor-header">
                    <div className="pnc-monitor-heading">
                        <span className="pnc-monitor-icon" aria-hidden="true">
                            <LineChartOutlined />
                        </span>
                        <div>
                            <h1>PNC Monitor</h1>
                            <p>
                                {isLive
                                  ? `${activeStreams} of 3 data streams active`
                                  : 'Waiting for planning and control telemetry'}
                            </p>
                        </div>
                    </div>
                    <span className={`pnc-live-status${isLive ? ' is-live' : ''}`}>
                        <i aria-hidden="true" />
                        {isLive ? 'Live' : 'Waiting'}
                    </span>
                </header>
                <StoryTellingMonitor />
                <Tabs className="pnc-workspace-tabs">
                    <TabList className="pnc-tab-list">
                        <Tab className="pnc-tab" selectedClassName="pnc-tab-selected">
                            <strong>Planning</strong>
                            <small>Trajectory</small>
                        </Tab>
                        <Tab className="pnc-tab" selectedClassName="pnc-tab-selected">
                            <strong>Control</strong>
                            <small>Tracking</small>
                        </Tab>
                        <Tab className="pnc-tab" selectedClassName="pnc-tab-selected">
                            <strong>Latency</strong>
                            <small>Modules</small>
                        </Tab>
                    </TabList>
                    <TabPanel className="pnc-tab-panel" selectedClassName="pnc-tab-panel-selected">
                        <PlanningMonitor />
                    </TabPanel>
                    <TabPanel className="pnc-tab-panel" selectedClassName="pnc-tab-panel-selected">
                        <ControlMonitor />
                    </TabPanel>
                    <TabPanel className="pnc-tab-panel" selectedClassName="pnc-tab-panel-selected">
                        <LatencyMonitor />
                    </TabPanel>
                </Tabs>
            </div>
    );
  }
}
