import {gregorianSdn, isValidCalendarDate} from '../gcalendar.js'

// Only recorded Gregorian dates with normal quality and no modifiers. Partial
// dates are intervals, not January 1. Other dates remain unassessed.
export function recordedInterval(date) {
  if (
    date?.calendar !== 0 ||
    date?.modifier !== 0 ||
    date?.quality !== 0 ||
    (date?.newyear !== undefined && date.newyear !== 0)
  )
    return undefined
  const dv = date.dateval
  if (!Array.isArray(dv) || dv.length !== 4 || dv[3]) return undefined
  const [day, month, year] = dv
  if (
    !Number.isInteger(year) ||
    year < 1 ||
    year > 9999 ||
    !Number.isInteger(month) ||
    month < 0 ||
    month > 12 ||
    !Number.isInteger(day) ||
    day < 0 ||
    day > 31 ||
    (day && !month) ||
    !isValidCalendarDate(0, year, month, day)
  )
    return undefined
  const firstMonth = month || 1
  const lastMonth = month || 12
  let lastDay = day || 31
  while (!isValidCalendarDate(0, year, lastMonth, lastDay)) lastDay -= 1
  return [
    gregorianSdn(year, firstMonth, day || 1),
    gregorianSdn(year, lastMonth, lastDay),
  ]
}

const primary = (object, type, roles = ['Primary']) =>
  (object?.extended?.events ?? []).filter(event => {
    if (event?.type !== type || !event.handle) return false
    const refs = (object.event_ref_list ?? []).filter(
      ref => ref.ref === event.handle
    )
    return refs.length === 1 && roles.includes(refs[0].role)
  })
const before = (first, second) => {
  const a = recordedInterval(first?.date)
  const b = recordedInterval(second?.date)
  return Boolean(a && b && a[1] < b[0])
}
const reference = (object, kind) => ({
  kind,
  id: object?.gramps_id,
  handle: object?.handle,
})

// Pure read-only flags. A flag asks for source review, never fixes a date or
// diagnoses a family relationship. Evidence must be from the selected objects.
export function dateContradictions(person, people = [], families = []) {
  const alerts = []
  const add = (code, events, objects) => {
    if (events.some(event => !event?.gramps_id)) return
    const refs = [...objects, ...events.map(event => reference(event, 'event'))]
    const key = `${code}:${refs
      .map(ref => `${ref.kind}:${ref.handle}`)
      .sort()
      .join(':')}`
    if (!alerts.some(alert => alert.key === key)) alerts.push({key, code, refs})
  }
  const self = reference(person, 'person')
  for (const burial of primary(person, 'Burial'))
    for (const baptism of [
      ...primary(person, 'Baptism'),
      ...primary(person, 'Christening'),
    ])
      if (before(burial, baptism))
        add('burialBeforeBaptism', [burial, baptism], [self])
  const byHandle = new Map(
    [person, ...people].filter(Boolean).map(p => [p.handle, p])
  )
  for (const family of families) {
    if (
      ![
        ...(person?.family_list ?? []),
        ...(person?.parent_family_list ?? []),
      ].includes(family.handle)
    )
      continue
    for (const childRef of family.child_ref_list ?? []) {
      const child = byHandle.get(childRef.ref)
      if (!child) continue
      for (const [parentHandle, relation] of [
        [family.father_handle, childRef.frel],
        [family.mother_handle, childRef.mrel],
      ]) {
        if (
          relation !== 'Birth' ||
          (child.handle !== person.handle && parentHandle !== person.handle)
        )
          continue
        const parent = byHandle.get(parentHandle)
        for (const birth of primary(child, 'Birth'))
          for (const parentBirth of primary(parent, 'Birth'))
            if (before(birth, parentBirth))
              add(
                'childBeforeParent',
                [birth, parentBirth],
                [reference(child, 'person'), reference(parent, 'person')]
              )
      }
    }
  }
  // A second wedding alone proves no overlap. Flag only a wedding strictly
  // inside another recorded marriage-to-divorce interval, for different mates.
  const own = families.filter(
    f =>
      person?.family_list?.includes(f.handle) &&
      [f.father_handle, f.mother_handle].includes(person.handle)
  )
  const spouse = f =>
    [f.father_handle, f.mother_handle].find(h => h && h !== person.handle)
  for (const first of own)
    for (const second of own) {
      if (!spouse(first) || !spouse(second) || spouse(first) === spouse(second))
        continue
      for (const start of primary(first, 'Marriage', ['Family', 'Primary']))
        for (const end of primary(first, 'Divorce', ['Family', 'Primary']))
          for (const wedding of primary(second, 'Marriage', [
            'Family',
            'Primary',
          ]))
            if (before(start, wedding) && before(wedding, end))
              add(
                'marriageBeforeDivorce',
                [start, wedding, end],
                [self, reference(first, 'family'), reference(second, 'family')]
              )
    }
  return alerts
}
