import React from 'react';
import { observer } from 'mobx-react';

@observer
export default class MotionMode extends React.Component {
  render() {
    const { motionMode } = this.props;

    return (
            <div className="motion-mode">
                <div className="left-div">
                    <div className="text"> Mode </div>
                </div>
                <div className="right-div">
                    <div className="text"> { motionMode } </div>
                </div>
            </div>
    );
  }
}
