import React from 'react';
import Chart from 'chart.js';
import _ from 'lodash';

import STORE from 'store';

const defaultPolygonProperties = {
  color: 'rgba(255, 0, 0, 0.8)', // red
  borderWidth: 2,
  pointRadius: 0,
  fill: false,
  showLine: true,
  showText: true,
  cubicInterpolationMode: 'monotone',
  lineTension: 0,
};

Chart.plugins.register({
  afterDatasetsDraw(chart) {
    const fontFamily = '"Roboto Mono", "SFMono-Regular", Consolas, monospace';
    const chartArea = chart.chartArea;
    const theme = chart.$pncTheme || {
      background: 'rgba(8, 18, 29, 0.9)',
      textSecondary: '#96A5B5',
    };
    const annotationDatasets = chart.config.data.datasets
      .map((dataset, index) => ({
        dataset,
        meta: chart.getDatasetMeta(index),
      }))
      .filter(({ dataset, meta }) => (
        dataset.showText
        && dataset.text
        && meta
        && meta.data
        && meta.data.length > 0
      ));

    if (chartArea && annotationDatasets.length > 0) {
      const rowHeight = 17;
      const availableRows = Math.max(
        1,
        Math.min(5, Math.floor((chartArea.bottom - chartArea.top - 12) / rowHeight)),
      );
      const visibleAnnotations = annotationDatasets.slice(0, availableRows);

      chart.ctx.save();
      chart.ctx.font = Chart.helpers.fontString(9, '600', fontFamily);
      chart.ctx.textAlign = 'left';
      chart.ctx.textBaseline = 'middle';

      visibleAnnotations.forEach(({ dataset }, rowIndex) => {
        const maxWidth = Math.max(72, chartArea.right - chartArea.left - 42);
        let label = String(dataset.text);
        while (label.length > 8 && chart.ctx.measureText(label).width > maxWidth) {
          label = `${label.slice(0, -4)}...`;
        }

        const textWidth = Math.min(chart.ctx.measureText(label).width, maxWidth);
        const x = chartArea.left + 8;
        const y = chartArea.top + 10 + rowIndex * rowHeight;
        chart.ctx.globalAlpha = 0.9;
        chart.ctx.fillStyle = theme.background;
        chart.ctx.fillRect(x - 4, y - 7, textWidth + 17, 14);
        chart.ctx.globalAlpha = 1;
        chart.ctx.fillStyle = dataset.borderColor || theme.textSecondary;
        chart.ctx.fillRect(x, y - 4, 3, 8);
        chart.ctx.fillText(label, x + 8, y);
      });

      if (annotationDatasets.length > visibleAnnotations.length) {
        const hiddenCount = annotationDatasets.length - visibleAnnotations.length;
        const y = chartArea.top + 10 + (visibleAnnotations.length - 1) * rowHeight;
        chart.ctx.fillStyle = theme.textSecondary;
        chart.ctx.textAlign = 'right';
        chart.ctx.fillText(`+${hiddenCount}`, chartArea.right - 8, y);
      }
      chart.ctx.restore();
    }

    chart.config.data.datasets.forEach((dataset, index) => {
      if (dataset.specialMarker === 'car') {
        chart.ctx.save();

        const meta = chart.getDatasetMeta(index);
        if (!meta || !meta.data || meta.data.length === 0
          || !chart.data.datasets[index].data
          || chart.data.datasets[index].data.length === 0) {
          chart.ctx.restore();
          return;
        }
        const rotation = chart.data.datasets[index].data[0].heading || 0;

        const xAxis = chart.scales['x-axis-0'];
        const yAxis = chart.scales['y-axis-0'];
        if (!xAxis || !yAxis || xAxis.max === xAxis.min || yAxis.max === yAxis.min) {
          chart.ctx.restore();
          return;
        }
        const pixelPerUnit = {
          x: xAxis.width / (xAxis.max - xAxis.min),
          y: yAxis.height / (yAxis.max - yAxis.min),
        };
        const dx = Math.cos(rotation) > 0 ? 1 : -1;
        const dy = Math.tan(rotation) * dx;
        const xInPixels = dx * pixelPerUnit.x;
        const yInPixels = dy * pixelPerUnit.y;
        const rotationInPixels = Math.atan2(yInPixels, xInPixels);

        const element = meta.data[0];
        const position = element.tooltipPosition();
        chart.ctx.font = Chart.helpers.fontString(16, 'normal', fontFamily);
        chart.ctx.translate(position.x, position.y);
        chart.ctx.rotate(-rotationInPixels); // ChartJS's rotation is clockwise
        chart.ctx.fillStyle = dataset.borderColor;
        chart.ctx.fillText('\u27A1︎\uFE0E' /* ➡ */, 0, 0);

        chart.ctx.restore();
      }
    });
  },
});

