import {fanColorYear} from './fanColorYear.js'
import {parseBurialAge} from './burialAgeEvidence.js'

// This cache belongs to one in-memory load. No localStorage, public fetch,
// static fixture, token handling or writes. Backend permissions remain final.
export async function loadFanYearEvidence(
  people,
  apiGet,
  {privateNotes = false, lang = 'en', isCurrent = () => true} = {}
) {
  const cache = new Map()
  const read = async (kind, handle, extend = '') => {
    if (!isCurrent() || !handle || typeof handle !== 'string') return undefined
    const url = `/api/${kind}/${encodeURIComponent(
      handle
    )}?locale=${encodeURIComponent(lang)}${extend}`
    if (!cache.has(url))
      cache.set(
        url,
        Promise.resolve()
          .then(() => apiGet(url))
          .then(response => response?.data)
          .catch(() => undefined)
      )
    return cache.get(url)
  }
  const yearEvidence = new Map()
  const familyEvents = new Map()
  const candidates = people.filter(person => !fanColorYear(person))
  // Sequential people, at most a small family/note batch per person. Only the
  // selected mode requests this evidence; normal tree views stay unchanged.
  for (const person of candidates) {
    if (!isCurrent()) return {yearEvidence: new Map(), familyEvents: new Map()}
    const families = []
    const familyRefs = new Map(
      (person.extended?.families ?? []).map(family => [family.handle, family])
    )
    for (const handle of person.family_list ?? []) {
      if (!familyRefs.has(handle)) familyRefs.set(handle, {handle})
    }
    for (const family of familyRefs.values()) {
      if (
        (family.father_handle || family.mother_handle) &&
        ![family.father_handle, family.mother_handle].includes(person.handle)
      )
        continue
      const data = family.extended?.events
        ? family
        : await read('families', family.handle, '&extend=event_ref_list')
      if (
        data?.handle === family.handle &&
        [data.father_handle, data.mother_handle].includes(person.handle)
      )
        families.push(data)
    }
    familyEvents.set(person.handle, families)
    const evidence = []
    const events = person.extended?.events ?? []
    for (let i = 0; i < events.length; i += 1) {
      const event = events[i]
      if (
        event.type !== 'Burial' ||
        person.event_ref_list?.[i]?.role !== 'Primary'
      )
        continue
      evidence.push(
        ...parseBurialAge(event.description, event, {attached: true})
      )
      if (!privateNotes) continue
      const eventNotes = new Set(event.note_list ?? [])
      for (const handle of new Set([
        ...eventNotes,
        ...(person.note_list ?? []),
      ])) {
        const note = await read('notes', handle, '&profile=all&extend=all')
        if (!note || note.handle !== handle) continue
        evidence.push(
          ...parseBurialAge(note.text?.string, event, {
            attached: eventNotes.has(handle),
            noteHandle: handle,
          })
        )
      }
    }
    yearEvidence.set(person.handle, evidence)
  }
  return {yearEvidence, familyEvents}
}
