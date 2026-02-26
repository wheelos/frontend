import { observable, action, computed } from 'mobx';

/**
 * MultiCameraWorkspaceStore manages the state of the Multi-Camera Workspace.
 * It tracks whether the workspace is open and which camera topics are selected.
 */
export default class MultiCameraWorkspaceStore {
  /** Whether the workspace overlay is currently open */
  @observable isOpen = false;

  /** Camera topics that are currently displayed in the workspace */
  @observable selectedTopics = [];

  @computed get hasTopics() {
    return this.selectedTopics.length > 0;
  }

  /**
   * Open the workspace with a given list of topics.
   * @param {string[]} topics
   */
  @action open(topics = []) {
    this.selectedTopics = [...topics];
    this.isOpen = true;
  }

  /**
   * Close the workspace.
   */
  @action close() {
    this.isOpen = false;
    this.selectedTopics = [];
  }

  /**
   * Remove a single topic from the workspace.
   * @param {string} topic
   */
  @action removeTopic(topic) {
    this.selectedTopics = this.selectedTopics.filter((t) => t !== topic);
  }

  /**
   * Add a single topic to the workspace.
   * @param {string} topic
   */
  @action addTopic(topic) {
    if (!this.selectedTopics.includes(topic)) {
      this.selectedTopics.push(topic);
    }
  }

  /**
   * Toggle the workspace: open it with the given topics if closed,
   * or close it if it is already open.
   * @param {string[]} topics - Topics to display when opening.
   */
  @action toggleWorkspace(topics = []) {
    if (this.isOpen) {
      this.close();
    } else {
      this.open(topics);
    }
  }
}
