import React from 'react';
import { inject, observer } from 'mobx-react';

import Speedometer from 'components/StatusBar/Speedometer';

class Meter extends React.Component {
  render() {
    const {
      label, percentage, meterColor, background,
    } = this.props;

    const normalizedPercentage = Math.max(0, Math.min(100, Number(percentage) || 0));
    const percentageString = `${normalizedPercentage}%`;

    return (
            <div className="meter-container" aria-label={`${label} ${percentageString}`}>
                <span className="meter-label">{label}</span>
                <div
                    className="meter-background"
                    style={{ backgroundColor: background }}
                >
                    <span style={{
                      backgroundColor: meterColor,
                      width: percentageString,
                    }}
                    />
                </div>
                <span className="meter-value">{percentageString}</span>
            </div>
    );
  }
}

@inject('store') @observer
export default class AutoMeter extends React.Component {
  render() {
    const { throttlePercent, brakePercent, speed } = this.props;
    const { themeMode } = this.props.store.options;

    const meterSettings = themeMode === 'light' ? {
      brake: {
        label: 'Brake',
        meterColor: '#D63030',
        background: '#D4B8B8',
      },
      accelerator: {
        label: 'Accelerator',
        meterColor: '#0058CC',
        background: '#B8C8D8',
      },
    } : {
      brake: {
        label: 'Brake',
        meterColor: '#B43131',
        background: '#382626',
      },
      accelerator: {
        label: 'Accelerator',
        meterColor: '#006AFF',
        background: '#2D3B50',
      },
    };

    return (
            <div className="auto-meter">
                <div className="telemetry-cell speed-cell">
                    <span className="telemetry-label">Speed</span>
                    <Speedometer meterPerSecond={speed} />
                </div>
                <div className="telemetry-cell pedals-cell">
                    <span className="telemetry-label">Pedals</span>
                    <div className="meter-pair">
                        <Meter
                            label={meterSettings.brake.label}
                            percentage={brakePercent}
                            meterColor={meterSettings.brake.meterColor}
                            background={meterSettings.brake.background}
                        />
                        <Meter
                            label="Accel"
                            percentage={throttlePercent}
                            meterColor={meterSettings.accelerator.meterColor}
                            background={meterSettings.accelerator.background}
                        />
                    </div>
                </div>
            </div>
    );
  }
}
