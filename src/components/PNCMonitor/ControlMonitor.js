import React from 'react';
import { inject, observer } from 'mobx-react';

import SETTING from 'store/config/ControlGraph.yml';
import MonitorEmptyState from 'components/PNCMonitor/MonitorEmptyState';
import { generateScatterGraph } from 'components/PNCMonitor/ScatterGraph';

@inject('store') @observer
export default class ControlMonitor extends React.Component {
  render() {
    const { lastUpdatedTime, data } = this.props.store.controlData;

    if (!lastUpdatedTime) {
      return (
        <MonitorEmptyState
          title="Waiting for control telemetry"
          detail="Tracking errors and command traces appear when Control publishes data."
        />
      );
    }

    const graphData = data || {};

    return (
            <div className="pnc-diagnostic-stack">
                {generateScatterGraph(SETTING.trajectoryGraph, graphData.trajectoryGraph, {
                  pose: graphData.pose,
                })}
                {generateScatterGraph(SETTING.speedGraph, graphData.speedGraph)}
                {generateScatterGraph(SETTING.accelerationGraph, graphData.accelerationGraph)}
                {generateScatterGraph(SETTING.curvatureGraph, graphData.curvatureGraph)}
                {generateScatterGraph(SETTING.stationErrorGraph, graphData.stationErrorGraph)}
                {generateScatterGraph(SETTING.lateralErrorGraph, graphData.lateralErrorGraph)}
                {generateScatterGraph(SETTING.headingErrorGraph, graphData.headingErrorGraph)}
            </div>
    );
  }
}
