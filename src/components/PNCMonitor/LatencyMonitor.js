import React from 'react';
import { inject, observer } from 'mobx-react';

import setting from 'store/config/LatencyGraph.yml';
import MonitorEmptyState from 'components/PNCMonitor/MonitorEmptyState';
import { generateScatterGraph } from 'components/PNCMonitor/ScatterGraph';

@inject('store') @observer
export default class LatencyMonitor extends React.Component {
  render() {
    const { lastUpdatedTime, data } = this.props.store.latency;

    if (!lastUpdatedTime || !data || Object.keys(data).length === 0) {
      return (
        <MonitorEmptyState
          title="Waiting for latency telemetry"
          detail="Module timing history appears when latency reports are available."
        />
      );
    }

    const graphs = {};
    Object.keys(data).forEach((moduleName) => {
      graphs[moduleName] = data[moduleName];
    });
    return (
      <div className="pnc-diagnostic-stack">
        {generateScatterGraph(setting, graphs)}
      </div>
    );
  }
}
