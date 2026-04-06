import { observable, action } from 'mobx';

export default class PointCloudMetrics {
  @observable pointCount = 0;

  @observable bandwidthKBs = 0.0;

  @observable fps = 0;

  @action updatePointCount(count) {
    this.pointCount = count;
  }

  @action updateBandwidth(kbs) {
    this.bandwidthKBs = kbs;
  }

  @action updateFps(fps) {
    this.fps = fps;
  }
}
