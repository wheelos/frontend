import { observable, action, computed } from 'mobx';

export default class ScenarioStore {
  // Local JSON scenarios retrieved from backend
  @observable localScenarios = [];

  // Scenarios listed from remote marketplace
  @observable marketScenarios = [];

  // The actively loaded scenario object
  @observable currentScenario = null;

  // Status of the simulation execution (READY, RUNNING, FINISHED)
  @observable simulationStatus = 'READY';

  // ID of the currently loaded scenario
  @observable currentScenarioId = null;

  @action setLocalScenarios(scenarios) {
    this.localScenarios = scenarios;
  }

  @action setMarketScenarios(scenarios) {
    this.marketScenarios = scenarios;
  }

  @action setCurrentScenario(scenarioId) {
    this.currentScenarioId = scenarioId;
    // Attempt to find the full object from local scenarios
    const found = this.localScenarios.find((s) => s.scenarioId === scenarioId);
    this.currentScenario = found || { scenarioId };
    this.simulationStatus = 'READY';
  }

  @action setSimulationStatus(status) {
    this.simulationStatus = status;
  }
}
