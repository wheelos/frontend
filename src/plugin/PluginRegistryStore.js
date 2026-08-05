import {
  action, computed, isObservableArray, observable,
} from 'mobx';

import { pluginHttpUrl } from './url';

const READY_STATES = new Set(['READY', 'DEGRADED']);
const CONTRIBUTION_KINDS = ['apps', 'workspaces', 'panels'];

function isContributionList(value) {
  // MobX 3 ObservableArray is array-like but intentionally fails
  // Array.isArray(), so registry entries need both checks.
  return Array.isArray(value) || isObservableArray(value);
}

function contributionKey(pluginId, kind, contributionId) {
  return `${pluginId}/${kind}/${contributionId}`;
}

function normalizeContribution(plugin, kind, contribution) {
  const normalized = {
    ...contribution,
    kind,
    pluginId: plugin.id,
    pluginName: plugin.name,
    pluginVersion: plugin.version,
    pluginState: plugin.state,
    pluginHealth: plugin.health,
    frontend: plugin.frontend,
  };
  normalized.key = contributionKey(plugin.id, kind, contribution.id);
  if (normalized.icon && !/^https?:|^data:|^\//.test(normalized.icon)) {
    normalized.icon = `/plugins/${plugin.id}/${normalized.icon}`;
  }
  const policy = normalized.availabilityPolicy || 'disable-when-unavailable';
  const backendReady = !normalized.requiresBackend || READY_STATES.has(plugin.state);
  normalized.disabled = !backendReady;
  normalized.visible = policy === 'always-show'
    || backendReady
    || policy === 'disable-when-unavailable';
  return normalized;
}

export default class PluginRegistryStore {
  @observable plugins = [];

  @observable loading = false;

  @observable error = '';

  @observable revision = 0;

  @observable activeSurface = null;

  @observable activeExtension = null;

  @observable activeSlots = [];

  @observable extensionLoading = false;

  @observable extensionError = '';

  @observable activePanel = null;

  @observable hmiLock = null;

  @observable commands = observable.map();

  constructor(rootStore) {
    this.rootStore = rootStore;
    this.pollTimer = null;
    this.popStateHandler = () => this.restoreRoute();
  }

  initialize() {
    window.addEventListener('popstate', this.popStateHandler);
    this.refresh();
  }

  dispose() {
    clearTimeout(this.pollTimer);
    window.removeEventListener('popstate', this.popStateHandler);
  }

