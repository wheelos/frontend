import React from 'react';

export default class Electricity extends React.PureComponent {

  render() {
    const {
      electricityPercentage,
    } = this.props;
    if (electricityPercentage === null) {
      return null;
    }

    const percentage = Math.max(0, Math.min(100, Number(electricityPercentage) || 0));
    const percentageString = `${percentage}%`;
    const electricityColor = percentage <= 20
      ? 'var(--status-error)' : 'var(--status-success)';

    return (
            <div className="electricity-status" aria-label={`Battery ${percentageString}`}>
                <span className="battery-icon" aria-hidden="true">
                    <span
                        className="battery-level"
                        style={{ width: percentageString, backgroundColor: electricityColor }}
                    />
                </span>
                <span className="text">{percentageString}</span>
            </div>
    );
  }
}
