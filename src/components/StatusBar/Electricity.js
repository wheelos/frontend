import React from 'react';
import { inject, observer } from 'mobx-react';

@inject('store') @observer
export default class Electricity extends React.Component {

  render() {
    const {
      electricityPercentage,
    } = this.props;
    const { themeMode } = this.props.store.options;

    if (electricityPercentage === null) {
      return null;
    }

    const percentageString = `${electricityPercentage}%`;
    const rectWidth = 24 * (electricityPercentage / 100);
    const electricityColor = (electricityPercentage <= 20)
      ? 'rgba(180, 49, 49, 0.8)' : 'rgba(79, 198, 105, 0.8)';
    const batteryBgColor = themeMode === 'light'
      ? 'rgba(200, 200, 200, 0.5)' : 'rgba(0,0,0,0.5)';

    return (
            <div className="battery-and-gears electricity-status">
                <div className="left-div">
                    <svg version="1.1">
                        <rect rx="2" ry="2" x="44" y="10" width="30" height="15" fill="rgb(15,127,18)"/>
                        <rect x="46" y="12" width="26" height="11" fill={ batteryBgColor }/>
                        <rect x="47" y="13" width={ rectWidth } height="9" fill= { electricityColor }/>
                        <rect rx="2" ry="2" x="74" y="13" height="8" width="2" fill="rgb(15,127,18)"/>
                    </svg>
                </div>
                <div className="right-div">
                    <div className="text"> { percentageString } </div>
                </div>
            </div>
    );
  }
}
