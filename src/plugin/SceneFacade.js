import RENDERER from 'renderer';

export default class SceneFacade {
  constructor(pluginId, resolveScope = () => 'package') {
    this.pluginId = pluginId;
    this.resolveScope = resolveScope;
    this.layerScopes = new Map();
  }

  qualify(id) {
    if (!id || typeof id !== 'string') {
      throw new Error('Scene layer id must be a non-empty string');
    }
    return `${this.pluginId}:${id}`;
  }

  createLayer(options) {
    const id = this.qualify(options.id);
    // The first creator owns the layer lifecycle. Reusing a package layer from
    // a workspace must not silently downgrade it to a surface-scoped layer.
    if (!this.layerScopes.has(id)) {
      this.layerScopes.set(id, this.resolveScope());
    }
    RENDERER.createPluginLayer(id, options);
    return { id: options.id };
  }

  removeLayer(layerId) {
    const id = this.qualify(layerId);
    RENDERER.removePluginLayer(id);
    this.layerScopes.delete(id);
  }

  upsertEntities(layerId, entities) {
    RENDERER.upsertPluginEntities(this.qualify(layerId), entities);
  }

  replaceEntities(layerId, entities) {
    RENDERER.replacePluginEntities(this.qualify(layerId), entities);
  }

  removeEntities(layerId, entityIds) {
    RENDERER.removePluginEntities(this.qualify(layerId), entityIds);
  }

  clearLayer(layerId) {
    RENDERER.clearPluginLayer(this.qualify(layerId));
  }

  setLayerVisible(layerId, visible) {
    RENDERER.setPluginLayerVisible(this.qualify(layerId), visible);
  }

  worldToScreen(point) {
    return RENDERER.pluginWorldToScreen(point);
  }

  screenToWorld(point) {
    const canvas = document.getElementById('canvas');
    if (!canvas) {
      return null;
    }
    const rect = canvas.getBoundingClientRect();
    return RENDERER.getGeolocation({
      currentTarget: canvas,
      clientX: rect.left + point.x,
      clientY: rect.top + point.y,
    });
  }

  fitBounds(bounds) {
    RENDERER.fitPluginBounds(bounds);
  }

  disposeScope(scope) {
    this.layerScopes.forEach((layerScope, id) => {
      if (layerScope === scope) {
        RENDERER.removePluginLayer(id);
        this.layerScopes.delete(id);
      }
    });
  }

  disposeSurface() {
    this.disposeScope('surface');
  }

  dispose() {
    this.layerScopes.forEach((scope, id) => RENDERER.removePluginLayer(id));
    this.layerScopes.clear();
  }
}
