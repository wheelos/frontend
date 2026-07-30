import React from 'react';
import { inject, observer } from 'mobx-react';
import _ from 'lodash';

import SETTING from 'store/config/PlanningGraph.yml';
import MonitorEmptyState from 'components/PNCMonitor/MonitorEmptyState';
import ScatterGraph, { generateScatterGraph } from 'components/PNCMonitor/ScatterGraph';
import PlanningScenarioTable from 'components/PNCMonitor/PlanningScenarioTable';

@inject('store') @observer
export default class PlanningMonitor extends React.Component {
  generateGraphsFromDatasets(settingName, datasets) {
    const setting = SETTING[settingName];
    if (!setting) {
      console.error('No such setting name found in PlanningGraph.yml:', settingName);
      return null;
    }

    return _.get(setting, 'datasets', []).map(({ name, graphTitle }) => {
      const graph = datasets ? datasets[name] : null;
      const polygons = graph ? graph.obstaclesBoundary : [];
      return (
                <ScatterGraph
                    key={`${settingName}_${name}`}
                    title={graphTitle}
                    options={setting.options}
                    properties={setting.properties}
                    data={{ lines: graph, polygons }}
                />
      );
    });
  }

  render() {
    const {
      planningTimeSec, data, chartData, scenarioHistory,
    } = this.props.store.planningData;

    if (!planningTimeSec) {
      return (
        <MonitorEmptyState
          title="Waiting for planning telemetry"
          detail="Scenario and trajectory charts appear when Planning publishes data."
        />
      );
    }

    const chartCount = {};
    const graphData = data || {};

    return (
            <div className="pnc-diagnostic-stack">
                <PlanningScenarioTable scenarios={scenarioHistory} />
                {(chartData || []).map((chart) => {
                  // Adding count to chart key to prevent duplicate chart title
                  if (!chartCount[chart.title]) {
                    chartCount[chart.title] = 1;
                  } else {
                    chartCount[chart.title] += 1;
                  }

                  return (
                        <ScatterGraph
                            key={`custom_${chart.title}_${chartCount[chart.title]}`}
                            title={chart.title}
                            options={chart.options}
                            properties={chart.properties}
                            data={chart.data}
                        />
                  );
                })}
                {generateScatterGraph(SETTING.speedGraph, graphData.speedGraph)}
                {generateScatterGraph(SETTING.accelerationGraph, graphData.accelerationGraph)}
                {generateScatterGraph(SETTING.planningThetaGraph, graphData.thetaGraph)}
                {generateScatterGraph(SETTING.planningKappaGraph, graphData.kappaGraph)}
                {this.generateGraphsFromDatasets('stGraph', graphData.stGraph)}
                {this.generateGraphsFromDatasets('stSpeedGraph', graphData.stSpeedGraph)}
                {generateScatterGraph(SETTING.planningDkappaGraph, graphData.dkappaGraph)}
                {generateScatterGraph(SETTING.referenceLineThetaGraph, graphData.thetaGraph)}
                {generateScatterGraph(SETTING.referenceLineKappaGraph, graphData.kappaGraph)}
                {generateScatterGraph(SETTING.referenceLineDkappaGraph, graphData.dkappaGraph)}
            </div>
    );
  }
}
