import React from 'react';
import { inject, observer } from 'mobx-react';

import QuickStart from 'components/Tasks/QuickStart';
import Others from 'components/Tasks/Others';
import Delay from 'components/Tasks/Delay';
import Console from 'components/Tasks/Console';
import SensorCamera from 'components/Tasks/SensorCamera';

@inject('store') @observer
export default class Tasks extends React.Component {
  render() {
    const { options } = this.props;
    const showCamera = options.showVideo && !options.showPNCMonitor;

    return (
            <div className="tasks tasks-shell">
                <div className="tasks-toolbar">
                    <div className="tasks-title">
                        <span>Tasks</span>
                        <small>Operational controls and health</small>
                    </div>
                    <button
                        type="button"
                        className="tasks-close"
                        aria-label="Close Tasks"
                        onClick={() => this.props.store.handleOptionToggle('showTasks')}
                    >
                        ×
                    </button>
                </div>
                <div className={`tasks-grid${showCamera ? ' has-camera' : ''}`}>
                    <QuickStart />
                    <Others />
                    <Delay />
                    {showCamera && <SensorCamera />}
                    <Console />
                </div>
            </div>
    );
  }
}
