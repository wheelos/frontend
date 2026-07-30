import React from 'react';
import classNames from 'classnames';

import UTTERANCE from 'store/utterance';

export default class DrivingMode extends React.PureComponent {
  componentDidUpdate(previousProps) {
    const { drivingMode, isAutoMode } = this.props;
    const drivingModeChanged = previousProps.drivingMode !== drivingMode;
    const autoStateChanged = previousProps.isAutoMode !== isAutoMode;

    if (drivingModeChanged || autoStateChanged) {
      UTTERANCE.cancelAllInQueue();
      UTTERANCE.speakOnce(`Entering to ${drivingMode} mode`);
    }
  }

  render() {
    const { drivingMode, isAutoMode } = this.props;

    return (
            <div className={classNames({
              'driving-mode': true,
              'auto-mode': isAutoMode,
              'manual-mode': !isAutoMode,
            })}
            >
                <span className="text">{drivingMode}</span>
            </div>
    );
  }
}
