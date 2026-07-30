import React from 'react';

export default class RoutingDialog extends React.Component {
  constructor(props) {
    super(props);
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  componentDidMount() {
    document.addEventListener('keydown', this.handleKeyDown);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  handleKeyDown(event) {
    if (event.key === 'Escape') {
      this.props.onClose();
    }
  }

  render() {
    const {
      eyebrow, title, description, error, onClose, actions, children,
    } = this.props;

    return (
      <div
        className="routing-dialog-backdrop"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
      >
        <section
          className="routing-dialog"
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <header className="routing-dialog-header">
            <span className="routing-dialog-glyph" aria-hidden="true">
              <svg viewBox="0 0 32 32">
                <path d="M8 24C8 15 24 17 24 8" />
                <circle cx="8" cy="24" r="3" />
                <circle cx="24" cy="8" r="3" />
              </svg>
            </span>
            <div className="routing-dialog-heading">
              <span className="routing-dialog-eyebrow">{eyebrow}</span>
              <h2>{title}</h2>
              {description && <p>{description}</p>}
            </div>
            <button
              type="button"
              className="routing-dialog-close"
              aria-label="Close"
              onClick={onClose}
            >
              ×
            </button>
          </header>
          <div className="routing-dialog-body">
            {children}
            {error && (
              <div className="routing-dialog-error" role="alert">
                <span aria-hidden="true">!</span>
                {error}
              </div>
            )}
          </div>
          <footer className="routing-dialog-actions">{actions}</footer>
        </section>
      </div>
    );
  }
}
