import { safeParseJSON } from 'utils/JSON';

/**
 * MultiTopicSubscriber manages subscriptions to multiple camera topics
 * over the existing camera WebSocket connection.
 */
export default class MultiTopicSubscriber {
  constructor(cameraWS) {
    this.cameraWS = cameraWS;
    this.subscribedTopics = [];
    this.frameCallbacks = new Map();
    this.messageHandler = null;
  }

  /**
   * Subscribe to a batch of camera topics.
   * @param {string[]} topics - Array of camera topic names to subscribe to.
   */
  subscribeTopics(topics) {
    this.subscribedTopics = [...topics];

    const { websocket } = this.cameraWS;
    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
      console.warn('MultiTopicSubscriber: WebSocket not open, cannot subscribe.');
      return;
    }

    websocket.send(JSON.stringify({
      type: 'SubscribeToTopics',
      data: { topics },
    }));

    this.messageHandler = (event) => {
      if (event.data instanceof ArrayBuffer) {
        return;
      }
      const message = safeParseJSON(event.data);
      if (!message) {
        return;
      }
      const { topic, image } = message;
      if (topic && image && this.frameCallbacks.has(topic)) {
        this.frameCallbacks.get(topic)(image);
      }
    };

    websocket.addEventListener('message', this.messageHandler);
  }

  /**
   * Register a callback to receive frames for a specific topic.
   * @param {string} topic
   * @param {function} callback - Called with base64 image string.
   */
  onFrame(topic, callback) {
    this.frameCallbacks.set(topic, callback);
  }

  /**
   * Unregister the frame callback for a specific topic.
   * @param {string} topic
   */
  offFrame(topic) {
    this.frameCallbacks.delete(topic);
  }

  /**
   * Unsubscribe from all camera topics and clean up.
   */
  unsubscribeAll() {
    if (this.subscribedTopics.length === 0) {
      return;
    }

    const { websocket } = this.cameraWS;
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      websocket.send(JSON.stringify({
        type: 'UnsubscribeFromTopics',
        data: { topics: this.subscribedTopics },
      }));
    }

    if (this.messageHandler && websocket) {
      websocket.removeEventListener('message', this.messageHandler);
      this.messageHandler = null;
    }

    this.subscribedTopics = [];
    this.frameCallbacks.clear();
  }
}
