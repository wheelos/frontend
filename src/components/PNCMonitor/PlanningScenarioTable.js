import React from 'react';

import { timestampMsToTimeString } from 'utils/misc';

class PlanningScenarioItem extends React.Component {
  render() {
    const { scenario } = this.props;

    const type = scenario.scenarioType;
    const stage = scenario.stageType ? scenario.stageType.replace(`${type}_`, '') : '-';

    return (
            <tr className="monitor-table-item">
                <td className="text time">{timestampMsToTimeString(scenario.timeSec * 1000, true)}</td>
                <td className="text" title={type}>{type}</td>
                <td className="text" title={stage}>{stage}</td>
            </tr>
    );
  }
}

export default class PlanningScenarioTable extends React.Component {
  render() {
    const scenarios = this.props.scenarios || [];

    return (
            <section className="pnc-scenario-history">
                <header>
                    <h2>Scenario history</h2>
                    <span>{scenarios.length} records</span>
                </header>
                <table className="monitor-table" aria-label="Planning scenario history">
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Scenario</th>
                            <th>Stage</th>
                        </tr>
                    </thead>
                    <tbody>
                        {scenarios.map((scenario) => (
                            <PlanningScenarioItem
                                key={`scenario_${scenario.timeSec}_${scenario.scenarioType}`}
                                scenario={scenario}
                            />
                        ))}
                        {scenarios.length === 0
                          && (
                            <tr className="monitor-table-empty">
                                <td colSpan="3">No scenario transitions recorded</td>
                            </tr>
                          )}
                    </tbody>
                </table>
            </section>
    );
  }
}
