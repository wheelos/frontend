import React from 'react';
import { inject, observer } from 'mobx-react';
import { VideoCameraOutlined } from '@ant-design/icons';
import { CAMERA_WS } from 'store/websocket';

import './style.scss';

export class CameraVideo extends React.Component {
  render() {
    const {
      channel,
      channelError,
      channelsAvailable,
      imageSrcData,
      isLoading,
      onRetry,
    } = this.props;

    if (!imageSrcData) {
      let title = 'Select a camera channel';
      let detail = 'Choose an available sensor stream to start the preview.';

      if (isLoading) {
        title = 'Discovering camera channels';
        detail = 'Requesting available sensor streams.';
      } else if (channelError) {
        title = 'Camera channels unavailable';
        detail = 'Check the camera websocket connection, then try again.';
      } else if (channelsAvailable === false) {
        title = 'No camera channels found';
        detail = 'Start a camera publisher to make a sensor stream available.';
      } else if (channel) {
        title = 'Waiting for camera frames';
        detail = channel;
      }

      return (
        <div className="camera-video camera-video-empty" role="status">
          <div className="camera-empty-icon" aria-hidden="true">
            <VideoCameraOutlined />
          </div>
          <strong>{title}</strong>
          <span>{detail}</span>
          {channelError && onRetry
            && (
              <button type="button" className="camera-retry" onClick={onRetry}>
                Retry
              </button>
            )}
        </div>
      );
    }

    return (
      <div className="camera-video">
        <img
          src={imageSrcData}
          alt={channel ? `Camera sensor preview: ${channel}` : 'Camera sensor preview'}
        />
      </div>
    );
  }
}

@inject('store') @observer
export default class SensorCamera extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      channels: [],
      channelError: false,
      isLoading: true,
      selectedChannel: '',
    };
  }

  componentDidMount() {
    this.isMountedFlag = true;
    this.channelTimer = setTimeout(this.loadChannels, 200);
  }

  componentWillUnmount() {
    this.isMountedFlag = false;
    clearTimeout(this.channelTimer);
  }

  loadChannels = () => {
    if (this.isMountedFlag) {
      this.setState({
        channelError: false,
        isLoading: true,
      });
    }

    try {
      CAMERA_WS.getCameraChannel()
        .then((channels) => {
          if (!this.isMountedFlag) {
            return;
          }

          const availableChannels = Array.isArray(channels) ? channels : [];
          const currentChannel = this.props.store.hmi.currentCameraSensorChannel;
          const selectedChannel = availableChannels.includes(currentChannel)
            ? currentChannel
            : '';
          this.setState({
            channels: availableChannels,
            channelError: false,
            isLoading: false,
            selectedChannel,
          });

          if (selectedChannel) {
            CAMERA_WS.startCamera();
          }
        })
        .catch(() => {
          if (this.isMountedFlag) {
            this.setState({
              channels: [],
              channelError: true,
              isLoading: false,
              selectedChannel: '',
            });
          }
        });
    } catch (error) {
      if (this.isMountedFlag) {
        this.setState({
          channels: [],
          channelError: true,
          isLoading: false,
          selectedChannel: '',
        });
      }
    }
  };

  onStatusSelectChange = (event) => {
    const value = event.target.value;
    if (value) {
      this.setState({ selectedChannel: value });
      try {
        CAMERA_WS
          .stopCamera()
          .changeCameraChannel(value)
          .startCamera();
      } catch (error) {
        this.setState({
          channelError: true,
          selectedChannel: '',
        });
      }
    }
  };

  render() {
    const {
      cameraData,
      hmi,
    } = this.props.store;
    const {
      channelError,
      channels,
      isLoading,
      selectedChannel,
    } = this.state;
    const currentChannel = selectedChannel
      || (isLoading ? hmi.currentCameraSensorChannel : '');
    const hasImage = Boolean(currentChannel && cameraData.imageSrcData);

    return (
      <div className="card camera camera-sensor-card">
        <div className="card-header camera-sensor-header">
          <div className="camera-card-title">
            <span>Camera Sensor</span>
            <small>Live preview</small>
          </div>
          <span className={`camera-stream-status${hasImage ? ' is-live' : ''}`}>
            <i aria-hidden="true" />
            {hasImage ? 'Live' : 'Standby'}
          </span>
        </div>
        <div className="card-content-column">
          <label className="camera-channel-field" htmlFor="camera-sensor-channel">
            <span>Source channel</span>
            <span className="camera_view_channel_select">
              <span className="arrow" />
              <select
                id="camera-sensor-channel"
                value={currentChannel}
                disabled={isLoading || channelError || channels.length === 0}
                onChange={this.onStatusSelectChange}
              >
                <option key="select-channel" value="">Select channel</option>
                {channels.map((channel) => (
                  <option key={channel} value={channel}>{channel}</option>
                ))}
              </select>
            </span>
          </label>
          <CameraVideo
            channel={currentChannel}
            channelError={channelError}
            channelsAvailable={!isLoading && channels.length > 0}
            imageSrcData={hasImage ? cameraData.imageSrcData : null}
            isLoading={isLoading}
            onRetry={this.loadChannels}
          />
        </div>
      </div>
    );
  }
}
