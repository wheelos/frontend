import { pluginWebSocketUrl } from './url';

function makeId(prefix) {
  const random = Math.random().toString(16).slice(2);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

class ReconnectingSocket {
  constructor(path, onMessage) {
    this.url = pluginWebSocketUrl(path);
    this.onMessage = onMessage;
    this.socket = null;
    this.queue = [];
    this.closed = false;
    this.hasOpened = false;
    this.reconnectTimer = null;
    this.onReconnect = null;
  }

  connect() {
    if (this.closed || (this.socket
      && [WebSocket.OPEN, WebSocket.CONNECTING].includes(this.socket.readyState))) {
      return;
    }
    const socket = new WebSocket(this.url);
    socket.binaryType = 'arraybuffer';
    this.socket = socket;
    socket.onopen = () => {
      const queued = this.queue.splice(0);
      queued.forEach((message) => socket.send(message));
      if (this.hasOpened && this.onReconnect) {
        this.onReconnect();
      }
      this.hasOpened = true;
    };
    socket.onmessage = this.onMessage;
    socket.onclose = () => {
      if (this.socket === socket) {
        this.socket = null;
      }
      if (!this.closed) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => this.connect(), 1000);
      }
    };
    socket.onerror = () => socket.close();
  }

  send(message) {
    const encoded = typeof message === 'string' ? message : JSON.stringify(message);
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(encoded);
    } else {
      this.queue.push(encoded);
      this.connect();
    }
  }

  close() {
    this.closed = true;
    clearTimeout(this.reconnectTimer);
    this.queue = [];
    if (this.socket) {
      this.socket.close();
    }
  }
}

class PluginGateway {
  constructor() {
    this.pending = new Map();
    this.eventSubscriptions = new Map();
    this.streamSubscriptions = new Map();
    this.control = new ReconnectingSocket('/plugin', (event) => this.handleControl(event));
    this.stream = new ReconnectingSocket('/plugin-stream', (event) => this.handleStream(event));
    this.control.onReconnect = () => this.restoreEventSubscriptions();
    this.stream.onReconnect = () => this.restoreStreamSubscriptions();
  }

  initialize() {
    this.control.connect();
    this.stream.connect();
  }

  call(pluginId, method, payload = {}, options = {}) {
    this.initialize();
    const requestId = makeId('rpc');
    const timeoutMs = options.timeoutMs || 5000;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(requestId);
        if (options.signal) {
          options.signal.removeEventListener('abort', abort);
        }
        const error = new Error(`Plugin request timed out: ${method}`);
        error.code = 'DEADLINE_EXCEEDED';
        reject(error);
      }, timeoutMs + 250);
      const abort = () => {
        clearTimeout(timeout);
        this.pending.delete(requestId);
        const error = new Error(`Plugin request cancelled: ${method}`);
        error.code = 'ABORTED';
        reject(error);
      };
      if (options.signal) {
        if (options.signal.aborted) {
          abort();
          return;
        }
        options.signal.addEventListener('abort', abort, { once: true });
      }
      this.pending.set(requestId, {
        resolve,
        reject,
        timeout,
        signal: options.signal,
        abort,
      });
      this.control.send({
        type: 'rpc.request',
        pluginId,
        requestId,
        method,
        timeoutMs,
        idempotencyKey: options.idempotencyKey || '',
        payload,
      });
    });
  }

  subscribeEvent(pluginId, topic, callback) {
    this.initialize();
    const subscriptionId = makeId('event');
    this.eventSubscriptions.set(subscriptionId, { pluginId, topic, callback });
    this.sendEventSubscription(subscriptionId);
    return () => {
      if (!this.eventSubscriptions.has(subscriptionId)) {
        return;
      }
      this.eventSubscriptions.delete(subscriptionId);
      this.control.send({ type: 'event.unsubscribe', subscriptionId });
    };
  }

  subscribeStream(pluginId, streamId, options, callback) {
    this.initialize();
    const subscriptionId = makeId('stream');
    this.streamSubscriptions.set(subscriptionId, {
      pluginId,
      streamId,
      frequencyHz: options.frequencyHz,
      frame: options.frame,
      callback,
    });
    this.sendStreamSubscription(subscriptionId);
    return () => {
      if (!this.streamSubscriptions.has(subscriptionId)) {
        return;
      }
      this.streamSubscriptions.delete(subscriptionId);
      this.stream.send({ type: 'stream.unsubscribe', subscriptionId });
    };
  }

  sendEventSubscription(subscriptionId) {
    const subscription = this.eventSubscriptions.get(subscriptionId);
    if (subscription) {
      this.control.send({
        type: 'event.subscribe',
        subscriptionId,
        pluginId: subscription.pluginId,
        topic: subscription.topic,
      });
    }
  }

  sendStreamSubscription(subscriptionId) {
    const subscription = this.streamSubscriptions.get(subscriptionId);
    if (subscription) {
      this.stream.send({
        type: 'stream.subscribe',
        subscriptionId,
        pluginId: subscription.pluginId,
        streamId: subscription.streamId,
        frequencyHz: subscription.frequencyHz,
        frame: subscription.frame,
      });
    }
  }

  restoreEventSubscriptions() {
    this.eventSubscriptions.forEach((_, id) => this.sendEventSubscription(id));
  }

  restoreStreamSubscriptions() {
    this.streamSubscriptions.forEach((_, id) => this.sendStreamSubscription(id));
  }

  handleControl(event) {
    if (typeof event.data !== 'string') {
      return;
    }
    let message;
    try {
      message = JSON.parse(event.data);
    } catch (error) {
      console.error('Invalid plugin gateway message', error);
      return;
    }
    if (message.type === 'rpc.response') {
      const pending = this.pending.get(message.requestId);
      if (!pending) {
        return;
      }
      clearTimeout(pending.timeout);
      if (pending.signal) {
        pending.signal.removeEventListener('abort', pending.abort);
      }
      this.pending.delete(message.requestId);
      if (message.ok) {
        pending.resolve(message.payload || {});
      } else {
        const error = new Error((message.error && message.error.message)
          || 'Plugin request failed');
        error.code = message.error && message.error.code;
        error.details = message.error && message.error.details;
        pending.reject(error);
      }
      return;
    }
    if (message.type === 'event.data') {
      const subscription = this.eventSubscriptions.get(message.subscriptionId);
      if (subscription) {
        subscription.callback(message.payload, message);
      }
    }
  }

  handleStream(event) {
    if (!(event.data instanceof ArrayBuffer) || event.data.byteLength < 4) {
      return;
    }
    const view = new DataView(event.data);
    const headerSize = view.getUint32(0, false);
    if (headerSize <= 0 || headerSize + 4 > event.data.byteLength) {
      return;
    }
    let header;
    try {
      const bytes = new Uint8Array(event.data, 4, headerSize);
      header = JSON.parse(new TextDecoder('utf-8').decode(bytes));
    } catch (error) {
      console.error('Invalid plugin stream frame', error);
      return;
    }
    const subscription = this.streamSubscriptions.get(header.subscriptionId);
    if (!subscription) {
      return;
    }
    const payload = new Uint8Array(event.data, headerSize + 4);
    subscription.callback(payload, header);
  }
}

const PLUGIN_GATEWAY = new PluginGateway();

export default PLUGIN_GATEWAY;
