import {html, css} from 'lit'
import {surnameGroups} from '../charts/fanSurname.js'

import {chartSvgDocument} from '../charts/svgExport.js'
import {FanChart} from '../charts/FanChart.js'
import {layoutFan} from '../charts/layout/fanLayout.js'
import {chartTransitionDuration} from '../charts/util.js'
import {GrampsjsChartBase} from './GrampsjsChartBase.js'
import {rootRelatives} from './GrampsjsChartRelativesMenu.js'

// Properties that change the layout of the chart
const layoutProperties = ['data', 'grampsId', 'depth']

class GrampsjsFanChart extends GrampsjsChartBase {
  static get styles() {
    return [
      ...super.styles,
      css`
        .surname-layout {
          display: flex;
          align-items: flex-start;
        }
        .surname-layout #container {
          flex: 1;
          min-width: 0;
        }
        aside {
          width: 280px;
          flex-shrink: 0;
          padding: 16px;
          box-sizing: border-box;
          max-height: calc(100vh - 160px);
          overflow-y: auto;
        }
        aside h3 {
          font-size: 16px;
          margin: 0 0 16px;
        }
        .surname-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
          font-size: 14px;
        }
        .swatch {
          width: 18px;
          height: 18px;
          border-radius: 3px;
          flex-shrink: 0;
          border: 1px solid #718298;
        }
        .surname-name {
          overflow-wrap: anywhere;
          flex: 1;
        }
        aside p {
          font-size: 13px;
          line-height: 1.5;
        }
        @media (max-width: 800px) {
          .surname-layout {
            flex-direction: column;
          }
          .surname-layout #container {
            width: 100%;
            flex: auto;
            height: clamp(340px, 100vw, 650px);
          }
          aside {
            width: 100%;
            max-height: 280px;
          }
        }
      `,
    ]
  }

  static get properties() {
    return {
      grampsId: {type: String},
      depth: {type: Number},
      color: {type: String},
      nameDisplayFormat: {type: String},
    }
  }

  constructor() {
    super()
    this.grampsId = ''
    this.depth = 5
    this.color = ''
    this._chart = new FanChart()
  }

  render() {
    return html`
      <div
        @pedigree:show-children="${this._openMenu}"
        style="position:relative;"
      >
        <div
          class=${this.color.startsWith('surnameFirst') ? 'surname-layout' : ''}
        >
          <div id="container"></div>
          ${this._surnameLegend()}
        </div>
        <grampsjs-chart-relatives-menu
          id="relatives-menu"
          .relatives=${this._children()}
          nameDisplayFormat=${this.nameDisplayFormat}
          .appState=${this.appState}
        ></grampsjs-chart-relatives-menu>
      </div>
    `
  }

  _surnameLegend() {
    if (!this.color.startsWith('surnameFirst') || !this._layout) return ''
    const groups = surnameGroups(this._layout.nodes, {
      joinTevarTebar: this.color === 'surnameFirstJoined',
    })
    const rows = groups.highlighted.map(g => ({
      label: g.name,
      count: g.count,
      color: g.color,
    }))
    if (groups.other)
      rows.push({
        label: this._('Other surnames'),
        count: groups.other,
        color: '#536276',
      })
    if (groups.unknown)
      rows.push({
        label: this._('No recorded surname'),
        count: groups.unknown,
        color: '#293342',
      })
    return html`<aside aria-label=${this._('First surname')} tabindex="0">
      <h3>${this._('First surname')}</h3>
      ${rows.map(
        row =>
          html`<div class="surname-row">
            <span class="swatch" style="background:${row.color}"></span
            ><span class="surname-name">${row.label}</span
            ><strong>${row.count}</strong>
          </div>`
      )}
      <p>${this._('Counts are positions, not unique people')}</p>
      <p>${this._('Visual grouping only; recorded names are unchanged')}</p>
      ${this.color === 'surnameFirstJoined'
        ? html`<p>${this._('Tevar / Tebar: visual grouping only')}</p>`
        : ''}
    </aside>`
  }

  firstUpdated() {
    super.firstUpdated()
    this.renderRoot.getElementById('container').append(this._chart.node)
  }

  willUpdate(changed) {
    super.willUpdate(changed)
    if (!layoutProperties.some(name => changed.has(name))) {
      return
    }
    // A selected person who is not in the data yet is still being fetched, so
    // the current chart stays until new data arrives. If the new data does not
    // contain them either, the chart is cleared.
    const {handle} = this._graph.personByGrampsId(this.grampsId) ?? {}
    if (handle) {
      this._layout = layoutFan(this._graph, handle, {depth: this.depth})
    } else if (changed.has('data')) {
      this._layout = null
    }
  }

  updated(changed) {
    if (!this._layout) {
      this._chart.clear()
      return
    }
    this._chart.update(this._layout, {
      ...this.chartOptions(),
      externalSurnameLegend: true,
    })
    // Adding/removing the separate legend changes the chart's actual width.
    // Fit after that resize, rather than preserving a transform for the old
    // width that can clip outer generations. Ordinary pan/zoom is unchanged.
    if (
      this.color.startsWith('surnameFirst') &&
      (changed.has('color') || changed.has('containerWidth'))
    )
      this._chart.viewport.fit()
  }

  svgDocument() {
    if (!this._layout) return Promise.resolve(null)
    return chartSvgDocument(FanChart, this._layout, {
      ...this.chartOptions(),
      preserveLegend: this.color.startsWith('surnameFirst'),
      legendWidth: 370,
      legendHeight: 600,
    })
  }

  chartOptions() {
    return {
      color: this.color || 'default',
      nameDisplayFormat: this.nameDisplayFormat,
      otherLabel: this._('Other'),
      surnameLabels: {
        unknown: this._('No recorded surname'),
        positions: this._('Counts are positions, not unique people'),
        joined: this._('Tevar / Tebar: visual grouping only'),
      },
      childrenButton: this._children().length > 0,
      childrenLabel: this._('Children'),
      duration: chartTransitionDuration(),
      bboxWidth: this.containerWidth,
      bboxHeight: this.containerHeight,
    }
  }

  _children() {
    return rootRelatives(this._graph, this.grampsId, 'children')
  }

  _openMenu(e) {
    this.renderRoot.getElementById('relatives-menu').open(e.target)
  }
}

window.customElements.define('grampsjs-fan-chart', GrampsjsFanChart)
