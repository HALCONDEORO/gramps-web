import {describe, it, expect, vi} from 'vitest'
import {loadDateContext} from '../../src/charts/loadDateContext.js'
import '../../src/components/GrampsjsDateAlerts.js'

const person = {
  handle: 'self',
  gramps_id: 'I-DEMO',
  family_list: ['f'],
  parent_family_list: [],
}
const family = {
  handle: 'f',
  father_handle: 'self',
  mother_handle: 'mate',
  child_ref_list: [{ref: 'child'}],
}
describe('authenticated read-only date context', () => {
  it('loads only linked family/people, validates handles and never mutates', async () => {
    const before = JSON.stringify(person)
    const api = vi.fn(async url => ({
      data: url.includes('/families/')
        ? family
        : {handle: url.includes('mate') ? 'mate' : 'child'},
    }))
    const result = await loadDateContext(person, api)
    expect(result.families).toEqual([family])
    expect(result.people).toHaveLength(2)
    expect(result.incomplete).toBe(false)
    expect(api.mock.calls.map(([url]) => url)).toEqual([
      '/api/families/f?extend=event_ref_list',
      '/api/people/mate?extend=event_ref_list',
      '/api/people/child?extend=event_ref_list',
    ])
    expect(JSON.stringify(person)).toBe(before)
  })
  it('rejects wrong handles, unrelated families and denied objects', async () => {
    for (const data of [
      {handle: 'wrong'},
      {handle: 'f', father_handle: 'unrelated'},
      undefined,
    ]) {
      const api = vi.fn(async () => ({data}))
      const result = await loadDateContext(person, api)
      expect(result.families).toEqual([])
      expect(result.people).toEqual([])
      expect(result.incomplete).toBe(true)
      expect(api).toHaveBeenCalledTimes(1)
    }
  })
  it('bounds automatic requests and stops after cancellation', async () => {
    let current = true
    const api = vi.fn(async () => {
      current = false
      return {data: family}
    })
    const result = await loadDateContext(person, api, () => current)
    expect(result.people).toEqual([])
    expect(api).toHaveBeenCalledTimes(1)
    const many = {
      ...person,
      family_list: Array.from({length: 50}, (_, i) => `f${i}`),
    }
    const reads = vi.fn(async () => ({error: 'denied'}))
    expect((await loadDateContext(many, reads)).incomplete).toBe(true)
    expect(reads).toHaveBeenCalledTimes(30)
  })
})
describe('date checks panel lifecycle', () => {
  const setup = () => {
    const el = document.createElement('grampsjs-date-alerts')
    Object.defineProperty(el, 'isConnected', {value: true, configurable: true})
    el.person = person
    el.appState = {
      permissions: {canViewPrivate: true},
      i18n: {strings: {}},
      apiGet: vi.fn(async () => ({data: family})),
    }
    return el
  }
  it('ignores a late response after navigating to another person', async () => {
    const el = setup()
    let finish
    el._apiGet = vi.fn(
      () =>
        new Promise(resolve => {
          finish = resolve
        })
    )
    const first = el._load()
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
    el.person = {handle: 'new', gramps_id: 'OTHER'}
    el._apiGet = vi.fn(async () => ({error: 'denied'}))
    await el._load()
    finish({data: family})
    await first
    expect(el._alerts).toEqual([])
    expect(el._loading).toBe(false)
  })
  it('does not refetch on unrelated loading counter updates', async () => {
    const el = setup()
    el.updated(new Map([['person', null]]))
    await vi.waitFor(() => expect(el._loading).toBe(false))
    const count = el.appState.apiGet.mock.calls.length
    el.appState = {...el.appState, loadingCount: 4}
    el.updated(new Map([['appState', {}]]))
    expect(el.appState.apiGet).toHaveBeenCalledTimes(count)
  })
})
