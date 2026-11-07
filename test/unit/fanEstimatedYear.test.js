import {describe, it, expect} from 'vitest'
import {fanEstimatedYear} from '../../src/charts/fanEstimatedYear.js'

const event = (type, year, handle = type) => ({type, handle, date: {year}})
const person = (events = [], families = []) => ({
  handle: 'person',
  birth_ref_index: -1,
  event_ref_list: events.map(e => ({ref: e.handle, role: 'Primary'})),
  extended: {events, families},
})
const marriage = year => ({
  handle: 'family',
  father_handle: 'person',
  mother_handle: 'partner',
  event_ref_list: [{ref: 'wedding', role: 'Family'}],
  extended: {events: [event('Marriage', year, 'wedding')]},
})
const age = (years, extra = {}) => ({
  eventHandle: 'Burial',
  years,
  evidence: 'explicit-burial-age',
  ...extra,
})

describe('display-only estimated fan years', () => {
  it('leaves a real birth or primary baptism ahead of every estimate', () => {
    const p = person(
      [event('Baptism', 1701), event('Burial', 1760)],
      [marriage(1725)]
    )
    expect(fanEstimatedYear(p, [age(70)])).toMatchObject({
      year: 1701,
      level: 'recorded',
    })
    p.extended.events.unshift(event('Birth', 1700))
    p.birth_ref_index = 0
    expect(fanEstimatedYear(p, [age(70)])).toMatchObject({
      year: 1700,
      level: 'recorded',
    })
  })
  it('prefers burial minus explicit age over marriage and first event', () => {
    expect(
      fanEstimatedYear(person([event('Burial', 1760)], [marriage(1720)]), [
        age(70),
      ])
    ).toMatchObject({year: 1690, level: 'burialAge', source: 'Burial'})
  })
  it('uses own marriage minus25 ahead of the first event', () => {
    expect(
      fanEstimatedYear(person([event('Residence', 1710)], [marriage(1740)]))
    ).toMatchObject({year: 1715, level: 'marriage', source: 'wedding'})
  })
  it('uses first positive primary personal date as the last resort, not birth', () => {
    expect(
      fanEstimatedYear(person([event('Death', 1780), event('Residence', 1745)]))
    ).toMatchObject({year: 1745, level: 'firstEvent', source: 'Residence'})
  })
  it('does not use a parent family or another couple marriage', () => {
    const f = marriage(1720)
    f.father_handle = 'father'
    expect(fanEstimatedYear(person([], [f]))).toBeUndefined()
  })
  it('ignores witness and missing personal roles', () => {
    const p = person([event('Burial', 1760)])
    p.event_ref_list[0].role = 'Witness'
    expect(fanEstimatedYear(p, [age(70)])).toBeUndefined()
    p.event_ref_list = []
    expect(fanEstimatedYear(p, [age(70)])).toBeUndefined()
  })
  it('will not subtract an age belonging to another burial or a census', () => {
    const p = person([event('Burial', 1760)])
    for (const a of [
      age(70, {eventHandle: 'elsewhere'}),
      age(70, {evidence: 'census-age'}),
    ]) {
      expect(fanEstimatedYear(p, [a])).toMatchObject({
        year: 1760,
        level: 'firstEvent',
      })
    }
  })
  it('retains approximate or candidate warnings rather than asserting birth', () => {
    expect(
      fanEstimatedYear(person([event('Burial', 1760)]), [
        age(70, {approximate: true, candidate: true}),
      ])
    ).toMatchObject({level: 'burialAge', approximate: true, candidate: true})
  })
  it('ignores invalid age, date and nonpositive result without inventing zero', () => {
    for (const years of [-1, NaN, Infinity, '70', 200]) {
      expect(
        fanEstimatedYear(person([event('Burial', 60)]), [age(years)])
      ).toMatchObject({year: 60, level: 'firstEvent'})
    }
    for (const year of [0, -10, NaN, Infinity, '1760']) {
      expect(
        fanEstimatedYear(person([event('Burial', year)]), [age(70)])
      ).toBeUndefined()
    }
  })
  it('takes the earliest usable marriage and first date regardless of event order', () => {
    expect(
      fanEstimatedYear(person([], [marriage(1760), marriage(1720)]))
    ).toMatchObject({year: 1695})
  })
  it('returns no year for an empty or unknown person', () => {
    expect(fanEstimatedYear()).toBeUndefined()
    expect(fanEstimatedYear(person())).toBeUndefined()
  })
  it('does not mutate any source objects or birth_ref_index', () => {
    const p = person([event('Burial', 1760)], [marriage(1720)])
    const a = [age(70)]
    const before = JSON.stringify({p, a})
    fanEstimatedYear(p, a)
    expect(JSON.stringify({p, a})).toBe(before)
  })
})
