import {html} from 'lit'

import {chartSvgDocument} from '../charts/svgExport.js'
import {FanChart} from '../charts/FanChart.js'
import {loadFanYearEvidence} from '../charts/loadFanYearEvidence.js'
import {layoutFan} from '../charts/layout/fanLayout.js'
import {chartTransitionDuration} from '../charts/util.js'
import {GrampsjsChartBase} from './GrampsjsChartBase.js'
import {rootRelatives} from './GrampsjsChartRelativesMenu.js'

// Properties that change the layout of the chart
const layoutProperties = ['data', 'grampsId', 'depth']

class GrampsjsFanChart extends GrampsjsChartBase {
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
    this._yearEvidence = new Map()
    this._familyEvents = new Map()
    this._evidenceRequest = 0
  }

  render() {
    return html`
      <div
        @pedigree:show-children="${this._openMenu}"
        style="position:relative;"
      >
        <div id="container"></div>
        <grampsjs-chart-relatives-menu
          id="relatives-menu"
          .relatives=${this._children()}
          nameDisplayFormat=${this.nameDisplayFormat}
          .appState=${this.appState}
        ></grampsjs-chart-relatives-menu>
      </div>
    `
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
    const scope = `${this.appState?.permissions?.canViewPrivate === true}:${
      this.appState?.i18n?.lang || 'en'
    }`
    if (
      layoutProperties.some(name => changed.has(name)) ||
      changed.has('color') ||
      scope !== this._evidenceScope
    ) {
      this._evidenceScope = scope
      this._loadYearEvidence()
    }
    if (!this._layout) {
      this._chart.clear()
      return
    }
    this._chart.update(this._displayLayout(), this.chartOptions())
  }

  _displayLayout() {
    if (this.color !== 'estimatedYear' || !this._layout) return this._layout
    if (
      this._displayOriginal === this._layout &&
      this._displayFamilies === this._familyEvents
    )
      return this._estimatedLayout
    this._displayOriginal = this._layout
    this._displayFamilies = this._familyEvents
    this._estimatedLayout = {
      ...this._layout,
      nodes: this._layout.nodes.map(node => ({
        ...node,
        person: {
          ...node.person,
          extended: {
            ...node.person?.extended,
            families:
              this._familyEvents.get(node.person?.handle) ??
              node.person?.extended?.families,
          },
        },
      })),
    }
    return this._estimatedLayout
  }

  async _loadYearEvidence() {
    const request = ++this._evidenceRequest
    this._yearEvidence = new Map()
    this._familyEvents = new Map()
    if (
      this.color !== 'estimatedYear' ||
      typeof this.appState?.apiGet !== 'function'
    )
      return
    const result = await loadFanYearEvidence(
      [
        ...new Map(
          (this._layout?.nodes ?? []).map(node => [node.handle, node.person])
        ).values(),
      ],
      endpoint => this.appState.apiGet(endpoint),
      {
        privateNotes: this.appState?.permissions?.canViewPrivate === true,
        lang: this.appState?.i18n?.lang || 'en',
        isCurrent: () =>
          request === this._evidenceRequest &&
          this.color === 'estimatedYear' &&
          this.isConnected,
      }
    )
    if (
      request !== this._evidenceRequest ||
      this.color !== 'estimatedYear' ||
      !this.isConnected
    )
      return
    this._yearEvidence = result.yearEvidence
    this._familyEvents = result.familyEvents
    this.requestUpdate()
  }

  disconnectedCallback() {
    this._evidenceRequest += 1
    this._yearEvidence = new Map()
    this._familyEvents = new Map()
    super.disconnectedCallback()
  }

  svgDocument() {
    if (!this._layout) return Promise.resolve(null)
    return chartSvgDocument(FanChart, this._displayLayout(), {
      ...this.chartOptions(),
      preserveLegend: ['estimatedYear', 'deathYear'].includes(this.color),
    })
  }

  chartOptions() {
    return {
      color: this.color || 'default',
      nameDisplayFormat: this.nameDisplayFormat,
      otherLabel: this._('Other'),
      burialLabel: this._('Burial, not death'),
      yearEvidence: this._yearEvidence ?? new Map(),
      estimateLabels: [
        this._('Estimated, not birth'),
        this._('Burial minus explicit age'),
        this._('Marriage minus 25 (heuristic)'),
        this._('First event date, not birth'),
      ],
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
