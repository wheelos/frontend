import { loadRemoteModule } from './RemoteModuleLoader';
import {
  disposePluginHostContext,
  getPluginHostContext,
} from './HostSdkFactory';

function normalizeExport(module) {
  return module && (module.default || module);
}

class FrontendPluginRuntime {
  constructor() {
    this.packages = new Map();
    this.current = null;
  }

  async activatePackage(plugin) {
    if (this.packages.has(plugin.id)) {
      return this.packages.get(plugin.id);
    }
    if (!plugin.frontend) {
      throw new Error(`Plugin does not provide a frontend: ${plugin.id}`);
    }
    const context = getPluginHostContext(plugin);
    const module = await loadRemoteModule(plugin.frontend, plugin.frontend.entryModule);
    const extensionPackage = normalizeExport(module);
    if (extensionPackage && extensionPackage.activate) {
      await extensionPackage.activate(context);
    }
    const record = {
      plugin,
      context,
      extensionPackage,
      activatedExtensions: new Set(extensionPackage ? [extensionPackage] : []),
    };
    this.packages.set(plugin.id, record);
    return record;
  }

  async activateExtension(record, extension) {
    if (!extension || record.activatedExtensions.has(extension)) {
      return;
    }
    if (extension.activate) {
      await extension.activate(record.context);
    }
    record.activatedExtensions.add(extension);
  }

  async enter(contribution) {
    await this.leave();
    const plugin = {
      id: contribution.pluginId,
      name: contribution.pluginName,
      version: contribution.pluginVersion,
      frontend: contribution.frontend,
    };
    const record = await this.activatePackage(plugin);
    record.context.beginSurface();
    try {
      const module = await loadRemoteModule(contribution.frontend, contribution.module);
      const extension = normalizeExport(module);
      await this.activateExtension(record, extension);
      if (extension && extension.onEnter) {
        await extension.onEnter({
          host: record.context,
          contribution,
          route: window.location.pathname,
          params: {},
          query: Object.fromEntries(new URLSearchParams(window.location.search)),
        });
      }
      this.current = { contribution, record, extension };
      return extension;
    } catch (error) {
      record.context.endSurface();
      throw error;
    }
  }

  async leave() {
    if (!this.current) {
      return;
    }
    const { extension, record } = this.current;
    this.current = null;
    try {
      if (extension && extension.onLeave) {
        await extension.onLeave();
      }
    } finally {
      record.context.endSurface();
    }
  }

  async canLeave() {
    if (!this.current || !this.current.extension
      || typeof this.current.extension.canLeave !== 'function') {
      return { allow: true };
    }
    const decision = await this.current.extension.canLeave();
    if (typeof decision === 'boolean') {
      return { allow: decision };
    }
    return decision || { allow: true };
  }

  async loadPanel(panel) {
    const plugin = {
      id: panel.pluginId,
      name: panel.pluginName,
      version: panel.pluginVersion,
      frontend: panel.frontend,
    };
    const record = await this.activatePackage(plugin);
    const module = await loadRemoteModule(panel.frontend, panel.module);
    const extension = normalizeExport(module);
    await this.activateExtension(record, extension);
    return { extension, context: record.context };
  }

  async dispose() {
    await this.leave();
    const records = Array.from(this.packages.values());
    this.packages.clear();
    await Promise.all(records.map(async ({ plugin, activatedExtensions }) => {
      try {
        const extensions = Array.from(activatedExtensions).reverse();
        for (const extension of extensions) {
          if (extension && extension.deactivate) {
            await extension.deactivate();
          }
        }
      } finally {
        disposePluginHostContext(plugin.id);
      }
    }));
  }
}

const FRONTEND_PLUGIN_RUNTIME = new FrontendPluginRuntime();

export default FRONTEND_PLUGIN_RUNTIME;
