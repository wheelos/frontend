import { observable, action } from 'mobx';

import RENDERER from 'renderer';
import {
  ObstacleState, TriggerType, ObstacleType,
} from 'utils/dynamic_obstacle_constants';

export { ObstacleState, TriggerType, ObstacleType };

let nextId = 1;

export default class DynamicObstacleManager {
  @observable obstacles = [];

  @observable isEditing = false;

  @observable editingObstacleId = null;

  @action addObstacle() {
    const id = `dyn_obs_${nextId++}`;
    const obstacle = {
      id,
      type: ObstacleType.VEHICLE,
      state: ObstacleState.IDLE,
      polygonVertices: [],
      trajectory: [],
      trigger: {
        type: TriggerType.TIME_DELAY,
        timeDelay: 3.0,
        distanceToEgo: 20.0,
        reachPosition: { x: 0, y: 0, radius: 5.0 },
      },
    };
    this.obstacles.push(observable(obstacle));
    return id;
  }

  @action removeObstacle(id) {
    this.obstacles = this.obstacles.filter((o) => o.id !== id);
    if (this.editingObstacleId === id) {
      this.editingObstacleId = null;
      this.isEditing = false;
    }
  }

  @action updateObstacleState(id, state) {
    const obstacle = this.obstacles.find((o) => o.id === id);
    if (obstacle) {
      obstacle.state = state;
    }
  }

  @action updateObstacleType(id, type) {
    const obstacle = this.obstacles.find((o) => o.id === id);
    if (obstacle) {
      obstacle.type = type;
    }
  }

  @action updateTrigger(id, trigger) {
    const obstacle = this.obstacles.find((o) => o.id === id);
    if (obstacle) {
      obstacle.trigger = { ...obstacle.trigger, ...trigger };
    }
  }

  @action setTrajectory(id, points) {
    const obstacle = this.obstacles.find((o) => o.id === id);
    if (obstacle) {
      obstacle.trajectory = points;
    }
  }

  @action setPolygonVertices(id, vertices) {
    const obstacle = this.obstacles.find((o) => o.id === id);
    if (obstacle) {
      obstacle.polygonVertices = vertices;
    }
  }

  @action startEditing(id) {
    this.editingObstacleId = id;
    this.isEditing = true;
    RENDERER.enableDynamicObstacleEditing(id);
  }

  @action stopEditing() {
    if (this.isEditing) {
      const points = RENDERER.getDynamicObstacleTrajectoryPoints(this.editingObstacleId);
      if (points && points.length > 0) {
        this.setTrajectory(this.editingObstacleId, points);
      }
      RENDERER.disableDynamicObstacleEditing(this.editingObstacleId);
    }
    this.isEditing = false;
    this.editingObstacleId = null;
  }

  @action updateFromWorld(dynamicObstacles) {
    if (!dynamicObstacles || dynamicObstacles.length === 0) {
      return;
    }
    dynamicObstacles.forEach((incoming) => {
      const existing = this.obstacles.find((o) => o.id === incoming.id);
      if (existing && incoming.state) {
        existing.state = incoming.state;
      }
    });
  }
}
