import {describe, it, expect, vi} from 'vitest'
import '../../src/components/GrampsjsFanChart.js'
import {layoutFan} from '../../src/charts/layout/fanLayout.js'
import {FamilyGraph} from '../../src/charts/model/FamilyGraph.js'
const p = {
  handle: 'person',
  gramps_id: 'DEMO',
  birth_ref_index: -1,
  event_ref_list: [{role: 'Primary'}],
  extended: {
    events: [
      {
        type: 'Burial',
        handle: 'event',
        gramps_id: 'E90001',
        date: {year: 1800},
        note_list: ['note'],
      },
    ],
  },
}
const setup = () => {
  const el = document.createElement('grampsjs-fan-chart')
  el._graph = new FamilyGraph([p])
  el._layout = {nodes: [{handle: 'person', person: p}]}
  el.color = 'estimatedYear'
  el.appState = {
    permissions: {canViewPrivate: true},
    i18n: {lang: 'en', strings: {}},
    apiGet: vi.fn(async () => ({
      data: {handle: 'note', text: {string: 'Âgé de 70 ans'}},
    })),
  }
  Object.defineProperty(el, 'isConnected', {value: true, configurable: true})
  el.requestUpdate = vi.fn()
  return el
}
describe('fan evidence component lifetime', () => {
  it('does not reload for unrelated appState counter updates or its own render', async () => {
    const el = setup()
    el._chart.update = vi.fn()
    el.updated(new Map([['data', []]]))
    await vi.waitFor(() => expect(el.requestUpdate).toHaveBeenCalled())
    expect(el.appState.apiGet).toHaveBeenCalledTimes(1)
    el.appState = {...el.appState, loadingCount: 1}
    el.updated(new Map([['appState', {}]]))
    el.updated(new Map())
    expect(el.appState.apiGet).toHaveBeenCalledTimes(1)
  })
  it('drops a late response after mode changes, and stops further reads', async () => {
    const el = setup()
    let finish
    el.appState.apiGet = vi.fn(
      () =>
        new Promise(resolve => {
          finish = resolve
        })
    )
    const loading = el._loadYearEvidence()
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
    el.color = 'age'
    await el._loadYearEvidence()
    finish({data: {handle: 'note', text: {string: 'Âgé de 70 ans'}}})
    await loading
    expect(el._yearEvidence.size).toBe(0)
  })
  it('drops notes when private permission is revoked', async () => {
    const el = setup()
    await el._loadYearEvidence()
    expect(el._yearEvidence.get('person')).toHaveLength(1)
    el.appState = {...el.appState, permissions: {canViewPrivate: false}}
    await el._loadYearEvidence()
    expect(el._yearEvidence.get('person')).toEqual([])
    expect(el.appState.apiGet).toHaveBeenCalledTimes(1)
  })
  it('keeps the same displayed layout for non-layout updates', () => {
    const el = setup()
    expect(el._displayLayout()).toBe(el._displayLayout())
    expect(el._displayLayout()).not.toBe(el._layout)
    expect(el._layout.nodes[0].person).toBe(p)
  })
})

it('exports the same family evidence as the live display, without altering source data', async () => {
  const el = setup()
  const profile = {name_given: 'Fictional', name_surname: 'Example', sex: 'F'}
  const source = {...p, profile, extended: {events: []}, event_ref_list: []}
  el._layout = layoutFan(new FamilyGraph([source]), 'person', {depth: 2})
  el._familyEvents = new Map([
    [
      'person',
      [
        {
          father_handle: 'person',
          event_ref_list: [{role: 'Family'}],
          extended: {events: [{type: 'Marriage', date: {year: 1800}}]},
        },
      ],
    ],
  ])
  const before = JSON.stringify(source)
  const svg = new DOMParser().parseFromString(
    await el.svgDocument(),
    'image/svg+xml'
  )
  expect(svg.querySelector('[data-year-level="marriage"]')).not.toBeNull()
  expect(svg.querySelector('#legend')?.textContent).toContain(
    'Estimated, not birth'
  )
  expect(JSON.stringify(source)).toBe(before)
})
