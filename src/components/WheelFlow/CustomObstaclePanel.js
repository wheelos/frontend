/* eslint-disable react/prop-types, react/jsx-filename-extension */
/* eslint-disable jsx-a11y/label-has-associated-control */
import React from 'react';
import { inject, observer } from 'mobx-react';

import WS from 'store/websocket';

import './style.scss';

const OBSTACLE_TYPES = ['Vehicle', 'Bicycle', 'Pedestrian', 'Truck'];
const MOTION_TYPES = ['Static', 'FollowPath'];
const END_BEHAVIORS = ['StopAtEnd', 'Loop'];

function SelectRow({
  label,
  value,
  disabled,
  options,
  onChange,
}) {
  return (
    <label className="custom-obstacle-row">
      <span>{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function NumberRow({
  label,
  value,
  disabled,
  step = 0.1,
  onChange,
}) {
  return (
    <label className="custom-obstacle-row">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        step={step}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

@inject('store') @observer
export default class CustomObstaclePanel extends React.Component {
  closePanel() {
    const { store } = this.props;
    if (store.options.showWheelFlowCustomObstacles) {
      store.handleOptionToggle('showWheelFlowCustomObstacles');
    } else {
      store.wheelflow.closeCustomObstaclePanel();
    }
  }

  render() {
    const { store } = this.props;
    const wheelflow = store.wheelflow;
    const draft = wheelflow.customObstacleDraft;
    const selected = wheelflow.selectedCustomObstacle();
    const selectedFollowPath = selected && selected.motionType === 'FollowPath';
    const draftFollowPath = draft.motionType === 'FollowPath';

    return (
      <div className="custom-obstacle-panel monitor">
        <div className="custom-obstacle-title">
          <span>Custom Obstacles</span>
          <button type="button" onClick={() => this.closePanel()}>Close</button>
        </div>

        <div className="custom-obstacle-body">
          <section>
            <h4>Mode</h4>
            <div className="custom-obstacle-mode">{wheelflow.customObstacleMode}</div>
          </section>

          <section>
            <h4>New Obstacle</h4>
            <SelectRow
              label="Obstacle Type"
              value={draft.type}
              options={OBSTACLE_TYPES}
              onChange={(type) => wheelflow.updateCustomObstacleDraft({ type })}
            />
            <SelectRow
              label="Motion Type"
              value={draft.motionType}
              options={MOTION_TYPES}
              onChange={(motionType) => wheelflow.updateCustomObstacleDraft({ motionType })}
            />
            <NumberRow
              label="Speed m/s"
              value={draft.speedMps}
              disabled={!draftFollowPath}
              onChange={(speedMps) => wheelflow.updateCustomObstacleDraft({ speedMps })}
            />
            <SelectRow
              label="End Behavior"
              value={draft.endBehavior}
              disabled={!draftFollowPath}
              options={END_BEHAVIORS}
              onChange={(endBehavior) => wheelflow.updateCustomObstacleDraft({ endBehavior })}
            />
            <div className="custom-obstacle-buttons">
              <button type="button" onClick={() => wheelflow.setCustomObstacleMode('Place')}>
                Start Placing
              </button>
              <button type="button" onClick={() => wheelflow.setCustomObstacleMode('Select')}>
                Cancel
              </button>
            </div>
          </section>

          <section>
            <h4>Selected Obstacle</h4>
            {!selected && <div className="custom-obstacle-empty">No obstacle selected</div>}
            {selected && (
              <>
                <div className="custom-obstacle-id">{selected.id}</div>
                <SelectRow
                  label="Type"
                  value={selected.type}
                  options={OBSTACLE_TYPES}
                  onChange={(type) => wheelflow.updateSelectedCustomObstacle({ type })}
                />
                <SelectRow
                  label="Motion"
                  value={selected.motionType}
                  options={MOTION_TYPES}
                  onChange={(motionType) => wheelflow.updateSelectedCustomObstacle({ motionType })}
                />
                <NumberRow
                  label="Speed m/s"
                  value={selected.speedMps}
                  disabled={selected.motionType !== 'FollowPath'}
                  onChange={(speedMps) => wheelflow.updateSelectedCustomObstacle({ speedMps })}
                />
                <SelectRow
                  label="End Behavior"
                  value={selected.endBehavior}
                  disabled={selected.motionType !== 'FollowPath'}
                  options={END_BEHAVIORS}
                  onChange={(endBehavior) => wheelflow.updateSelectedCustomObstacle({ endBehavior })}
                />
                <div className="custom-obstacle-pose">
                  x: {Number(selected.x || 0).toFixed(2)}
                  {' '}y: {Number(selected.y || 0).toFixed(2)}
                  {' '}heading: {Number(selected.heading || 0).toFixed(2)}
                </div>
                <div className="custom-obstacle-buttons">
                  <button type="button" onClick={() => wheelflow.focusCustomObstacle(selected.id)}>
                    Focus
                  </button>
                  <button type="button" onClick={() => wheelflow.deleteSelectedCustomObstacle()}>
                    Delete
                  </button>
                </div>
              </>
            )}
          </section>

          <section>
            <h4>Path Editor</h4>
            <div className="custom-obstacle-buttons custom-obstacle-buttons-three">
              <button
                type="button"
                disabled={!selected || !selectedFollowPath}
                onClick={() => wheelflow.setCustomObstacleMode('EditPath')}
              >
                Edit Path
              </button>
              <button
                type="button"
                disabled={!selected}
                onClick={() => wheelflow.setCustomObstacleMode('Select')}
              >
                Done
              </button>
              <button
                type="button"
                disabled={!selected}
                onClick={() => wheelflow.updateSelectedCustomObstacle({ waypoints: [] })}
              >
                Clear Path
              </button>
            </div>
            {selected && (selected.waypoints || []).map((waypoint, index) => (
              <div key={`${selected.id}-${index}`} className="custom-obstacle-list-item waypoint-item">
                <span>{index + 1}. ({Number(waypoint.x).toFixed(1)}, {Number(waypoint.y).toFixed(1)})</span>
                <button
                  type="button"
                  onClick={() => {
                    const waypoints = selected.waypoints.filter((_, i) => i !== index);
                    wheelflow.updateSelectedCustomObstacle({ waypoints });
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </section>

          <section>
            <h4>Obstacle List</h4>
            <div className="custom-obstacle-buttons">
              <button type="button" onClick={() => WS.clearWheelFlowCustomObstacles()}>
                Clear All
              </button>
            </div>
            {wheelflow.customObstacles.map((obstacle) => (
              <div
                key={obstacle.id}
                className={`custom-obstacle-list-item ${obstacle.id === wheelflow.selectedCustomObstacleId ? 'selected' : ''}`}
              >
                <button type="button" onClick={() => wheelflow.focusCustomObstacle(obstacle.id)}>
                  {obstacle.id} {obstacle.type} {obstacle.motionType}
                </button>
                <span>{obstacle.runtimeStatus}</span>
                <button type="button" onClick={() => WS.deleteWheelFlowCustomObstacle(obstacle.id)}>
                  Delete
                </button>
                {obstacle.errorMessage && <em>{obstacle.errorMessage}</em>}
              </div>
            ))}
          </section>
        </div>
      </div>
    );
  }
}
