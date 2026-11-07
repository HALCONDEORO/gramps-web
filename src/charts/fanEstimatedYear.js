import {fanColorYear} from './fanColorYear.js'

const validYear = year => Number.isFinite(year) && year > 0
const earliest = entries =>
  entries
    .filter(entry => validYear(entry.year))
    .sort((a, b) => a.year - b.year)[0]

// Display-only provenance, kept separate from the person and event objects.
// ageEvidence must come from this event's explicit burial age, never a census.
export function fanEstimatedYear(person, ageEvidence = []) {
  const recorded = fanColorYear(person)
  if (validYear(recorded)) return {year: recorded, level: 'recorded'}
  const events = (person?.extended?.events ?? []).filter(
    (event, index) =>
      person?.event_ref_list?.[index]?.role === 'Primary' &&
      validYear(event?.date?.year)
  )
  const burial = earliest(
    events
      .filter(event => event.type === 'Burial')
      .flatMap(event => {
        const ages = ageEvidence.filter(
          age =>
            age.evidence === 'explicit-burial-age' &&
            age.eventHandle === event.handle &&
            Number.isFinite(age.years) &&
            age.years >= 0 &&
            age.years <= 120
        )
        // Conflicting age statements are not a license to choose one.
        if (new Set(ages.map(age => age.years)).size !== 1) return []
        const [age] = ages
        return [
          {
            year: event.date.year - age.years,
            level: 'burialAge',
            source: event.handle,
            sourceNoteHandles: [
              ...new Set(ages.flatMap(value => value.sourceNoteHandles ?? [])),
            ],
            approximate: ages.some(value => value.approximate),
            candidate: ages.some(value => value.candidate),
          },
        ]
      })
  )
  if (burial) return burial
  const marriages = (person?.extended?.families ?? [])
    .filter(
      family =>
        person?.handle &&
        [family.father_handle, family.mother_handle].includes(person.handle)
    )
    .flatMap(family =>
      (family.extended?.events ?? []).filter(
        (event, index) =>
          event.type === 'Marriage' &&
          ['Family', 'Primary'].includes(
            family.event_ref_list?.[index]?.role
          ) &&
          validYear(event.date?.year)
      )
    )
  const wedding = earliest(
    marriages.map(event => ({
      year: event.date.year - 25,
      level: 'marriage',
      source: event.handle,
    }))
  )
  if (wedding) return wedding
  return earliest(
    [...events, ...marriages].map(event => ({
      year: event.date.year,
      level: 'firstEvent',
      source: event.handle,
    }))
  )
}
