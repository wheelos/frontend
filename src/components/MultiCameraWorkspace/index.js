import React, { Component } from 'react';
import { inject, observer } from 'mobx-react';
import { observable, action } from 'mobx';
import GridLayout from 'react-grid-layout';

import CameraCard from 'components/MultiCameraWorkspace/CameraCard';
import { CAMERA_WS } from 'store/websocket';
import MultiTopicSubscriber from 'store/websocket/websocket_multi_camera';

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import 'components/MultiCameraWorkspace/style.scss';

/** Default columns for the grid layout */
const GRID_COLS = 12;

/** Default row height in pixels */
const GRID_ROW_HEIGHT = 30;

/** Default layout position generator for a new card */
function defaultLayout(topic, index) {
  return {
    i: topic,
    x: (index % 2) * 6,
    y: Math.floor(index / 2) * 8,
    w: 6,
    h: 8,
    minW: 3,
    minH: 4,
  };
}

/**
 * MultiCameraWorkspace is a full-screen overlay that displays multiple
 * camera streams in a draggable and resizable grid.
 *
 * Life-cycle:
 *  onEnter – saves Dreamview state, disables 3-D cloud rendering, opens workspace.
 *  onExit  – unsubscribes from extra cameras, re-enables 3-D rendering, closes workspace.
 */
@inject('store') @observer
export default class MultiCameraWorkspace extends Component {
  /** Persists the per-session grid layout */
  @observable layoutConfig = [];

  /** Per-topic image data received from the backend */
  @observable imageMap = observable.map();

  /** Current viewport width, kept up-to-date on resize */
  @observable windowWidth = window.innerWidth;

  constructor(props) {
    super(props);

    this.subscriber = new MultiTopicSubscriber(CAMERA_WS);
    this.savedShowPointCloud = null;
    this.handleLayoutChange = this.handleLayoutChange.bind(this);
    this.handleClose = this.handleClose.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleResize = this.handleResize.bind(this);
  }

  // ─── Life-cycle ──────────────────────────────────────────────────────────

  componentDidMount() {
    const { store } = this.props;
    this.onEnter(store);
    window.addEventListener('keydown', this.handleKeyDown, false);
    window.addEventListener('resize', this.handleResize, false);
  }

  componentWillUnmount() {
    const { store } = this.props;
    this.onExit(store);
    window.removeEventListener('keydown', this.handleKeyDown, false);
    window.removeEventListener('resize', this.handleResize, false);
  }

  // ─── Workspace transition logic ──────────────────────────────────────────

  /**
   * onEnter: save current Dreamview state, disable 3D point-cloud rendering,
   * initialise the multi-topic subscriber for the selected camera topics.
   */
  onEnter(store) {
    // Save current point-cloud visibility so we can restore it later
    this.savedShowPointCloud = store.options.showPointCloud;

    // Disable 3-D point-cloud rendering to free up GPU resources
    if (store.options.showPointCloud) {
      store.handleOptionToggle('showPointCloud');
    }

    // Subscribe to all selected camera topics
    const topics = store.multiCameraWorkspace.selectedTopics;
    if (topics && topics.length > 0) {
      this.initTopics(topics);
    }
  }

  /**
   * onExit: unsubscribe from all extra cameras, restore 3D rendering state.
   */
  onExit(store) {
    // Unsubscribe from all camera topics
    this.subscriber.unsubscribeAll();

    // Restore 3-D point-cloud rendering if it was previously enabled
    if (this.savedShowPointCloud && !store.options.showPointCloud) {
      store.handleOptionToggle('showPointCloud');
    }
  }

  // ─── Topic management ────────────────────────────────────────────────────

  @action initTopics(topics) {
    // Build initial layout config for the grid
    this.layoutConfig = topics.map((topic, index) => defaultLayout(topic, index));

    // Register per-topic frame callbacks before subscribing
    topics.forEach((topic) => {
      this.imageMap.set(topic, null);
      this.subscriber.onFrame(topic, action((src) => {
        this.imageMap.set(topic, src);
      }));
    });

    // Send a batch Subscribe message to the Dreamview backend
    this.subscriber.subscribeTopics(topics);
  }

  @action handleClose(topic) {
    const { store } = this.props;

    // Remove from layout
    this.layoutConfig = this.layoutConfig.filter((item) => item.i !== topic);

    // Clean up image data and subscriber
    this.imageMap.delete(topic);
    this.subscriber.offFrame(topic);

    // Update the store's selected topics list
    store.multiCameraWorkspace.removeTopic(topic);

    // If no cameras remain, close the workspace
    if (this.layoutConfig.length === 0) {
      store.multiCameraWorkspace.close();
    }
  }

  @action handleLayoutChange(newLayout) {
    this.layoutConfig = newLayout;
  }

  handleKeyDown(event) {
    // Close workspace on Escape key
    if (event.key === 'Escape') {
      this.props.store.multiCameraWorkspace.close();
    }
  }

  @action handleResize() {
    this.windowWidth = window.innerWidth;
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  render() {
    const { store } = this.props;
    const topics = store.multiCameraWorkspace.selectedTopics;

    return (
      <div className="multi-camera-workspace">
        <div className="multi-camera-workspace-toolbar">
          <span className="multi-camera-workspace-title">Multi-Camera Workspace</span>
          <button
            type="button"
            className="multi-camera-workspace-exit"
            onClick={() => store.multiCameraWorkspace.close()}
          >
            Exit Workspace
          </button>
        </div>

        <div className="multi-camera-workspace-grid">
          <GridLayout
            className="layout"
            layout={this.layoutConfig}
            cols={GRID_COLS}
            rowHeight={GRID_ROW_HEIGHT}
            width={this.windowWidth}
            onLayoutChange={this.handleLayoutChange}
            draggableHandle=".camera-card-header"
          >
            {topics.map((topic) => (
              <div key={topic}>
                <CameraCard
                  topic={topic}
                  imageSrc={this.imageMap.get(topic)}
                  onClose={() => this.handleClose(topic)}
                />
              </div>
            ))}
          </GridLayout>
        </div>
      </div>
    );
  }
}
