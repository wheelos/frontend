import React from 'react';

import PLUGIN_INTERACTIONS from './InteractionManager';

export default class PluginErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  componentDidCatch(error, info) {
    this.setState({ error });
    PLUGIN_INTERACTIONS.releasePlugin(this.props.pluginId);
    console.error(`Plugin UI crashed: ${this.props.pluginId}`, error, info);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }
    return (
      <div className="plugin-error-state" role="alert">
        <strong>Plugin view unavailable</strong>
        <span>{this.state.error.message || String(this.state.error)}</span>
        <div>
          <button type="button" onClick={() => window.location.reload()}>Reload Dreamview</button>
          {this.props.onClose && (
            <button type="button" onClick={this.props.onClose}>Close</button>
          )}
        </div>
      </div>
    );
  }
}

