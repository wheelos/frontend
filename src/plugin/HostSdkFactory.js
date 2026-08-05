import { autorun } from 'mobx';

import STORE from 'store';
import WS from 'store/websocket';

import PLUGIN_GATEWAY from './PluginGateway';
import PLUGIN_INTERACTIONS from './InteractionManager';
import SceneFacade from './SceneFacade';
import { pluginHttpUrl } from './url';

function snapshot() {
  const { hmi } = STORE;
  const adc = (STORE.meters && STORE.meters.world) || {};
  return {
    map: {
      name: hmi.currentMap,
      loaded: hmi.currentMap !== 'none',
      available: (hmi.maps || []).slice(),
    },
    vehicle: {
      id: hmi.currentVehicle,
      type: hmi.currentVehicle,
      available: (hmi.vehicles || []).slice(),
    },
    mode: hmi.currentMode,
    modes: (hmi.modes || []).slice(),
    localization: {
      available: Boolean(STORE.isInitialized),
      position: STORE.geolocation,
    },
    modules: hmi.moduleStatus && hmi.moduleStatus.toJS
      ? hmi.moduleStatus.toJS() : {},
    theme: STORE.options.themeMode,
    timestamp: STORE.timestamp,
    adc,
  };
}

class PluginHostContextImpl {
  constructor(plugin) {
    this.plugin = {
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
    };
    this.pluginDescriptor = plugin;
    this.sceneFacade = new SceneFacade(
      plugin.id,
      () => (this.surfaceActive ? 'surface' : 'package'),
    );
    this.packageCleanups = new Set();
    this.surfaceCleanups = new Set();
    this.surfaceActive = false;

    this.rpc = {
      call: (method, request, options) => this.callRpc(method, request, options),
    };
    this.events = {
      subscribe: (topic, callback) => this.track(
        PLUGIN_GATEWAY.subscribeEvent(plugin.id, topic, callback),
      ),
    };
    this.streams = {
      subscribe: (streamId, options, callback) => this.track(
        PLUGIN_GATEWAY.subscribeStream(plugin.id, streamId, options || {}, callback),
      ),
    };
    this.scene = this.sceneFacade;
    this.interaction = {
      acquire: (provider) => PLUGIN_INTERACTIONS.acquire(plugin.id, provider),
    };
    this.hmi = {
      getSnapshot: () => snapshot(),
      selectMode: async (mode) => WS.changeSetupMode(mode),
      setupMode: async () => WS.executeModeCommand('SETUP_MODE'),
      resetMode: async () => WS.executeModeCommand('RESET_MODE'),
      enterAutoMode: async () => WS.executeModeCommand('ENTER_AUTO_MODE'),
      startModule: async (moduleName) => WS.executeModuleCommand(moduleName, 'START_MODULE'),
      stopModule: async (moduleName) => WS.executeModuleCommand(moduleName, 'STOP_MODULE'),
      setSimControl: async (enabled) => WS.toggleSimControl(enabled),
      acquireLock: (options = {}) => this.track(
        STORE.pluginRegistry.acquireHmiLock(plugin.id, options),
        options.lifecycle,
      ),
    };
    this.maps = {
      list: () => (STORE.hmi.maps || []).slice(),
      getCurrent: () => STORE.hmi.currentMap,
      select: async (map) => WS.changeMap(map),
    };
    this.routing = {
      startEditing: () => STORE.setOptionStatus('showRouteEditingBar', true),
      stopEditing: () => STORE.setOptionStatus('showRouteEditingBar', false),
      clear: () => STORE.routeEditingManager.removeAllRoutingPoints(),
      send: () => STORE.routeEditingManager.sendRoutingRequest(STORE.hmi.inNavigationMode),
    };
    this.workspace = {
      close: () => STORE.pluginRegistry.requestCloseSurface(),
      getActive: () => STORE.pluginRegistry.activeSurface,
    };
    this.panels = {
      open: (panelId, initialConfig) => (
        STORE.pluginRegistry.openPanel(plugin.id, panelId, initialConfig)
      ),
      close: () => STORE.pluginRegistry.closePanel(),
      getActive: () => STORE.pluginRegistry.activePanel,
    };
    this.commands = {
      register: (command) => this.track(
        STORE.pluginRegistry.registerCommand(plugin.id, command),
      ),
      execute: async (commandId, args) => {
        const command = STORE.pluginRegistry.commands.get(`${plugin.id}/${commandId}`);
        if (!command || typeof command.execute !== 'function') {
          throw new Error(`Plugin command is unavailable: ${commandId}`);
        }
        return command.execute(args);
      },
    };
    this.navigation = {
      openApp: (pluginId, appId) => {
        const target = STORE.pluginRegistry.getContribution(pluginId, 'apps', appId);
        return STORE.pluginRegistry.requestOpenSurface(target);
      },
      openWorkspace: (pluginId, workspaceId) => {
        const target = STORE.pluginRegistry.getContribution(
          pluginId, 'workspaces', workspaceId,
        );
        return STORE.pluginRegistry.requestOpenSurface(target);
      },
      close: () => STORE.pluginRegistry.requestCloseSurface(),
    };
    this.context = {
      getSnapshot: () => snapshot(),
      subscribe: (callback) => this.track(autorun(() => callback(snapshot()))),
    };
    this.storage = {
      get: async (key) => {
        const value = localStorage.getItem(`${plugin.id}:${key}`);
        return value === null ? undefined : JSON.parse(value);
      },
      set: async (key, value) => {
        localStorage.setItem(`${plugin.id}:${key}`, JSON.stringify(value));
      },
      remove: async (key) => localStorage.removeItem(`${plugin.id}:${key}`),
    };
    this.settings = {
      get: (key, fallback) => {
        const value = localStorage.getItem(`${plugin.id}:setting:${key}`);
        return value === null ? fallback : JSON.parse(value);
      },
      set: (key, value) => {
        localStorage.setItem(`${plugin.id}:setting:${key}`, JSON.stringify(value));
      },
    };
    this.resources = {
      getUrl: (mountId, path = '') => pluginHttpUrl(
        `/plugins/${plugin.id}/resources/${mountId}/${path}`,
      ),
      fetch: (mountId, path = '', options) => fetch(
        pluginHttpUrl(`/plugins/${plugin.id}/resources/${mountId}/${path}`),
        options,
      ),
    };
    this.resources.url = this.resources.getUrl;
    this.artifacts = {
      getDownloadUrl: (artifact) => this.resources.getUrl(
        artifact.mountId, artifact.relativePath,
      ),
    };
    this.artifacts.url = this.artifacts.getDownloadUrl;
    this.jobs = {
      start: (jobType, input, options) => this.rpc.call(
        'job.start', { jobType, input }, options,
      ),
      get: (jobId, options) => this.rpc.call('job.get', { jobId }, options),
      list: (query, options) => this.rpc.call('job.list', query || {}, options),
      cancel: (jobId, options) => this.rpc.call('job.cancel', { jobId }, options),
      subscribe: (callback) => this.events.subscribe('plugin.job.updated', callback),
    };
    this.notification = {
      info: (message) => STORE.monitor.insert('INFO', message, Date.now()),
      warning: (message) => STORE.monitor.insert('WARN', message, Date.now()),
      error: (message) => STORE.monitor.insert('ERROR', message, Date.now()),
    };
    this.logger = {
      debug: (...args) => console.debug(`[${plugin.id}]`, ...args),
      info: (...args) => console.info(`[${plugin.id}]`, ...args),
      warn: (...args) => console.warn(`[${plugin.id}]`, ...args),
      error: (...args) => console.error(`[${plugin.id}]`, ...args),
    };
    this.theme = {
      get: () => STORE.options.themeMode,
      subscribe: (callback) => this.track(autorun(() => callback(STORE.options.themeMode))),
    };
    this.ui = {
      getThemeClass: () => `theme-${STORE.options.themeMode}`,
    };
  }

