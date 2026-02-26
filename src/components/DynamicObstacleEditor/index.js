import React from 'react';
import { inject, observer } from 'mobx-react';
import classNames from 'classnames';

import WS from 'store/websocket';
import { ObstacleState, ObstacleType, TriggerType } from 'utils/dynamic_obstacle_constants';
import RENDERER from 'renderer';

import './style.scss';

const STATE_LABEL = {
  [ObstacleState.IDLE]: 'IDLE',
  [ObstacleState.MOVING]: 'MOVING',
  [ObstacleState.FINISHED]: 'FINISHED',
};

const STATE_COLOR = {
  [ObstacleState.IDLE]: '#FF6600',
  [ObstacleState.MOVING]: '#00FF88',
  [ObstacleState.FINISHED]: '#888888',
};

class TriggerConfig extends React.Component {
  render() {
    const { obstacle, manager } = this.props;
    const { trigger } = obstacle;

    return (
      <div className="trigger-config">
        <div className="trigger-type-row">
          <span className="field-label">Trigger:</span>
          <select
            value={trigger.type}
            onChange={(e) => manager.updateTrigger(obstacle.id, { type: e.target.value })}
          >
            <option value={TriggerType.TIME_DELAY}>Time Delay</option>
            <option value={TriggerType.DISTANCE_TO_EGO}>Distance to Ego</option>
            <option value={TriggerType.REACH_POSITION}>Reach Position</option>
          </select>
        </div>

        {trigger.type === TriggerType.TIME_DELAY && (
          <div className="trigger-param-row">
            <span className="field-label">Delay (s):</span>
            <input
              type="number"
              min="0"
              step="0.5"
              value={trigger.timeDelay}
              onChange={(e) =>
                manager.updateTrigger(obstacle.id, { timeDelay: parseFloat(e.target.value) })
              }
            />
          </div>
        )}

        {trigger.type === TriggerType.DISTANCE_TO_EGO && (
          <div className="trigger-param-row">
            <span className="field-label">Distance (m):</span>
            <input
              type="number"
              min="1"
              step="1"
              value={trigger.distanceToEgo}
              onChange={(e) =>
                manager.updateTrigger(obstacle.id, {
                  distanceToEgo: parseFloat(e.target.value),
                })
              }
            />
          </div>
        )}

        {trigger.type === TriggerType.REACH_POSITION && (
          <div className="trigger-param-row">
            <span className="field-label">Radius (m):</span>
            <input
              type="number"
              min="1"
              step="1"
              value={trigger.reachPosition ? trigger.reachPosition.radius : 5}
              onChange={(e) =>
                manager.updateTrigger(obstacle.id, {
                  reachPosition: {
                    ...(trigger.reachPosition || { x: 0, y: 0 }),
                    radius: parseFloat(e.target.value),
                  },
                })
              }
            />
          </div>
        )}
      </div>
    );
  }
}

class ObstacleCard extends React.Component {
  render() {
    const { obstacle, manager, isEditing } = this.props;
    const isThisEditing = isEditing && manager.editingObstacleId === obstacle.id;

    return (
      <div className={classNames('obstacle-card', { 'editing': isThisEditing })}>
        <div className="obstacle-card-header">
          <span className="obstacle-id">{obstacle.id}</span>
          <span
            className="obstacle-state"
            style={{ color: STATE_COLOR[obstacle.state] }}
          >
            {STATE_LABEL[obstacle.state]}
          </span>
          <button
            className="remove-btn"
            onClick={() => {
              if (isThisEditing) {
                manager.stopEditing();
              }
              manager.removeObstacle(obstacle.id);
            }}
          >
            ✕
          </button>
        </div>

        <div className="obstacle-card-body">
          <div className="field-row">
            <span className="field-label">Type:</span>
            <select
              value={obstacle.type}
              onChange={(e) => manager.updateObstacleType(obstacle.id, e.target.value)}
            >
              {Object.values(ObstacleType).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <TriggerConfig obstacle={obstacle} manager={manager} />

          <div className="path-section">
            <div className="path-header">
              <span className="field-label">
                Path Points: {obstacle.trajectory.length}
              </span>
            </div>
            <div className="path-actions">
              {!isThisEditing ? (
                <button
                  className="action-btn edit-path-btn"
                  onClick={() => manager.startEditing(obstacle.id)}
                  disabled={isEditing && !isThisEditing}
                >
                  Edit Path
                </button>
              ) : (
                <>
                  <button
                    className="action-btn confirm-path-btn"
                    onClick={() => manager.stopEditing()}
                  >
                    Confirm Path
                  </button>
                  <button
                    className="action-btn remove-last-btn"
                    onClick={() =>
                      RENDERER.removeLastDynamicObstaclePoint(obstacle.id)
                    }
                  >
                    Undo
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

@inject('store') @observer
export default class DynamicObstacleEditor extends React.Component {
  handleSend() {
    const { dynamicObstacleManager } = this.props.store;
    const payload = dynamicObstacleManager.obstacles.map((obs) => ({
      id: obs.id,
      type: obs.type,
      trajectory: obs.trajectory,
      trigger: obs.trigger,
      polygonVertices: obs.polygonVertices,
    }));
    WS.sendDynamicObstacleConfig(payload);
  }

  render() {
    const { dynamicObstacleManager } = this.props.store;
    const { obstacles, isEditing } = dynamicObstacleManager;

    return (
      <div className="dynamic-obstacle-editor card">
        <div className="card-header">
          <span>Dynamic Obstacles</span>
        </div>
        <div className="card-content-column">
          <div className="editor-tip">
            {isEditing
              ? 'Click on the map to add path waypoints. Click "Confirm Path" when done.'
              : 'Add obstacles and configure their paths and triggers.'}
          </div>

          <div className="obstacles-list">
            {obstacles.map((obs) => (
              <ObstacleCard
                key={obs.id}
                obstacle={obs}
                manager={dynamicObstacleManager}
                isEditing={isEditing}
              />
            ))}
          </div>

          <div className="editor-actions">
            <button
              className="command-button add-obstacle-btn"
              disabled={isEditing}
              onClick={() => dynamicObstacleManager.addObstacle()}
            >
              + Add Obstacle
            </button>
            <button
              className="command-button send-btn"
              disabled={isEditing || obstacles.length === 0}
              onClick={() => this.handleSend()}
            >
              Send Config
            </button>
          </div>
        </div>
      </div>
    );
  }
}
