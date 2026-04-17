import React from 'react';
import { inject, observer } from 'mobx-react';

@inject('store') @observer
export default class PointCloudMetrics extends React.Component {
  render() {
    const { pointCloudMetrics, options } = this.props.store;

    if (!options.showPointCloud) {
      return null;
    }

    const { pointCount, bandwidthKBs, fps } = pointCloudMetrics;

    return (
      <div className="point-cloud-metrics">
        <div className="point-cloud-metrics-row">
          <span className="point-cloud-metrics-label">Points</span>
          <span className="point-cloud-metrics-value">
            {pointCount.toLocaleString()}
          </span>
        </div>
        <div className="point-cloud-metrics-row">
          <span className="point-cloud-metrics-label">FPS</span>
          <span className="point-cloud-metrics-value">{fps}</span>
        </div>
        <div className="point-cloud-metrics-row">
          <span className="point-cloud-metrics-label">Bandwidth</span>
          <span className="point-cloud-metrics-value">
            {bandwidthKBs.toFixed(1)} KB/s
          </span>
        </div>
      </div>
    );
  }
}
