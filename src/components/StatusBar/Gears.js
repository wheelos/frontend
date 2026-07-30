import React from 'react';
import { observer } from 'mobx-react';

@observer
export default class Gears extends React.Component {

  render() {
    const { currentGear } = this.props;

    const gearAlphabet = (currentGear && currentGear !== 'GEAR_NONE') ? currentGear.charAt(5) : 'None';
    const gearLabel = 'Gear';

    return (
            <div className="gear-status" aria-label={`${gearLabel} ${gearAlphabet}`}>
                <span className="gear-label">{gearLabel}</span>
                <span className="text">{gearAlphabet}</span>
            </div>
    );
  }
}
