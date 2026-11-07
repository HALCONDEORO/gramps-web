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

// Accept only standalone age clauses. Narrative prose cannot establish whose
// age it describes, even when the note is attached to a Burial event.
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
  const id = normalize(event.gramps_id)
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const words = [...Object.keys(units), 'vingts', 'et', 'y'].join('|')
  const age = `(\\d{1,3}|(?:${words})(?:[ -]*(?:${words})){0,4})\\s*(?:ans|anos)`
  const prefix = `(?:(?:a+ge(?:e)?(?: de| d['’])?|edad|a los|unos|environ)\\s*(?:environ\\s*)?)?`
  const grammar = new RegExp(
    `^(?:candidat(?:o|e)?\\s*\\(\\?\\)\\s*,?\\s*)?${prefix}${age}(?:\\s+(?:ou environ|environ|aprox))?$`
  )
  const result = []
  for (const clause of text.split(/[;\n.]+/)) {
    let value = normalize(clause).trim()
    let linked = false
    if (id) {
      const reference = new RegExp(`^${escapedId}(?![a-z0-9])\\s*[:,-]?\\s*`)
      if (reference.test(value)) {
        value = value.replace(reference, '')
        linked = true
      }
    }
    if (!attached && !linked) continue
    const found = grammar.exec(value)
    if (!found) continue
    const years = number(found[1])
    if (!Number.isFinite(years) || years < 0 || years > 120) continue
    result.push({
      eventHandle: event.handle,
      years,
      evidence: 'explicit-burial-age',
      sourceNoteHandles: noteHandle ? [noteHandle] : [],
      approximate: /environ|unos|aprox/.test(value),
      candidate: /candidat/.test(value),
    })
  }
  return new Set(result.map(value => value.years)).size > 1 ? [] : result
}
