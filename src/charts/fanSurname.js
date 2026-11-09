// Display-only grouping. Never write these keys back to a person or a name.
export function firstSurname(person, {joinTevarTebar = false} = {}) {
  const part = person?.primary_name?.surname_list?.[0]
  if (typeof part?.surname !== 'string' || !part.surname.trim())
    return undefined
  const full = `${part.prefix || ''} ${part.surname}`.trim()
  // A word boundary is not an apellido boundary. Preserve particle-led and
  // internal-particle compounds rather than turning Le Bloy into Le.
  const compound =
    /^(?:le|la|les|de|del|des|du|van|von|da|dos|san|santa)\s/i.test(full) ||
    /\s(?:de|del|de la|de los)\s/i.test(full)
  const first = compound ? full : full.split(/\s+/)[0]
  return joinTevarTebar && (first === 'Tevar' || first === 'Tebar')
    ? 'Tevar / Tebar'
    : first
}

export const surnameColors = [
  '#81c7f5',
  '#f5a85e',
  '#83cd9c',
  '#f39caf',
  '#c0a1e1',
  '#80d7d8',
  '#d3b498',
  '#e8d265',
  '#b3d477',
  '#a8b3f0',
  '#f0b68e',
  '#df99cd',
  '#6bc5b5',
  '#a7cadc',
  '#c3bc93',
  '#deaa9e',
  '#c5dfb5',
  '#b7a0bf',
]

export function surnameGroups(nodes, {joinTevarTebar = false} = {}) {
  const key = node => firstSurname(node.person, {joinTevarTebar})
  const groups = new Map()
  let unknown = 0
  // Count actual drawn positions, not empty ancestor slots or unique people.
  for (const node of nodes.filter(n => n.person?.profile)) {
    const name = key(node)
    if (name === undefined) {
      unknown += 1
      continue
    }
    const group = groups.get(name) || {name, count: 0, share: 0}
    group.count += 1
    group.share += node.x1 - node.x0
    groups.set(name, group)
  }
  const ranked = [...groups.values()].sort(
    (a, b) =>
      b.share - a.share || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
  )
  const highlighted = ranked.slice(0, surnameColors.length)
  const colors = new Map(highlighted.map((g, i) => [g.name, surnameColors[i]]))
  return {
    highlighted: highlighted.map(g => ({...g, color: colors.get(g.name)})),
    other: ranked
      .slice(surnameColors.length)
      .reduce((sum, g) => sum + g.count, 0),
    unknown,
    fill: node =>
      key(node) === undefined ? '#293342' : colors.get(key(node)) || '#536276',
    text: node => (colors.has(key(node)) ? '#18202c' : '#f5f7fb'),
  }
}
