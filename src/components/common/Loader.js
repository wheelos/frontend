import React from 'react';

import classNames from 'classnames';

import loaderGif from 'assets/images/loader_apollo.gif';
import BrandLockup from 'components/common/BrandLockup';

export default class Loader extends React.PureComponent {
  render() {
    const { extraClasses, offlineViewErr } = this.props;

    let message = 'Please send car initial position and map data.';
    if (OFFLINE_PLAYBACK) {
      message = offlineViewErr || 'Loading ....';
    }

    return (
            <div className="loader">
                <div
                    className={classNames(
                      'img-container',
                      { 'initialization-loader': !OFFLINE_PLAYBACK },
                      extraClasses,
                    )}
                >
                    {OFFLINE_PLAYBACK
                      ? <img src={loaderGif} alt="Loader" />
                      : <BrandLockup />}
                    <div className={offlineViewErr ? 'error-message' : 'status-message'}>
                        {message}
                    </div>
                </div>
            </div>
    );
  }
}
