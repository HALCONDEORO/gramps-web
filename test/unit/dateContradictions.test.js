import {describe, it, expect} from 'vitest'
import {
  recordedInterval,
  dateContradictions,
} from '../../src/charts/dateContradictions.js'
const date = (year, month = 0, day = 0) => ({
  calendar: 0,
  modifier: 0,
  quality: 0,
  dateval: [day, month, year, false],
})
const event = (type, year, id = type) => ({
  handle: id,
  gramps_id: id,
  type,
  date: date(year),
})
const person = (handle, events = []) => ({
  handle,
  gramps_id: handle,
  event_ref_list: events.map(() => ({role: 'Primary'})),
  extended: {events},
})
const family = (handle, events, spouse = 'mate') => ({
  handle,
  gramps_id: handle,
  father_handle: 'self',
  mother_handle: spouse,
  event_ref_list: events.map(() => ({role: 'Family'})),
  extended: {events},
})
describe('recorded date intervals', () => {
  it('preserves the uncertainty of a year or month', () => {
    const year = recordedInterval(date(1900))
    expect(year[1] - year[0]).toBe(364)
    expect(
      recordedInterval(date(2000, 2))[1] - recordedInterval(date(2000, 2))[0]
    ).toBe(28)
    expect(recordedInterval(date(2000, 2, 29))[1]).toBe(
      recordedInterval(date(2000, 2, 29))[0]
    )
  })
  it.each([
    {...date(1900), modifier: 3},
    {...date(1900), modifier: 1},
    {...date(1900), modifier: 4},
    {...date(1900), quality: 1},
    {...date(1900), calendar: 1},
    date(1900, 2, 30),
    date(1900, 13),
    date(0),
    date(-1),
    date(1900, 0, 2),
    {...date(1900), dateval: [1, 1, 1900, true]},
    {year: 1900},
  ])('does not manufacture an interval from unsupported date %j', d =>
    expect(recordedInterval(d)).toBeUndefined()
  )
})
describe('read-only date contradiction flags', () => {
  it('flags burial before baptism and links both recorded events', () => {
    const p = person('self', [event('Burial', 1800), event('Baptism', 1801)])
    const before = JSON.stringify(p)
    const result = dateContradictions(p)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({code: 'burialBeforeBaptism'})
    expect(result[0].refs.map(r => r.kind)).toEqual([
      'person',
      'event',
      'event',
    ])
    expect(JSON.stringify(p)).toBe(before)
  })
  it('does not order overlapping partial dates, equal dates or unsupported estimates', () => {
    for (const baptism of [
      date(1800),
      date(1800, 5),
      {...date(1801), quality: 1},
    ]) {
      const p = person('self', [
        event('Burial', 1800),
        {...event('Baptism', 1800), date: baptism},
      ])
      expect(dateContradictions(p)).toEqual([])
    }
  })
  it('does not use witnesses, mismatched references or baptism as a parent birth', () => {
    const p = person('self', [event('Burial', 1800), event('Baptism', 1801)])
    p.event_ref_list[0].role = 'Witness'
    expect(dateContradictions(p)).toEqual([])
    p.event_ref_list = []
    expect(dateContradictions(p)).toEqual([])
  })
  it('flags a biological child born before a recorded parent birth', () => {
    const p = {
      ...person('self', [event('Birth', 1801, 'parentBirth')]),
      family_list: ['family'],
    }
    const child = person('child', [event('Birth', 1800, 'childBirth')])
    const f = {
      ...family('family', []),
      child_ref_list: [{ref: 'child', frel: 'Birth', mrel: 'Adopted'}],
    }
    expect(dateContradictions(p, [child], [f]).map(a => a.code)).toEqual([
      'childBeforeParent',
    ])
    f.child_ref_list[0].frel = 'Adopted'
    expect(dateContradictions(p, [child], [f])).toEqual([])
  })
  it('ignores unrelated families and missing relatives', () => {
    const p = person('self', [event('Birth', 1801)])
    const f = {
      ...family('other', []),
      child_ref_list: [{ref: 'child', frel: 'Birth'}],
    }
    expect(
      dateContradictions(p, [person('child', [event('Birth', 1800)])], [f])
    ).toEqual([])
  })
  it('does not infer simultaneous spouses from two weddings or missing divorce', () => {
    const p = {...person('self'), family_list: ['one', 'two']}
    const first = family('one', [event('Marriage', 1800, 'm1')])
    const second = family('two', [event('Marriage', 1802, 'm2')], 'otherMate')
    expect(dateContradictions(p, [], [first, second])).toEqual([])
    first.extended.events.push(event('Divorce', 1805, 'd1'))
    first.event_ref_list.push({role: 'Family'})
    expect(dateContradictions(p, [], [first, second]).map(a => a.code)).toEqual(
      ['marriageBeforeDivorce']
    )
    second.mother_handle = 'mate'
    expect(dateContradictions(p, [], [first, second])).toEqual([])
  })
})
