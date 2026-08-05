import React from 'react';
import { inject, observer } from 'mobx-react';

import PluginErrorBoundary from './PluginErrorBoundary';

function renderSlot(slot, props) {
  if (slot.render) {
    return slot.render(props);
  }
  if (slot.component) {
    return React.createElement(slot.component, props);
  }
  return null;
}

@inject('store') @observer
export default class PluginSlotHost extends React.Component {
  render() {
    const { pluginRegistry, dimension, options } = this.props.store;
    const active = pluginRegistry.activeSurface;
    if (!active || active.kind !== 'workspaces') {
      return null;
    }
    const className = `plugin-slot plugin-slot-${this.props.slot}`;
    const showsLifecycleState = this.props.slot === 'bottomDock';
    if (pluginRegistry.extensionLoading) {
      if (!showsLifecycleState) {
        return null;
      }
      return (
        <div className={className} data-dv-plugin={active.pluginId}>
          <div className="plugin-loading-state" role="status">
            <span className="plugin-loading-indicator" aria-hidden="true" />
            <strong>Loading {active.title}</strong>
            <span>Connecting the workspace to its plugin service…</span>
          </div>
        </div>
      );
    }
    if (pluginRegistry.extensionError) {
      if (!showsLifecycleState) {
        return null;
      }
      return (
        <div className={className} data-dv-plugin={active.pluginId}>
          <div className="plugin-error-state" role="alert">
            <strong>{active.title} could not be opened</strong>
            <span>{pluginRegistry.extensionError}</span>
            <div>
              <button type="button" onClick={() => window.location.reload()}>
                Reload Dreamview
              </button>
              <button type="button" onClick={() => pluginRegistry.requestCloseSurface()}>
                Close
              </button>
            </div>
          </div>
        </div>
      );
    }
    if (!pluginRegistry.activeExtension) {
      return null;
    }
    const slots = pluginRegistry.activeSlots.filter((slot) => slot.slot === this.props.slot);
    if (!slots.length) {
      return null;
    }
    const slotProps = {
      width: this.props.slot === 'bottomDock' ? dimension.main.width : dimension.scene.width,
      height: this.props.slot === 'bottomDock'
        ? dimension.pane.height - dimension.main.height : dimension.scene.height,
      visible: true,
      theme: options.themeMode,
      contribution: active,
    };
    return (
      <div
        className={className}
        data-dv-plugin={active.pluginId}
      >
        {slots.map((slot, index) => (
          <PluginErrorBoundary
            key={`${active.key}-${this.props.slot}-${index}`}
            pluginId={active.pluginId}
            onClose={() => pluginRegistry.closeSurface()}
          >
            {renderSlot(slot, slotProps)}
          </PluginErrorBoundary>
        ))}
      </div>
    );
  }
}
