import React from 'react';

import Image from 'components/common/Image';
import logoApollo from 'assets/images/logo_apollo.png';

export default function BrandLockup() {
  return (
        <div
            className="brand-lockup"
            role="img"
            aria-label="Apollo × Wheel.OS"
        >
            <Image image={logoApollo} className="apollo-logo" />
            <span className="brand-lockup-cross" aria-hidden="true" />
            <span className="wheel-os-wordmark" aria-hidden="true">
                <span className="wheel-os-name">wheel</span>
                <span className="wheel-os-dot" />
                <span className="wheel-os-suffix">os</span>
            </span>
        </div>
  );
}
