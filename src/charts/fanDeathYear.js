// Display-only. Burial is evidence of an interment, not a Death event.
export function fanDeathYear(person) {
  const events = person?.extended?.events ?? []
  const death = events[person?.death_ref_index]?.date?.year
  if (Number.isFinite(death) && death > 0) return {year: death, level: 'death'}
  const burial = events
    .filter(
      (event, index) =>
        event?.type === 'Burial' &&
        person?.event_ref_list?.[index]?.role === 'Primary'
    )
    .map(event => event.date?.year)
    .filter(year => Number.isFinite(year) && year > 0)
  return burial.length
    ? {year: Math.min(...burial), level: 'burial'}
    : undefined
}
