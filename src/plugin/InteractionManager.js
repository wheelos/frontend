import STORE from 'store';
import RENDERER from 'renderer';

class InteractionManager {
  constructor() {
    this.active = null;
    this.listeners = [];
    this.sequence = 0;
  }

  async acquire(pluginId, provider) {
    if (!provider || !provider.id) {
      throw new Error('An interaction provider must declare an id');
    }
    if (this.active && this.active.pluginId !== pluginId) {
      throw new Error(
        `Scene interaction is already owned by ${this.active.pluginId}`,
      );
    }
    this.releaseActive();
    const previousRouteEditing = Boolean(STORE.options.showRouteEditingBar);
    const previousCameraAngle = STORE.options.cameraAngle;
    if (previousRouteEditing) {
      STORE.setOptionStatus('showRouteEditingBar', false);
    }
    STORE.options.selectCamera('Map');
    RENDERER.enableOrbitControls(false);
    const token = ++this.sequence;
    this.active = {
      pluginId,
      provider,
      token,
      previousCameraAngle,
      previousRouteEditing,
    };
    this.attach();
    try {
      if (provider.activate) {
        await provider.activate({ pluginId });
      }
    } catch (error) {
      if (this.active && this.active.token === token) {
        this.releaseActive();
      }
      throw error;
    }
    return {
      updateCursor: (cursor) => {
        const canvas = document.getElementById('canvas');
        if (this.active && this.active.token === token && canvas) {
          canvas.style.cursor = cursor || '';
        }
      },
      release: () => {
        if (this.active && this.active.token === token) {
          this.releaseActive();
        }
      },
    };
  }

  attach() {
    const canvas = document.getElementById('canvas');
    if (!canvas) {
      return;
    }
    const bindings = [
      ['mousemove', 'onPointerMove'],
      ['mousedown', 'onPointerDown'],
      ['mouseup', 'onPointerUp'],
      ['click', 'onClick'],
      ['dblclick', 'onDoubleClick'],
      ['contextmenu', 'onContextMenu'],
    ];
    bindings.forEach(([eventName, method]) => {
      const listener = (event) => this.dispatchPointer(method, event);
      canvas.addEventListener(eventName, listener, true);
      this.listeners.push(() => canvas.removeEventListener(eventName, listener, true));
    });
    const keyDown = (event) => this.dispatchKeyboard('onKeyDown', event);
    const keyUp = (event) => this.dispatchKeyboard('onKeyUp', event);
    window.addEventListener('keydown', keyDown, true);
    window.addEventListener('keyup', keyUp, true);
    this.listeners.push(() => window.removeEventListener('keydown', keyDown, true));
    this.listeners.push(() => window.removeEventListener('keyup', keyUp, true));
  }

  dispatchPointer(method, event) {
    const provider = this.active && this.active.provider;
    if (!provider || typeof provider[method] !== 'function') {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const sceneEvent = {
      screenX: event.clientX - rect.left,
      screenY: event.clientY - rect.top,
      worldPoint: RENDERER.getGeolocation(event),
      pickedEntity: RENDERER.pickPluginEntity(event),
      button: event.button,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
      originalEvent: event,
    };
    let handled = false;
    try {
      handled = provider[method](sceneEvent) === true;
    } catch (error) {
      console.error(`Plugin interaction ${provider.id} failed`, error);
      this.releaseActive();
      handled = true;
    }
    if (handled || method === 'onContextMenu') {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  dispatchKeyboard(method, event) {
    const provider = this.active && this.active.provider;
    if (!provider || typeof provider[method] !== 'function') {
      return;
    }
    try {
      if (provider[method](event) === true) {
        event.preventDefault();
        event.stopPropagation();
      }
    } catch (error) {
      console.error(`Plugin interaction ${provider.id} failed`, error);
      this.releaseActive();
    }
  }

  releasePlugin(pluginId) {
    if (this.active && this.active.pluginId === pluginId) {
      this.releaseActive();
    }
  }

  releaseActive() {
    if (!this.active) {
      return;
    }
    const active = this.active;
    this.active = null;
    this.listeners.splice(0).forEach((remove) => remove());
    const canvas = document.getElementById('canvas');
    if (canvas) {
      canvas.style.cursor = '';
    }
    RENDERER.enableOrbitControls(true);
    if (active.previousCameraAngle) {
      STORE.options.selectCamera(active.previousCameraAngle);
    }
    if (active.previousRouteEditing) {
      STORE.setOptionStatus('showRouteEditingBar', true);
    }
    if (active.provider.deactivate) {
      Promise.resolve(active.provider.deactivate()).catch((error) => {
        console.error(`Failed to deactivate interaction ${active.provider.id}`, error);
      });
    }
  }
}

const PLUGIN_INTERACTIONS = new InteractionManager();

export default PLUGIN_INTERACTIONS;
