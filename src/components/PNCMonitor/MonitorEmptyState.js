import React from 'react';
import { LineChartOutlined } from '@ant-design/icons';

export default function MonitorEmptyState({ detail, title }) {
  return (
    <div className="pnc-monitor-empty" role="status">
      <div className="pnc-empty-chart" aria-hidden="true">
        <LineChartOutlined />
      </div>
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}
