import React from 'react';
import { inject, observer } from 'mobx-react';

import FRONTEND_PLUGIN_RUNTIME from './FrontendPluginRuntime';
import PluginErrorBoundary from './PluginErrorBoundary';
import PLUGIN_INTERACTIONS from './InteractionManager';

function makeInstanceId(panel) {
  return `${panel.pluginId}-${panel.id}-${Date.now().toString(36)}`;
}

@inject('store') @observer
export default class PanelHost extends React.Component {
  constructor(props) {
    super(props);
    this.state = { loading: false, error: '', instance: null, extension: null };
    this.sequence = 0;
    this.lastPanelKey = null;
  }

  componentDidMount() {
    this.loadPanel();
  }

  componentDidUpdate() {
    const current = this.props.store.pluginRegistry.activePanel;
    const currentKey = current && current.key;
    if (this.lastPanelKey !== currentKey) {
      this.disposeInstance();
      this.loadPanel();
    }
  }

  componentWillUnmount() {
    this.sequence += 1;
    this.disposeInstance();
  }

  async loadPanel() {
    const panel = this.props.store.pluginRegistry.activePanel;
    this.lastPanelKey = panel && panel.key;
    const sequence = ++this.sequence;
    if (!panel) {
      this.setState({ loading: false, error: '', instance: null, extension: null });
      return;
    }
    this.setState({ loading: true, error: '', instance: null, extension: null });
    try {
      const loaded = await FRONTEND_PLUGIN_RUNTIME.loadPanel(panel);
      if (sequence !== this.sequence) {
        return;
      }
      let instance = loaded.extension;
      if (loaded.extension && loaded.extension.createPanel) {
        instance = loaded.extension.createPanel({
          instanceId: makeInstanceId(panel),
          initialConfig: panel.initialConfig,
          host: loaded.context,
        });
      }
      this.setState({ loading: false, error: '', instance, extension: loaded.extension });
    } catch (error) {
      if (sequence === this.sequence) {
        this.setState({ loading: false, error: error.message || String(error) });
      }
    }
  }

  disposeInstance() {
    if (this.state.instance && this.state.instance.dispose) {
      const panelKey = this.lastPanelKey || 'unknown';
      try {
        const result = this.state.instance.dispose();
        if (result && typeof result.catch === 'function') {
          result.catch((error) => this.handleDisposeError(error, panelKey));
        }
      } catch (error) {
        this.handleDisposeError(error, panelKey);
      }
    }
  }

  handleDisposeError(error, panelKey) {
    const pluginId = panelKey.split('/')[0];
    PLUGIN_INTERACTIONS.releasePlugin(pluginId);
    console.error(`Plugin panel dispose failed: ${panelKey}`, error);
  }

  renderPanel(instance, props) {
    if (instance.render) {
      return instance.render(props);
    }
    if (typeof instance === 'function') {
      return React.createElement(instance, props);
    }
    if (instance.Component) {
      return React.createElement(instance.Component, props);
    }
    return null;
  }

  render() {
    const { pluginRegistry, dimension, options } = this.props.store;
    const panel = pluginRegistry.activePanel;
    if (!panel) {
      return null;
    }
    if (this.state.loading) {
      return <div className="plugin-loading-state">Loading {panel.title}…</div>;
    }
    if (this.state.error) {
      return <div className="plugin-error-state" role="alert">{this.state.error}</div>;
    }
    if (!this.state.instance) {
      return null;
    }
    return (
      <div className="plugin-panel-host" data-dv-plugin={panel.pluginId}>
        <PluginErrorBoundary
          pluginId={panel.pluginId}
          onClose={() => pluginRegistry.closePanel()}
        >
          {this.renderPanel(this.state.instance, {
            width: dimension.monitorWidth,
            height: dimension.pane.height,
            visible: true,
            theme: options.themeMode,
            panel,
          })}
        </PluginErrorBoundary>
      </div>
    );
  }
}