  @action async refresh() {
    this.loading = this.plugins.length === 0;
    try {
      const response = await fetch(pluginHttpUrl('/api/plugins/registry'), {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      if (!response.ok) {
        throw new Error(`Plugin registry returned HTTP ${response.status}`);
      }
      const registry = await response.json();
      this.plugins = Array.isArray(registry.plugins) ? registry.plugins : [];
      this.revision = Number(registry.registryRevision || 0);
      this.error = '';
      this.restoreRoute();
    } catch (error) {
      this.error = error.message || String(error);
    } finally {
      this.loading = false;
      clearTimeout(this.pollTimer);
      const pending = this.plugins.some((plugin) => [
        'DISCOVERED', 'VALIDATED', 'STARTING',
      ].includes(plugin.state));
      this.pollTimer = setTimeout(() => this.refresh(), pending ? 1500 : 5000);
    }
  }

  @computed get contributions() {
    const result = [];
    this.plugins.forEach((plugin) => {
      CONTRIBUTION_KINDS.forEach((kind) => {
        const entries = plugin.contributions && plugin.contributions[kind];
        if (isContributionList(entries)) {
          entries.forEach((entry) => result.push(normalizeContribution(plugin, kind, entry)));
        }
      });
    });
    return result;
  }

  @computed get navigationItems() {
    return this.contributions
      .filter((item) => ['apps', 'workspaces'].includes(item.kind) && item.visible)
      .sort((first, second) => Number(first.order || 100) - Number(second.order || 100));
  }

  getContribution(pluginId, kind, contributionId) {
    return this.contributions.find((item) => item.pluginId === pluginId
      && item.kind === kind && item.id === contributionId);
  }

  getPanel(pluginId, panelId) {
    return this.getContribution(pluginId, 'panels', panelId);
  }

  @action openSurface(contribution, options = {}) {
    if (!contribution || contribution.disabled) {
      return false;
    }
    this.rootStore.closeBuiltinSurfaces();
    this.closePanel();
    this.activeSurface = contribution;
    this.activeExtension = null;
    this.activeSlots = [];
    this.extensionError = '';
    this.rootStore.options.pluginWorkspaceActive = contribution.kind === 'workspaces';
    this.rootStore.options.pluginAppActive = contribution.kind === 'apps';
    this.rootStore.dimension.update();
    if (!options.fromHistory) {
      const route = contribution.route
        || `/${contribution.kind === 'apps' ? 'apps' : 'workspace'}`
          + `/${contribution.pluginId}/${contribution.id}`;
      window.history.pushState({ pluginContribution: contribution.key }, '', route);
    }
    return true;
  }

  @action closeSurface(options = {}) {
    if (!this.activeSurface) {
      return;
    }
    this.closePanel();
    this.activeSurface = null;
    this.activeExtension = null;
    this.activeSlots = [];
    this.extensionLoading = false;
    this.extensionError = '';
    this.rootStore.options.pluginWorkspaceActive = false;
    this.rootStore.options.pluginAppActive = false;
    this.rootStore.dimension.update();
    if (!options.fromHistory) {
      window.history.pushState({}, '', '/');
    }
  }

  async canLeaveActiveSurface() {
    const extension = this.activeExtension;
    if (!extension || typeof extension.canLeave !== 'function') {
      return true;
    }
    const decision = await extension.canLeave();
    if (typeof decision === 'boolean') {
      return decision;
    }
    if (!decision || decision.allow !== false) {
      return true;
    }
    if (decision.message) {
      return window.confirm(decision.message);
    }
    return false;
  }

  async requestOpenSurface(contribution, options = {}) {
    if (this.activeSurface && this.activeSurface.key === (contribution && contribution.key)) {
      return true;
    }
    if (!(await this.canLeaveActiveSurface())) {
      return false;
    }
    return this.openSurface(contribution, options);
  }

  async requestCloseSurface(options = {}) {
    if (!(await this.canLeaveActiveSurface())) {
      return false;
    }
    this.closeSurface(options);
    return true;
  }

  @action setActiveExtension(extension, slots) {
    this.activeExtension = extension;
    this.activeSlots = Array.isArray(slots) ? slots : [];
    this.extensionLoading = false;
    this.extensionError = '';
  }

  @action setExtensionLoading(loading) {
    this.extensionLoading = loading;
  }

  @action setExtensionError(error) {
    this.extensionLoading = false;
    this.extensionError = error && (error.message || String(error));
  }

  @action openPanel(pluginId, panelId, initialConfig) {
    const panel = this.getPanel(pluginId, panelId);
    if (!panel || panel.disabled) {
      return false;
    }
    this.activePanel = { ...panel, initialConfig };
    this.rootStore.options.pluginPanelActive = true;
    this.rootStore.dimension.enableMonitor();
    return true;
  }

  @action closePanel() {
    if (!this.activePanel && !this.rootStore.options.pluginPanelActive) {
      return;
    }
    this.activePanel = null;
    this.rootStore.options.pluginPanelActive = false;
    this.rootStore.dimension.disableMonitor();
  }

  @action registerCommand(pluginId, command) {
    const id = `${pluginId}/${command.id}`;
    this.commands.set(id, { ...command, id });
    return () => this.commands.delete(id);
  }

  @action acquireHmiLock(pluginId, options = {}) {
    const token = `${pluginId}-${Date.now()}-${Math.random()}`;
    this.hmiLock = {
      token,
      pluginId,
      mode: options.mode !== false,
      map: options.map !== false,
      reason: options.reason || '',
    };
    return () => {
      if (this.hmiLock && this.hmiLock.token === token) {
        this.hmiLock = null;
      }
    };
  }

  restoreRoute() {
    if (!this.contributions.length) {
      return;
    }
    const path = window.location.pathname;
    const match = this.contributions.find((item) => item.route === path);
    if (match && !match.disabled
      && (!this.activeSurface || this.activeSurface.key !== match.key)) {
      this.openSurface(match, { fromHistory: true });
    } else if (!match && this.activeSurface) {
      this.closeSurface({ fromHistory: true });
    }
  }
}
