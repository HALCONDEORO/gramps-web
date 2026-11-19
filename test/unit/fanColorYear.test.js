import {describe, it, expect} from 'vitest'
import {fanColorYear} from '../../src/charts/fanColorYear.js'
import {fanColorModes} from '../../src/charts/FanChart.js'

const person = (events, birth = -1, roles = events.map(() => 'Primary')) => ({
  birth_ref_index: birth,
  event_ref_list: roles.map(role => ({role})),
  extended: {events},
})
const event = (type, year) => ({type, date: {year}})

describe('fan birth or baptism year colour value', () => {
  it('uses Baptism when no birth exists', () => {
    expect(fanColorYear(person([event('Baptism', 1660)]))).toBe(1660)
  })
  it('uses Christening when no birth exists', () => {
    expect(fanColorYear(person([event('Christening', 1665)]))).toBe(1665)
  })
  it('keeps a known birth year ahead of any baptism year', () => {
    expect(
      fanColorYear(person([event('Birth', 1660), event('Baptism', 1661)], 0))
    ).toBe(1660)
  })
  it('falls back when a birth exists but has no year', () => {
    expect(
      fanColorYear(person([event('Birth', 0), event('Baptism', 1661)], 0))
    ).toBe(1661)
  })
  it('returns no value when no useful event exists', () => {
    for (const value of [
      undefined,
      {},
      person([]),
      person([event('Baptism', 0)]),
    ]) {
      expect(fanColorYear(value)).toBeUndefined()
    }
  })
  it('does not treat adult christening or unrelated events as birth proxies', () => {
    expect(
      fanColorYear(
        person([event('Adult Christening', 1700), event('Marriage', 1680)])
      )
    ).toBeUndefined()
  })
  it('ignores witness and secondary roles', () => {
    expect(
      fanColorYear(person([event('Baptism', 1660)], -1, ['Witness']))
    ).toBeUndefined()
  })
  it('does not assume a missing reference is a primary baptism', () => {
    expect(
      fanColorYear({extended: {events: [event('Baptism', 1660)]}})
    ).toBeUndefined()
  })
  it('chooses the earliest primary baptism year independently of list order', () => {
    expect(
      fanColorYear(person([event('Christening', 1665), event('Baptism', 1660)]))
    ).toBe(1660)
  })
  it('ignores empty, invalid and negative baptism years', () => {
    expect(
      fanColorYear(
        person([event('Baptism', -1), event('Christening', NaN), {}])
      )
    ).toBeUndefined()
  })
  it('uses the fallback in the real fan colour mode but not the age mode', () => {
    const value = person([event('Baptism', 1660), event('Death', 1720)])
    value.death_ref_index = 1
    expect(fanColorModes.birthYear.fct(value)).toBe(1660)
    expect(fanColorModes.age.fct(value)).toBeUndefined()
  })
  it('does not change any person, event, date or reference data', () => {
    const value = person([event('Baptism', 1660)])
    const before = JSON.stringify(value)
    fanColorYear(value)
    expect(JSON.stringify(value)).toBe(before)
    expect(value.birth_ref_index).toBe(-1)
    expect(value.extended.events[0].type).toBe('Baptism')
  })
})
