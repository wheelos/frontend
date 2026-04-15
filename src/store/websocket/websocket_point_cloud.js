import STORE from 'store';
import RENDERER from 'renderer';
import Worker from 'utils/webworker.js';
import { safeParseJSON } from 'utils/JSON';

export default class PointCloudWebSocketEndpoint {
  constructor(serverAddr) {
    this.serverAddr = serverAddr;
    this.websocket = null;
    this.worker = new Worker();
    this.enabled = false;
    // Bandwidth tracking: accumulate bytes and flush to the metrics store
    // once per second so the HUD shows a stable KB/s reading.
    this._bytesReceived = 0;
    this._bandwidthLastTimestamp = null;
  }

  initialize() {
    try {
      this.websocket = new WebSocket(this.serverAddr);
      this.websocket.binaryType = 'arraybuffer';
    } catch (error) {
      console.error(`Failed to establish a connection: ${error}`);
      setTimeout(() => {
        this.initialize();
      }, 1000);
      return;
    }
    this.websocket.onmessage = (event) => {
      // Accumulate bytes for bandwidth measurement.
      const now = performance.now();
      if (this._bandwidthLastTimestamp === null) {
        this._bandwidthLastTimestamp = now;
      }

      const bytes = event.data instanceof ArrayBuffer
        ? event.data.byteLength
        : event.data.length;
      this._bytesReceived += bytes;
      const elapsed = now - this._bandwidthLastTimestamp;
      if (elapsed >= 1000) {
        STORE.pointCloudMetrics.updateBandwidth(
          (this._bytesReceived * 1000) / (1024 * elapsed),
        );
        this._bytesReceived = 0;
        this._bandwidthLastTimestamp = now;
      }

      this.worker.postMessage({
        source: 'point_cloud',
        data: event.data,
      });
    };
    this.websocket.onclose = (event) => {
      console.log(`WebSocket connection closed with code: ${event.code}`);
      this.initialize();
    };
    this.worker.onmessage = (event) => {
      if (event.data.type === 'PointCloudStatus') {
        STORE.setOptionStatus('showPointCloud', event.data.enabled);
        if (STORE.options.showPointCloud === false) {
          RENDERER.updatePointCloud({ num: [] });
        }
      } else if (STORE.options.showPointCloud === true && event.data.num !== undefined) {
        RENDERER.updatePointCloud(event.data);
      }
    };
    return this;
  }

  requestPointCloud() {
    const wsReady = this.websocket.readyState === this.websocket.OPEN;
    const showPointCloud = STORE.options.showPointCloud === true;

    if (wsReady && showPointCloud) {
      this.websocket.send(JSON.stringify({
        type: 'RequestPointCloud',
      }));
    }
  }

  isEnabled() {
    return this.enabled;
  }

  togglePointCloud(enable) {
    this.enabled = enable;
    this.websocket.send(JSON.stringify({
      type: 'TogglePointCloud',
      enable,
    }));
    if (STORE.options.showPointCloud === false) {
      RENDERER.updatePointCloud({ num: [] });
    }
  }

  getPointCloudChannel() {
    return new Promise(
      (resolve, reject) => {
        this.websocket.send(JSON.stringify({
          type: 'GetPointCloudChannel',
        }));
        this.websocket.addEventListener('message', (event) => {
          if (event.data instanceof ArrayBuffer) {
            return;
          }
          const message = safeParseJSON(event.data);
          if (message?.data?.name === 'GetPointCloudChannelListSuccess') {
            if (message?.data?.info?.channel) {
              resolve(message?.data?.info?.channel);
            } else {
              reject(message?.data.info);
            }
          } else if (message?.data?.name === 'GetPointCloudChannelListFail') {
            reject(message?.data.info);
          }
        });
      },
    );
  }

  changePointCloudChannel(channel) {
    this.websocket.send(JSON.stringify({
      type: 'ChangePointCloudChannel',
      data: channel,
    }));
  }
}
