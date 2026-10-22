import React from 'react';
import { inject, observer } from 'mobx-react';
import icons from './icons';
import './style.scss';

const TrafficSignNotification = inject('store')(observer(({ store }) => {
  const { signs } = store.trafficSigns;
  if (!signs.length) {
    return null;
  }
  return (
    <aside
      className="traffic-sign-notification"
      role="status"
      aria-live="polite"
      aria-label="Detected traffic signs"
    >
      <strong>Traffic signs detected</strong>
      <ul>
        {signs.map((sign) => (
          <li key={sign.className}>
            {icons[sign.signType] && (
              <img className="traffic-sign-icon" src={icons[sign.signType]} alt="" />
            )}
            <span className="traffic-sign-label">{sign.className}</span>
            <span>
              {Math.round(sign.score * 100)}
              %
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}));

export default TrafficSignNotification;
