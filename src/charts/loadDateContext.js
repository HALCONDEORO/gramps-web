// Per-load memory only. No persistent cache and no write-capable API method.
export async function loadDateContext(person, apiGet, isCurrent = () => true) {
  const families = []
  const people = []
  let incomplete = false
  const read = async (kind, handle, extend) => {
    if (!isCurrent()) return undefined
    try {
      const response = await apiGet(
        `/api/${kind}/${encodeURIComponent(handle)}?extend=${extend}`
      )
      if (response?.data?.handle === handle) return response.data
    } catch {
      /* An unavailable object is not evidence of a contradiction. */
    }
    incomplete = true
    return undefined
  }
  const handles = [
    ...new Set([
      ...(person?.family_list ?? []),
      ...(person?.parent_family_list ?? []),
    ]),
  ]
  // Bound automatic requests on very large or malformed relationships.
  if (handles.length > 30) incomplete = true
  for (const handle of handles.slice(0, 30)) {
    if (!isCurrent()) return {families: [], people: [], incomplete: true}
    const family = await read('families', handle, 'event_ref_list')
    if (!family) continue
    const own = [family.father_handle, family.mother_handle].includes(
      person.handle
    )
    const child = family.child_ref_list?.some(ref => ref.ref === person.handle)
    if (!own && !child) {
      incomplete = true
      continue
    }
    families.push(family)
  }
  const relatives = [
    ...new Set(
      families
        .flatMap(f => [
          f.father_handle,
          f.mother_handle,
          ...(f.child_ref_list ?? []).map(ref => ref.ref),
        ])
        .filter(h => typeof h === 'string' && h && h !== person.handle)
    ),
  ]
  if (relatives.length > 100) incomplete = true
  for (const handle of relatives.slice(0, 100)) {
    if (!isCurrent()) return {families: [], people: [], incomplete: true}
    const relative = await read('people', handle, 'event_ref_list')
    if (relative) people.push(relative)
  }
  return {families, people, incomplete}
}