function updateTickWindow(scale, windowSize, midValue) {
  const mid = midValue || Math.floor((scale.max + scale.min) / 2);
  scale.max = mid + windowSize / 2;
  scale.min = mid - windowSize / 2;
}

function syncXYWindowSize(scale) {
  function isValidValue(value) {
    return value !== null && value !== undefined && !isNaN(value) && isFinite(value);
  }
  function IDMatches(meta) {
    return scale.isHorizontal() ? meta.xAxisID === scale.id : meta.yAxisID === scale.id;
  }

  // calculate the range for both x and y
  const min = {
    x: null,
    y: null,
  };
  const max = {
    x: null,
    y: null,
  };
  const chart = scale.chart;
  const datasets = chart.data.datasets;
  Chart.helpers.each(datasets, (dataset, datasetIndex) => {
    const meta = chart.getDatasetMeta(datasetIndex);
    if (chart.isDatasetVisible(datasetIndex) && IDMatches(meta)) {
      Chart.helpers.each(dataset.data, (rawValue, index) => {
        if (!isValidValue(rawValue.x)
          || !isValidValue(rawValue.y)
          || meta.data[index].hidden) {
          return;
        }

        if (min.x === null || rawValue.x < min.x) {
          min.x = rawValue.x;
        }
        if (max.x === null || rawValue.x > max.x) {
          max.x = rawValue.x;
        }
        if (min.y === null || rawValue.y < min.y) {
          min.y = rawValue.y;
        }
        if (max.y === null || rawValue.y > max.y) {
          max.y = rawValue.y;
        }
      });
    }
  });

  // set min/max based on the larger range
  if (isValidValue(min.x) && isValidValue(min.y)
    && isValidValue(max.x) && isValidValue(max.y)) {
    const max_diff = Math.max(max.x - min.x, max.y - min.y);
    const mid = scale.isHorizontal()
      ? Math.floor((max.x + min.x) / 2)
      : Math.floor((max.y + min.y) / 2);
    scale.max = mid + max_diff / 2;
    scale.min = mid - max_diff / 2;
  }
}

export default class ScatterGraph extends React.Component {
  getChartTheme() {
    const styles = window.getComputedStyle(this.canvasElement);
    const readToken = (name, fallback) => styles.getPropertyValue(name).trim() || fallback;

    return {
      background: readToken('--bg-raised', '#121D2A'),
      grid: readToken('--border-subtle', 'rgba(143, 170, 187, 0.2)'),
      textPrimary: readToken('--text-primary', '#EEF3F7'),
      textSecondary: readToken('--text-secondary', '#96A5B5'),
      textTertiary: readToken('--text-tertiary', '#77899D'),
    };
  }

  initializeCanvas(options) {
    this.name2idx = {};
    const theme = this.getChartTheme();
    const legend = options.legend || {};
    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      responsiveAnimationDuration: 0,
      animation: {
        duration: 0,
      },
      hover: {
        animationDuration: 0,
      },
      layout: {
        padding: {
          top: 8,
          right: 8,
          bottom: 2,
          left: 2,
        },
      },
      title: {
        display: false,
      },
      legend: {
        display: Boolean(legend.display),
        position: 'bottom',
        labels: {
          boxWidth: 9,
          fontColor: theme.textSecondary,
          fontFamily: '"Roboto Mono", "SFMono-Regular", Consolas, monospace',
          fontSize: 9,
          padding: 12,
          usePointStyle: true,
          filter: (legendItem, data) => {
            const hideLabel = _.get(data,
              `datasets[${legendItem.datasetIndex}].hideLabelInLegend`, false);

            return !hideLabel;
          },
        },
      },
      tooltips: {
        enabled: true,
        mode: 'nearest',
        intersect: false,
        backgroundColor: 'rgba(5, 12, 20, 0.94)',
        titleFontColor: '#EEF3F7',
        bodyFontColor: '#C4D0DC',
        titleFontSize: 10,
        bodyFontSize: 9,
        xPadding: 9,
        yPadding: 8,
      },
    };

