import React from 'react';
import { observer } from 'mobx-react';

import classNames from 'classnames';

@observer
export default class WheelPanel extends React.Component {
  render() {
    const { steeringPercentage, steeringAngle, turnSignal } = this.props;
    const angle = Number(steeringAngle) || 0;
    const angleText = `${angle > 0 ? '+' : ''}${angle.toFixed(1)}°`;

    const isLeftOn = (turnSignal === 'LEFT' || turnSignal === 'EMERGENCY');
    const isRightOn = (turnSignal === 'RIGHT' || turnSignal === 'EMERGENCY');

    return (
            <div
                className="telemetry-cell wheel-panel"
                aria-label={`Steering ${angleText}, ${steeringPercentage} percent`}
            >
                <span className="telemetry-label">Steering</span>
                <div className="steering-value-row">
                    <span className={classNames('turn-indicator', 'turn-left', { active: isLeftOn })} />
                    <span className="steerangle-read">{angleText}</span>
                    <span className={classNames('turn-indicator', 'turn-right', { active: isRightOn })} />
                </div>
            </div>
    );
  }
}
