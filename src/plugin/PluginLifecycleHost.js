import React from 'react';
import { inject } from 'mobx-react';
import { reaction } from 'mobx';

import FRONTEND_PLUGIN_RUNTIME from './FrontendPluginRuntime';

@inject('store')
export default class PluginLifecycleHost extends React.Component {
  constructor(props) {
    super(props);
    this.loadSequence = 0;
    this.disposeSurfaceReaction = null;
  }

  componentDidMount() {
    // This component renders no DOM, so use an explicit reaction instead of
    // relying on an observer render to drive the extension lifecycle.
    this.disposeSurfaceReaction = reaction(
      () => {
        const current = this.props.store.pluginRegistry.activeSurface;
        return current && current.key;
      },
      () => this.syncSurface(),
      { fireImmediately: true },
    );
  }

  componentWillUnmount() {
    if (this.disposeSurfaceReaction) {
      this.disposeSurfaceReaction();
      this.disposeSurfaceReaction = null;
    }
    this.loadSequence += 1;
    FRONTEND_PLUGIN_RUNTIME.dispose();
  }

  async syncSurface() {
    const { pluginRegistry } = this.props.store;
    const contribution = pluginRegistry.activeSurface;
    const sequence = ++this.loadSequence;
    if (!contribution) {
      await FRONTEND_PLUGIN_RUNTIME.leave();
      return;
    }
    pluginRegistry.setExtensionLoading(true);
    try {
      const extension = await FRONTEND_PLUGIN_RUNTIME.enter(contribution);
      if (sequence !== this.loadSequence) {
        return;
      }
      const slots = extension && extension.getSlots
        ? await extension.getSlots() : [];
      pluginRegistry.setActiveExtension(extension, slots);
    } catch (error) {
      if (sequence === this.loadSequence) {
        pluginRegistry.setExtensionError(error);
      }
    }
  }

  render() {
    return null;
  }
}
