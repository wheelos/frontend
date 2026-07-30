import React from 'react';
import classNames from 'classnames';

export default class SideBarButton extends React.PureComponent {
  render() {
    const {
      type, label, iconSrc, hotkey,
      active, disabled, extraClasses, onClick,
    } = this.props;

    const isSubButton = type === 'sub';
    const tooltip = hotkey ? `${label} (${hotkey})` : label;

    return (
            <button
                type="button"
                onClick={onClick}
                disabled={disabled}
                data-for="sidebar-button"
                data-tip={tooltip}
                aria-label={tooltip}
                aria-pressed={Boolean(active)}
                className={classNames({
                  button: !isSubButton,
                  'button-active': !isSubButton && active,
                  'sub-button': isSubButton,
                  'sub-button-active': isSubButton && active,
                },
                extraClasses)}
            >
                {hotkey && <span className="shortcut" aria-hidden="true">{hotkey}</span>}
                {iconSrc && <img src={iconSrc} className="icon" alt="" aria-hidden="true" />}
                <div className="label">{label}</div>
            </button>
    );
  }
}
