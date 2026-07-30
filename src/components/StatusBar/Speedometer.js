import React from 'react';

const UNITS = [{
  name: 'km/h',
  conversionFromMeterPerSecond: 3.6,
}, {
  name: 'm/s',
  conversionFromMeterPerSecond: 1,
}, {
  name: 'mph',
  conversionFromMeterPerSecond: 2.23694,
}];

export default class Speedometer extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      unit: 0,
    };

    this.changeUnit = this.changeUnit.bind(this);
  }

  changeUnit() {
    this.setState({
      unit: (this.state.unit + 1) % UNITS.length,
    });
  }

  render() {
    const { meterPerSecond } = this.props;

    const currUnit = UNITS[this.state.unit];
    const name = currUnit.name;
    const read = Math.round((Number(meterPerSecond) || 0)
      * currUnit.conversionFromMeterPerSecond);

    return (
            <button
                type="button"
                className="speedometer"
                onClick={this.changeUnit}
                aria-label={`Speed ${read} ${name}. Change speed unit`}
            >
                <span className="speed-read">{read}</span>
                <span className="speed-unit">{name}</span>
            </button>
    );
  }
}
