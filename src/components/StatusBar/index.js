import React from 'react';
import { observer } from 'mobx-react';

import AutoMeter from 'components/StatusBar/AutoMeter';
import Electricity from 'components/StatusBar/Electricity';
import Gears from 'components/StatusBar/Gears';
import Notification from 'components/StatusBar/Notification';
import TrafficLightIndicator from 'components/StatusBar/TrafficLightIndicator';
import DrivingMode from 'components/StatusBar/DrivingMode';
import Wheel from 'components/StatusBar/Wheel';
import Rss from 'components/StatusBar/Rss';

@observer
export default class StatusBar extends React.Component {
  render() {
    const {
      meters, trafficSignal, showNotification,
      showPlanningRSSInfo, monitor, cameraAngle,
    } = this.props;
    const cameraClass = `camera-${String(cameraAngle || 'Default').toLowerCase()}`;

    return (
            <div className="status-bar">
                {showNotification
                    && (
                        <Notification
                            monitor={monitor}
                            showPlanningRSSInfo={showPlanningRSSInfo}
                        />
                    )}
                {showPlanningRSSInfo && <Rss monitor={monitor} />}
                <div
                    key={cameraClass}
                    className={`driving-telemetry ${cameraClass}`}
                    aria-label="Driving telemetry"
                >
                    <div className="telemetry-cluster telemetry-primary">
                        <AutoMeter
                            throttlePercent={meters.throttlePercent}
                            brakePercent={meters.brakePercent}
                            speed={meters.speed}
                        />
                    </div>
                    <div className="telemetry-cluster telemetry-secondary">
                        <Wheel
                            steeringPercentage={meters.steeringPercentage}
                            steeringAngle={meters.steeringAngle}
                            turnSignal={meters.turnSignal}
                        />
                        <div className="telemetry-cell driving-mode-cell">
                            <span className="telemetry-label">Driving mode</span>
                            <DrivingMode
                                drivingMode={meters.drivingMode}
                                isAutoMode={meters.isAutoMode}
                            />
                        </div>
                        <div className="telemetry-cell power-gear-cell">
                            <span className="telemetry-label">Power / Gear</span>
                            <div className="power-gear-value">
                                <Electricity
                                    electricityPercentage={meters.batteryPercentage}
                                />
                                <Gears currentGear={meters.gearLocation} />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="scene-signal-status">
                    <TrafficLightIndicator colorName={trafficSignal.color} />
                </div>
            </div>
    );
  }
}
