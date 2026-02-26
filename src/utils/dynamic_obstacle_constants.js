export const ObstacleState = Object.freeze({
  IDLE: 'IDLE',
  MOVING: 'MOVING',
  FINISHED: 'FINISHED',
});

export const TriggerType = Object.freeze({
  REACH_POSITION: 'reach_position',
  DISTANCE_TO_EGO: 'distance_to_ego',
  TIME_DELAY: 'time_delay',
});

export const ObstacleType = Object.freeze({
  VEHICLE: 'VEHICLE',
  PEDESTRIAN: 'PEDESTRIAN',
  BICYCLE: 'BICYCLE',
  UNKNOWN: 'UNKNOWN',
});
