import React from 'react';
import { inject, observer } from 'mobx-react';
import classNames from 'classnames';

import HMISelectors from 'components/Header/HMISelectors';

@inject('store') @observer
export default class HMIControls extends React.Component {
  render() {
    const {
      isCoDriver,
      isMute,
    } = this.props.store.hmi;

    return (
            <React.Fragment>
                <button
                    className={classNames({
                      'header-item': true,
                      'header-button': true,
                      'header-button-active': isCoDriver,
                    })}
                    onClick={() => this.props.store.hmi.toggleCoDriverFlag()}
                >
                    Co-Driver
                </button>
                <button
                    className={classNames({
                      'header-item': true,
                      'header-button': true,
                      'header-button-active': isMute,
                    })}
                    onClick={() => this.props.store.hmi.toggleMuteFlag()}
                >
                    Mute
                </button>
                <button
                    className={classNames({
                      'header-item': true,
                      'header-button': true,
                    })}
                    onClick={() => this.props.store.options.toggleTheme()}
                >
                    {this.props.store.options.themeMode === 'dark' ? '☀ Light' : '☾ Dark'}
                </button>
                <HMISelectors />
            </React.Fragment>
    );
  }
}
