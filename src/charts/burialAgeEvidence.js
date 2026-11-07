// Strict plain-text parsing, never HTML or code. No names or tree IDs are stored.
const normalize = text =>
  String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
const units = {
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
  onze: 11,
  douze: 12,
  treize: 13,
  quatorze: 14,
  quinze: 15,
  seize: 16,
  veinte: 20,
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90,
  vingt: 20,
  trente: 30,
  quarante: 40,
  cinquante: 50,
  soixante: 60,
}
function number(text) {
  const compact = normalize(text)
    .replace(/[\s-]+/g, '')
    .replace(/^d?environ/, '')
  if (/^\d{1,3}$/.test(compact)) return Number(compact)
  if (compact === 'quatrevingts' || compact === 'quatrevingt') return 80
  if (compact === 'quatrevingtdix') return 90
  if (compact in units) return units[compact]
  for (const [word, tens] of Object.entries(units).filter(([, n]) => n >= 20)) {
    if (compact.startsWith(word)) {
      const tail = compact.slice(word.length).replace(/^(?:et|y)/, '')
      if (tail in units && units[tail] < 20) return tens + units[tail]
    }
  }
  return undefined
}

// Personal notes need an explicit event identifier in the same clause. Merely
// mentioning a burial somewhere in a multi-person note is not sufficient.
export function parseBurialAge(
  text,
  event,
  {attached = false, noteHandle} = {}
) {
  if (
    typeof text !== 'string' ||
    /<[^>]*>/.test(text) ||
    text.length > 100000 ||
    event?.type !== 'Burial'
  )
    return []
  const result = []
  const id = event.gramps_id
  const escapedId = String(id ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const clauses = text.split(/[;\n.]+/)
  for (const clause of clauses) {
    const value = normalize(clause)
    if (/-\s*\d+\s*(?:ans|anos)/.test(value)) continue
    if (
      !attached &&
      (!id ||
        !new RegExp(`(^|[^a-z0-9])${escapedId}(?![a-z0-9])`, 'i').test(clause))
    )
      continue
    if (
      /(?:cens|padron|testig|temoin|retir|discard|descart|indice|index|contradi|no acta|hypothes|hipotes)/.test(
        value
      )
    )
      continue
    // Reject another event reference, even in an event-attached multi-act note.
    const refs = clause.match(/\bE\d+\b/g) ?? []
    if (refs.some(ref => ref !== id)) continue
    // A single age statement, not an arbitrary number, date or birth estimate.
    const words = [...Object.keys(units), 'vingts', 'et', 'y'].join('|')
    const expression = `(\\d{1,3}|(?:${words})(?:[ -]*(?:${words})){0,4})\\s*(?:ans|anos)(?![a-z])`
    const explicit = new RegExp(
      `(?:^|[^a-z])(?:a+ge(?:e)?(?: de| d['’])?|edad|a los|unos|environ)\\s*(?:environ\\s*)?${expression}`,
      'g'
    )
    let found = [...value.matchAll(explicit)]
    // Bare numeric years are accepted only as a whole age statement or in a
    // clause explicitly describing this interment, never embedded in an ID.
    if (
      !found.length &&
      (/^(?:\d{1,3})\s*(?:ans|anos)$/.test(value.trim()) ||
        /sepultur|entierro|burial|inhum/.test(value))
    ) {
      const numeric = /(?:^|[^a-z0-9])(\d{1,3})\s*(?:ans|anos)(?![a-z])/g
      found = [...value.matchAll(numeric)]
    }
    const allNumbers = [
      ...value.matchAll(/(?:^|[^a-z0-9])(\d{1,3})\s*(?:ans|anos)(?![a-z])/g),
    ].map(match => Number(match[1]))
    if (new Set(allNumbers).size > 1) continue
    const ages = found
      .map(match => number(match[1]))
      .filter(age => Number.isFinite(age) && age >= 0 && age <= 120)
    if (ages.length !== 1) continue
    result.push({
      eventHandle: event.handle,
      years: ages[0],
      evidence: 'explicit-burial-age',
      sourceNoteHandles: noteHandle ? [noteHandle] : [],
      approximate: /environ|unos|aprox|~/.test(value),
      candidate: /candidat|probable|\(\?\)/.test(normalize(text)),
    })
  }
  // Multiple different ages mean unresolved evidence, not a choice of one.
  return new Set(result.map(value => value.years)).size > 1 ? [] : result
}
