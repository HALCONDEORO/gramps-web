import {describe, it, expect, vi} from 'vitest'
import {loadFanYearEvidence} from '../../src/charts/loadFanYearEvidence.js'
const e = {
  handle: 'burial',
  gramps_id: 'E90001',
  type: 'Burial',
  date: {year: 1800},
  note_list: ['note'],
  description: '',
}
const p = {
  handle: 'person',
  birth_ref_index: -1,
  event_ref_list: [{role: 'Primary'}],
  note_list: ['note'],
  extended: {events: [e], families: []},
}
describe('authenticated ephemeral fan evidence', () => {
  it('loads plain text through apiGet and deduplicates note requests', async () => {
    const apiGet = vi.fn(async () => ({
      data: {handle: 'note', text: {string: 'Âgé de 70 ans'}},
    }))
    const before = JSON.stringify(p)
    const result = await loadFanYearEvidence([p], apiGet, {privateNotes: true})
    expect(apiGet).toHaveBeenCalledTimes(1)
    expect(apiGet.mock.calls[0][0]).toBe(
      '/api/notes/note?locale=en&profile=all&extend=all'
    )
    expect(result.yearEvidence.get('person')[0]).toMatchObject({
      years: 70,
      eventHandle: 'burial',
    })
    expect(JSON.stringify(p)).toBe(before)
  })
  it('does not request private notes without private permission', async () => {
    const apiGet = vi.fn()
    const result = await loadFanYearEvidence([p], apiGet)
    expect(apiGet).not.toHaveBeenCalled()
    expect(result.yearEvidence.get('person')).toEqual([])
  })
  it.each([
    {error: '403'},
    {data: null},
    {data: {handle: 'wrong', text: {string: '70 ans'}}},
  ])('fails closed on inaccessible or mismatched notes', async response => {
    const result = await loadFanYearEvidence([p], async () => response, {
      privateNotes: true,
    })
    expect(result.yearEvidence.get('person')).toEqual([])
  })
  it('does not cache notes between loads', async () => {
    const apiGet = vi.fn(async () => ({
      data: {handle: 'note', text: {string: '70 ans'}},
    }))
    await loadFanYearEvidence([p], apiGet, {privateNotes: true})
    await loadFanYearEvidence([p], apiGet, {privateNotes: true})
    expect(apiGet).toHaveBeenCalledTimes(2)
  })
  it('resolves only own families through the authenticated endpoint', async () => {
    const own = {
      handle: 'own',
      father_handle: 'person',
      mother_handle: 'partner',
    }
    const parents = {
      handle: 'parents',
      father_handle: 'father',
      mother_handle: 'mother',
    }
    const apiGet = vi.fn(async () => ({
      data: {
        ...own,
        extended: {events: [{type: 'Marriage', date: {year: 1770}}]},
      },
    }))
    const result = await loadFanYearEvidence(
      [{...p, extended: {events: [], families: [own, parents]}}],
      apiGet
    )
    expect(apiGet).toHaveBeenCalledTimes(1)
    expect(apiGet.mock.calls[0][0]).toContain('/api/families/own?')
    expect(result.familyEvents.get('person')).toHaveLength(1)
  })
  it('stops further requests after cancellation', async () => {
    let current = true
    const apiGet = vi.fn(async () => {
      current = false
      return {data: {handle: 'note', text: {string: '70 ans'}}}
    })
    const other = {
      ...p,
      handle: 'other',
      note_list: ['othernote'],
      extended: {events: [{...e, note_list: ['othernote']}], families: []},
    }
    const result = await loadFanYearEvidence([p, other], apiGet, {
      privateNotes: true,
      isCurrent: () => current,
    })
    expect(apiGet).toHaveBeenCalledTimes(1)
    expect(result.yearEvidence.size).toBe(0)
  })
  it('does not fetch evidence for already recorded birth/baptism', async () => {
    const apiGet = vi.fn()
    await loadFanYearEvidence([{...p, birth_ref_index: 0}], apiGet, {
      privateNotes: true,
    })
    expect(apiGet).not.toHaveBeenCalled()
  })
})
