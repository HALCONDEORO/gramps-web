// Display-only colour value. Never write this fallback into a birth event or
// use it to calculate age. The event list and its references have matching order.
export function fanColorYear(person) {
  const events = person?.extended?.events ?? []
  const birthYear = events[person?.birth_ref_index]?.date?.year
  if (birthYear) return birthYear

  const years = events
    .filter(
      (event, index) =>
        ['Baptism', 'Christening'].includes(event?.type) &&
        person?.event_ref_list?.[index]?.role === 'Primary'
    )
    .map(event => event?.date?.year)
    .filter(year => Number.isFinite(year) && year > 0)
  return years.length ? Math.min(...years) : undefined
}