  track(cleanup, lifecycle) {
    const collection = lifecycle === 'package' || (!lifecycle && !this.surfaceActive)
      ? this.packageCleanups : this.surfaceCleanups;
    collection.add(cleanup);
    return () => {
      if (collection.delete(cleanup)) {
        cleanup();
      }
    };
  }

  callRpc(method, request, options = {}) {
    const controller = new AbortController();
    const collection = this.surfaceActive ? this.surfaceCleanups : this.packageCleanups;
    const cancel = () => controller.abort();
    collection.add(cancel);

    const callerSignal = options.signal;
    const cancelFromCaller = () => controller.abort();
    if (callerSignal) {
      if (callerSignal.aborted) {
        controller.abort();
      } else {
        callerSignal.addEventListener('abort', cancelFromCaller, { once: true });
      }
    }

    const rpcOptions = { ...options, signal: controller.signal };
    return PLUGIN_GATEWAY.call(this.plugin.id, method, request, rpcOptions)
      .finally(() => {
        collection.delete(cancel);
        if (callerSignal) {
          callerSignal.removeEventListener('abort', cancelFromCaller);
        }
      });
  }

  beginSurface() {
    this.endSurface();
    this.surfaceActive = true;
  }

  endSurface() {
    this.surfaceActive = false;
    this.surfaceCleanups.forEach((cleanup) => cleanup());
    this.surfaceCleanups.clear();
    PLUGIN_INTERACTIONS.releasePlugin(this.plugin.id);
    this.sceneFacade.disposeSurface();
  }

  dispose() {
    this.endSurface();
    this.packageCleanups.forEach((cleanup) => cleanup());
    this.packageCleanups.clear();
    this.sceneFacade.dispose();
  }
}

const contexts = new Map();

export function getPluginHostContext(plugin) {
  if (!contexts.has(plugin.id)) {
    contexts.set(plugin.id, new PluginHostContextImpl(plugin));
  }
  return contexts.get(plugin.id);
}

export function disposePluginHostContext(pluginId) {
  const context = contexts.get(pluginId);
  if (context) {
    context.dispose();
    contexts.delete(pluginId);
  }
}
