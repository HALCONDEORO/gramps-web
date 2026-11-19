import {describe, it, expect} from 'vitest'
import {
  firstSurname,
  surnameGroups,
  surnameColors,
} from '../../src/charts/fanSurname.js'
import {FanChart} from '../../src/charts/FanChart.js'
import {chartSvgDocument} from '../../src/charts/svgExport.js'

const person = surname => ({
  primary_name: {surname_list: [{surname}]},
  profile: {name_given: 'Example', name_surname: surname},
})
const node = (surname, i = 0) => ({person: person(surname), x0: i, x1: i + 1})

describe('display-only first surnames', () => {
  it('keeps compounds and exact spelling; joining Tevar and Tebar is opt-in', () => {
    expect(firstSurname(person('Example Second'))).toBe('Example')
    for (const s of ['Le Bloy', 'Le Blois', 'La Rosa', 'Pérez de Pacheco'])
      expect(firstSurname(person(s))).toBe(s)
    expect(firstSurname(person('Tebar Other'))).toBe('Tebar')
    expect(firstSurname(person('Tevar Other'), {joinTevarTebar: true})).toBe(
      'Tevar / Tebar'
    )
    expect(firstSurname(person('Tebar Other'), {joinTevarTebar: true})).toBe(
      'Tevar / Tebar'
    )
    expect(firstSurname(person('tevar Other'), {joinTevarTebar: true})).toBe(
      'tevar'
    )
    expect(firstSurname(person('López Other'))).not.toBe(
      firstSurname(person('Lopez Other'))
    )
    expect(firstSurname(person(''))).toBeUndefined()
  })
  it('counts drawn positions including repeated people without mutating inputs', () => {
    const n = node('Example Other')
    const nodes = [n, n, node('Different Other'), node(''), {person: undefined}]
    const before = JSON.stringify(nodes)
    const groups = surnameGroups(nodes)
    expect(groups.highlighted.find(g => g.name === 'Example').count).toBe(2)
    expect(groups.unknown).toBe(1)
    expect(groups.other).toBe(0)
    expect(JSON.stringify(nodes)).toBe(before)
    expect(groups.fill(n)).not.toBe(groups.fill(nodes[2]))
  })
  it('shows 18 distinct colors, accounts for overflow and uses readable text', () => {
    const nodes = Array.from({length: 21}, (_, i) =>
      node(`Surname${i} Other`, i)
    )
    const g = surnameGroups(nodes)
    expect(g.highlighted).toHaveLength(18)
    expect(new Set(g.highlighted.map(x => x.color)).size).toBe(18)
    expect(g.other).toBe(3)
    expect(
      g.highlighted.reduce((s, x) => s + x.count, 0) + g.other + g.unknown
    ).toBe(21)
    const luminance = hex =>
      hex
        .slice(1)
        .match(/../g)
        .map(x => parseInt(x, 16) / 255)
        .map(x => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
        .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0)
    for (const c of surnameColors)
      expect(
        (luminance(c) + 0.05) / (luminance('#18202c') + 0.05)
      ).toBeGreaterThan(4.5)
  })
  it('draws opaque fills and a count legend in both modes without side-color ambiguity', async () => {
    const nodes = [node('Tevar Other'), node('Tebar Other'), node('')].map(
      (n, i) => ({
        ...n,
        key: `p${i}`,
        handle: `h${i}`,
        generation: i ? 1 : 0,
        x0: i ? (i - 1) * Math.PI : 0,
        x1: i ? i * Math.PI : 2 * Math.PI,
        y0: i ? 60 : 0,
        y1: i ? 120 : 60,
      })
    )
    const layout = {
      nodes,
      radius: 120,
      bounds: {xMin: -120, xMax: 120, yMin: -120, yMax: 120},
    }
    const before = JSON.stringify(layout)
    const chart = new FanChart()
    chart.update(layout, {
      color: 'surnameFirstJoined',
      bboxWidth: 800,
      bboxHeight: 700,
    })
    expect(chart.node.querySelector('#legend').textContent).toContain(
      'Tevar / Tebar (2)'
    )
    expect(chart.node.querySelector('#legend').textContent).toContain(
      'No recorded surname (1)'
    )
    expect(
      [...chart.node.querySelectorAll('.fan-arc')].every(
        p => p.getAttribute('fill-opacity') === '1'
      )
    ).toBe(true)
    expect(
      [...chart.node.querySelectorAll('.fan-side')].every(
        p => p.getAttribute('display') === 'none'
      )
    ).toBe(true)
    const svg = await chartSvgDocument(FanChart, layout, {
      color: 'surnameFirstJoined',
      preserveLegend: true,
      legendWidth: 370,
      legendHeight: 600,
    })
    expect(svg).toContain('Tevar / Tebar (2)')
    expect(svg).toContain('width="650"')
    expect(JSON.stringify(layout)).toBe(before)
    chart.update(layout, {
      color: 'surnameFirst',
      bboxWidth: 800,
      bboxHeight: 700,
    })
    expect(chart.node.querySelector('#legend').textContent).toContain(
      'Tebar (1)'
    )
    expect(chart.node.querySelector('#legend').textContent).not.toContain(
      'Tevar / Tebar'
    )
  })
})

describe('first surname component panel', () => {
  it('renders a separate accessible count panel and keeps export legend', async () => {
    await import('../../src/components/GrampsjsFanChart.js')
    const view = document.createElement('grampsjs-fan-chart')
    view.appState = {i18n: {strings: {}, lang: 'en'}}
    view.color = 'surnameFirstJoined'
    document.body.append(view)
    await view.updateComplete
    const n = {
      ...node('Tevar Other'),
      key: 'p',
      handle: 'example',
      generation: 0,
      x0: 0,
      x1: 2 * Math.PI,
      y0: 0,
      y1: 60,
    }
    view._layout = {
      nodes: [n],
      radius: 60,
      bounds: {xMin: -60, xMax: 60, yMin: -60, yMax: 60},
    }
    view.requestUpdate()
    await view.updateComplete
    const panel = view.shadowRoot.querySelector('aside')
    expect(panel.getAttribute('tabindex')).toBe('0')
    expect(panel.textContent).toContain('Tevar / Tebar')
    expect(panel.querySelector('strong').textContent).toBe('1')
    expect(view._chart.node.querySelector('#legend').textContent).toBe('')
    expect(view._chart.node.querySelector('.fan-cell text').textContent).toBe(
      'Tevar'
    )
    expect(await view.svgDocument()).toContain('Tevar / Tebar (1)')
    view.color = 'surname'
    await view.updateComplete
    expect(view.shadowRoot.querySelector('aside')).toBeNull()
    view.remove()
  })
})
