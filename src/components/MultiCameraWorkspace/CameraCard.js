import React, { Component } from 'react';

/**
 * CameraCard encapsulates a single camera stream panel within the
 * Multi-Camera Workspace. It renders the live image from the camera,
 * displays the topic name, and provides a "Close" button to remove the
 * stream from the workspace.
 */
export default class CameraCard extends Component {
  render() {
    const { topic, imageSrc, onClose } = this.props;

    return (
      <div className="camera-card">
        <div className="camera-card-header">
          <span className="camera-card-topic" title={topic}>{topic}</span>
          <button
            type="button"
            className="camera-card-close"
            onClick={onClose}
            title="Close camera stream"
          >
            ✕
          </button>
        </div>
        <div className="camera-card-body">
          {imageSrc
            ? (
              <img
                className="camera-card-image"
                src={imageSrc}
                alt={topic}
              />
            )
            : (
              <div className="camera-card-placeholder">
                Waiting for stream…
              </div>
            )}
        </div>
      </div>
    );
  }
}
