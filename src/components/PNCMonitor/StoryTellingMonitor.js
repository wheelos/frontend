import React from 'react';
import { inject, observer } from 'mobx-react';
import classNames from 'classnames';

class StoryItem extends React.PureComponent {
  render() {
    const { name, value } = this.props;

    const textClassNames = classNames({
      'pnc-story-state': true,
      'is-active': value,
    });

    return (
            <li className="pnc-story-item">
                <span className="pnc-story-name" title={name}>{name}</span>
                <span className={textClassNames}>{value ? 'Active' : 'Idle'}</span>
            </li>
    );
  }
}

@inject('store') @observer
export default class StoryTellingMonitor extends React.Component {
  render() {
    const { stories } = this.props.store.storyTellers;
    const storyEntries = Array.from(stories.entries());
    const activeCount = storyEntries.filter(([, isOn]) => isOn).length;

    return (
            <section className="pnc-story-panel">
                <header>
                    <div>
                        <h2>Story signals</h2>
                        <p>Scenario triggers published by planning</p>
                    </div>
                    <span>{activeCount} active</span>
                </header>
                {storyEntries.length > 0
                  ? (
                    <ul className="pnc-story-list">
                        {storyEntries.map(([story, isOn]) => (
                            <StoryItem key={`story_${story}`} name={story} value={isOn} />
                        ))}
                    </ul>
                  )
                  : (
                    <div className="pnc-story-empty">
                        No story signals received
                    </div>
                  )}
            </section>
    );
  }
}
