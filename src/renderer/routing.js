import STORE from 'store';

import { drawPolylineBandFromPoints } from 'utils/draw';

export default class Routing {
  constructor() {
    this.routePaths = [];
    this.lastRoutingTime = -1;
  }

  update(routingTime, routePath, coordinates, scene) {
    this.routePaths.forEach((path) => {
      const routePathMesh = path;
      routePathMesh.visible = STORE.options.showRouting;
    });
    // There has not been a new routing published since last time.
    if (this.lastRoutingTime === routingTime || routePath === undefined) {
      return;
    }

    this.lastRoutingTime = routingTime;

    // Clear the old route paths
    this.routePaths.forEach((path) => {
      scene.remove(path);
      path.material.dispose();
      path.geometry.dispose();
    });

    routePath.forEach((path) => {
      const points = coordinates.applyOffsetToArray(path.point);
      const pathMesh = drawPolylineBandFromPoints(
        points,
        0.72,
        0x2F8FFF,
        0.7,
        0.42,
      );
      pathMesh.renderOrder = 2;
      pathMesh.visible = STORE.options.showRouting;
      scene.add(pathMesh);
      this.routePaths.push(pathMesh);
    });
  }
}
