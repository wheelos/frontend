import React from 'react';
import { inject, observer } from 'mobx-react';

import Speedometer from 'components/StatusBar/Speedometer';

class Meter extends React.Component {
  render() {
    const {
      label, percentage, meterColor, background,
    } = this.props;

    const percentageString = `${percentage}%`;
    const meterWidth = 120;
    const meterMarginLeft = 8;
    const headLeft = meterMarginLeft + (percentage / 100) * meterWidth;

    return (
            <div className="meter-container">
                <div className="meter-label">
                    {label}
                    <span className="meter-value">{percentageString}</span>
                </div>
                <span
                    className="meter-head"
                    style={{ left: headLeft, borderColor: meterColor }}
                />
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
                <Speedometer meterPerSecond={speed} />
                <div className="brake-panel">
                    <Meter
                        label={meterSettings.brake.label}
                        percentage={brakePercent}
                        meterColor={meterSettings.brake.meterColor}
                        background={meterSettings.brake.background}
                    />
                </div>
                <div className="throttle-panel">
                    <Meter
                        label={meterSettings.accelerator.label}
                        percentage={throttlePercent}
                        meterColor={meterSettings.accelerator.meterColor}
                        background={meterSettings.accelerator.background}
                    />
                </div>
            </div>
    );
  }
}