    if (options.axes) {
      if (!chartOptions.scales) {
        chartOptions.scales = {};
      }
      for (const axis in options.axes) {
        const name = `${axis}Axes`;
        const setting = options.axes[axis];
        const axisOptions = {
          id: `${axis}-axis-0`,
          scaleLabel: {
            display: !_.isEmpty(setting.labelString),
            labelString: setting.labelString,
            fontColor: theme.textSecondary,
            fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
            fontSize: 9,
          },
          ticks: {
            fontColor: theme.textTertiary,
            fontFamily: '"Roboto Mono", "SFMono-Regular", Consolas, monospace',
            fontSize: 8,
            min: setting.min,
            max: setting.max,
            minRotation: 0,
            maxRotation: 0,
            maxTicksLimit: axis === 'x' ? 7 : 6,
            padding: 5,
            stepSize: setting.stepSize,
            // Overwrite chartjs tick formatter to keep maximum 4 decimals
            // and avoid scientific notation
            callback(tickValue, index, ticks) {
              // If we have lots of ticks, don't use the ones
              let delta = ticks.length > 3
                ? ticks[2] - ticks[1]
                : ticks[1] - ticks[0];

              // If we have a number like 2.5 as the delta,
              // figure out how many decimal places we need
              if (Math.abs(delta) > 1) {
                if (tickValue !== Math.floor(tickValue)) {
                  // not an integer
                  delta = tickValue - Math.floor(tickValue);
                }
              }

              const logDelta = Math.log10(Math.abs(delta));
              let tickString = '';

              if (Math.abs(tickValue) >= 1e-4) {
                let numDecimal = -1 * Math.floor(logDelta);
                numDecimal = Math.max(Math.min(numDecimal, 4), 0);
                tickString = tickValue.toFixed(numDecimal);
              } else {
                tickString = '0'; // never show decimal places for 0
              }

              return tickString;
            },
          },
          gridLines: {
            color: theme.grid,
            zeroLineColor: theme.textTertiary,
            drawBorder: false,
          },
        };
        if (!chartOptions.scales[name]) {
          chartOptions.scales[name] = [];
        }
        if (setting.windowSize) {
          axisOptions.afterDataLimits = (scale) => {
            updateTickWindow(scale, setting.windowSize, setting.midValue);
          };
        } else if (options.syncXYWindowSize) {
          axisOptions.afterDataLimits = syncXYWindowSize;
        }
        chartOptions.scales[name].push(axisOptions);
      }
    }

