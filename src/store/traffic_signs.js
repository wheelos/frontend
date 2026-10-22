import { observable, action } from 'mobx';

// Expire by receipt time: record timestamps can be years in the past.
export default class TrafficSigns {
  @observable signs = [];

  expiryTimer = null;

  @action clear() {
    clearTimeout(this.expiryTimer);
    this.expiryTimer = null;
    this.signs = [];
  }

  @action update(message) {
    this.clear();
    const validSigns = (Array.isArray(message.signs) ? message.signs : [])
      .filter((sign) => sign && typeof sign.className === 'string'
        && sign.className.trim() && Number.isFinite(sign.score)
        && sign.score >= 0 && sign.score <= 1)
      .map((sign) => ({
        className: (typeof sign.displayName === 'string' && sign.displayName.trim())
          || sign.className.trim(),
        signType: typeof sign.signType === 'string' ? sign.signType.trim() : '',
        score: sign.score,
      }));
    // One notification per label, using its strongest detection.
    const labels = new Map();
    validSigns.forEach((sign) => {
      if (!labels.has(sign.className) || labels.get(sign.className).score < sign.score) {
        labels.set(sign.className, sign);
      }
    });
    this.signs = Array.from(labels.values());
    if (this.signs.length) {
      this.expiryTimer = setTimeout(() => this.clear(), 2000);
    }
  }
}
