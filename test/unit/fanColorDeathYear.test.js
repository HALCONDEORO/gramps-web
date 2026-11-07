import {describe, it, expect} from 'vitest'
import {fanDeathYear} from '../../src/charts/fanDeathYear.js'
import {fanColorModes} from '../../src/charts/FanChart.js'
const make = (events, death = -1, roles = events.map(() => 'Primary')) => ({
  death_ref_index: death,
  birth_ref_index: -1,
  extended: {events: events.map(([type, year]) => ({type, date: {year}}))},
  event_ref_list: roles.map(role => ({role})),
})
describe('death or burial display year', () => {
  it('keeps actual Death priority and a distinct recorded level', () => {
    expect(
      fanDeathYear(
        make(
          [
            ['Death', 1700],
            ['Burial', 1701],
          ],
          0
        )
      )
    ).toEqual({year: 1700, level: 'death'})
  })
  it('uses earliest Primary Burial and labels it burial, never Death', () => {
    expect(
      fanDeathYear(
        make([
          ['Burial', 1710],
          ['Burial', 1701],
        ])
      )
    ).toEqual({year: 1701, level: 'burial'})
  })
  it('falls back if Death is undated and does not change Age or source data', () => {
    const p = make(
      [
        ['Death', 0],
        ['Burial', 1701],
      ],
      0
    )
    const before = JSON.stringify(p)
    expect(fanColorModes.deathYear.fct(p)).toBe(1701)
    expect(fanColorModes.age.fct(p)).toBeUndefined()
    expect(JSON.stringify(p)).toBe(before)
  })
  it('does not use witness, missing references or cremation', () => {
    expect(
      fanDeathYear(make([['Burial', 1701]], -1, ['Witness']))
    ).toBeUndefined()
    const p = make([['Burial', 1701]])
    p.event_ref_list = []
    expect(fanDeathYear(p)).toBeUndefined()
    expect(fanDeathYear(make([['Cremation', 1701]]))).toBeUndefined()
  })
  it('does not invent an empty, invalid or nonpositive date', () => {
    for (const y of [0, -1, NaN, Infinity, '1701']) {
      expect(fanDeathYear(make([['Burial', y]]))).toBeUndefined()
    }
    expect(fanDeathYear()).toBeUndefined()
  })
})
