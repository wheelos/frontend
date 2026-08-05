import React from 'react';
import { inject, observer } from 'mobx-react';

import MainView from 'components/Layouts/MainView';
import ToolView from 'components/Layouts/ToolView';
import Loader from 'components/common/Loader';

import WS from 'store/websocket';

@inject('store') @observer
export default class Offlineview extends React.Component {
  constructor(props) {
    super(props);

    this.updateDimension = this.props.store.dimension.update.bind(this.props.store.dimension);
  }

  parseQueryString(queryString) {
    const params = {};

    queryString.replace('?', '').split('&').forEach((query) => {
      const segments = query.split('=');
      params[segments[0]] = segments[1];
    });
    return params;
  }

  componentWillMount() {
    this.updateDimension();
  }

  componentDidMount() {
    const params = this.parseQueryString(window.location.search);
    WS.initialize(params);
    window.addEventListener('resize', this.updateDimension, false);
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.updateDimension, false);
  }

  render() {
    const { isInitialized, offlineViewErrorMsg, options } = this.props.store;

    if (!isInitialized) {
      return (
                <div className={`offlineview theme-${options.themeMode}`}>
                    <Loader extraClasses="offline-loader" offlineViewErr={offlineViewErrorMsg} />
                </div>
      );
    }

    return (
            <div className={`offlineview theme-${options.themeMode}`}>
                <MainView />
                <ToolView />
            </div>
    );
  }
}