    const ctx = this.canvasElement.getContext('2d');
    this.chart = new Chart(ctx, { type: 'scatter', options: chartOptions });
    this.chart.$pncTheme = theme;
  }

  constructDataConfig(properties) {
    // basic properties
    const config = {
      label: null, // legend
      hideLabelInLegend: properties.hideLabelInLegend,
      showText: properties.showText,
      text: null, // text in the graph

      backgroundColor: properties.color,
      borderColor: properties.color,

      data: null,
    };

    // additional properties
    for (const key in properties) {
      config[key] = properties[key];
    }

    return config;
  }

  updateData(idx, name, properties, data) {
    const datasets = this.chart.data.datasets;
    const config = this.constructDataConfig(properties);
    if (datasets[idx] === undefined) {
      datasets.push(config);
    } else if (datasets[idx].text !== name) {
      datasets[idx] = config;
    }

    datasets[idx].label = name;
    datasets[idx].text = name;
    datasets[idx].data = data;
  }

  updateCar(name, point, properties) {
    // draw heading arrow
    {
      const arrowName = name;
      if (this.name2idx[arrowName] === undefined) {
        this.name2idx[arrowName] = this.chart.data.datasets.length;
      }
      const idx = this.name2idx[arrowName];
      const arrowProperties = { ...properties };
      arrowProperties.specialMarker = 'car';
      arrowProperties.borderWidth = 0;
      arrowProperties.pointRadius = 0;
      this.updateData(idx, arrowName, arrowProperties, [point]);
    }

    // draw ego-vehicle bounding box
    {
      const polygonName = `${name}_car_bounding_box`;
      if (this.name2idx[polygonName] === undefined) {
        this.name2idx[polygonName] = this.chart.data.datasets.length;
      }
      const idx2 = this.name2idx[polygonName];
      const polygon = STORE.hmi.calculateCarPolygonPoints(point.x, point.y, point.heading);
      const polygonProperties = {
        borderWidth: 1,
        pointRadius: 0,
        color: properties.color,
        showLine: true,
        fill: false,
        lineTension: 0,
        hideLabelInLegend: true,
      };
      this.updateData(idx2, polygonName, polygonProperties, polygon);
    }
  }

  updateChart(props) {
    if (!props.data || !props.properties) {
      return;
    }
    const datasets = props.data;

    // Draw cars
    const carProperties = props.properties.cars || {};
    for (const name in carProperties) {
      const nameInString = JSON.stringify(name);
      const point = _.get(datasets, `cars[${nameInString}]`, {});
      const properties = _.get(props, `properties.cars[${nameInString}]`, {});
      this.updateCar(name, point, properties);
    }

    // Draw lines
    const lineProperties = props.properties.lines || {};
    for (const name in lineProperties) {
      if (this.name2idx[name] === undefined) {
        this.name2idx[name] = this.chart.data.datasets.length;
      }
      const idx = this.name2idx[name];
      const nameInString = JSON.stringify(name);
      const properties = _.get(props, `properties.lines[${nameInString}]`, {});
      const points = _.get(datasets, `lines[${nameInString}]`, []);
      this.updateData(idx, name, properties, points);
    }

    // Draw polygons
    let idx = Object.keys(this.name2idx).length;
    if (datasets.polygons) {
      for (const name in datasets.polygons) {
        const nameInString = JSON.stringify(name);
        const points = _.get(datasets, `polygons[${nameInString}]`);
        if (!points) {
          continue;
        }

        const properties =
          _.get(props, `properties.polygons[${nameInString}]`, defaultPolygonProperties);

        this.updateData(idx, name, properties, points);
        idx++;
      }
    }

    // Remove un-used polygons data
    this.chart.data.datasets.splice(idx, this.chart.data.datasets.length - idx);

    // Update chart
    this.chart.update(0);
  }

  componentDidMount() {
    const { options } = this.props;
    this.initializeCanvas(options || {});
    this.updateChart(this.props);
  }

  componentWillUnmount() {
    if (this.chart) {
      this.chart.destroy();
    }
  }

  componentWillReceiveProps(nextProps) {
    this.updateChart(nextProps);
  }

  render() {
    const { title } = this.props;
    const chartTitle = title || 'Diagnostic chart';

    return (
      <section className="scatter-graph">
        <header className="scatter-graph-header">
          <h2 title={chartTitle}>{chartTitle}</h2>
          <span>Live data</span>
        </header>
        <div className="scatter-graph-canvas">
          <canvas
            aria-label={chartTitle}
            role="img"
            ref={(input) => {
              this.canvasElement = input;
            }}
          />
        </div>
      </section>
    );
  }
}

function generateScatterGraph(setting, lineDatasets, carDatasets, polygonsDatasets) {
  if (!lineDatasets) {
    console.error('Graph data not found:', setting.title);
    return null;
  }

  if (!setting || !setting.properties || !setting.options) {
    console.error('Graph setting not found:', setting?.title);
    return null;
  }

  return (
    <ScatterGraph
      key={setting.title}
      title={setting.title}
      options={setting.options}
      properties={setting.properties}
      data={{ lines: lineDatasets, cars: carDatasets, polygons: polygonsDatasets }}
    />
  );
}

export {
  generateScatterGraph,
};
