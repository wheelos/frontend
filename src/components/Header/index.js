import React from 'react';

import BrandLockup from 'components/common/BrandLockup';
import HMIControls from 'components/Header/HMIControls';

export default class Header extends React.Component {
  render() {
    return (
            <header className="header">
                <BrandLockup />
                {!OFFLINE_PLAYBACK && <HMIControls />}
            </header>
    );
  }
}
