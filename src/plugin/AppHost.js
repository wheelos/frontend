import React from 'react';
import { inject, observer } from 'mobx-react';

import PluginErrorBoundary from './PluginErrorBoundary';

@inject('store') @observer
export default class AppHost extends React.Component {
  renderContent(extension, props) {
    if (extension.render) {
      return extension.render(props);
    }
    if (typeof extension === 'function') {
      return React.createElement(extension, props);
    }
    if (extension.Component) {
      return React.createElement(extension.Component, props);
    }
    return null;
  }

  render() {
    const { pluginRegistry, dimension, options } = this.props.store;
    const active = pluginRegistry.activeSurface;
    if (!active || active.kind !== 'apps') {
      return null;
    }
    if (pluginRegistry.extensionLoading) {
      return <div className="plugin-loading-state">Loading {active.title}…</div>;
    }
    if (pluginRegistry.extensionError) {
      return (
        <div className="plugin-error-state" role="alert">
          <strong>{active.title} could not be loaded</strong>
          <span>{pluginRegistry.extensionError}</span>
          <button type="button" onClick={() => pluginRegistry.closeSurface()}>Close</button>
        </div>
      );
    }
    const extension = pluginRegistry.activeExtension;
    if (!extension) {
      return null;
    }
    return (
      <main className="plugin-app-host" data-dv-plugin={active.pluginId}>
        <PluginErrorBoundary
          pluginId={active.pluginId}
          onClose={() => pluginRegistry.closeSurface()}
        >
          {this.renderContent(extension, {
            width: dimension.main.width,
            height: dimension.pane.height,
            theme: options.themeMode,
            contribution: active,
          })}
        </PluginErrorBoundary>
      </main>
    );
  }
}

