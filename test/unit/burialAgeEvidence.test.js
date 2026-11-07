import {describe, it, expect} from 'vitest'
import {parseBurialAge} from '../../src/charts/burialAgeEvidence.js'
const e = {type: 'Burial', handle: 'burial', gramps_id: 'E90001'}
describe('strict burial age text evidence', () => {
  it.each([
    ['âgé de 72 ans', 72],
    ['aagé de soixante douze ans', 72],
    ['aagé d’environ cinquante trois ans', 53],
    ['Edad cincuenta y seis años', 56],
    ['90años', 90],
    ['âgé de quatre vingts ans', 80],
  ])('reads explicit event age %s', (text, years) => {
    expect(parseBurialAge(text, e, {attached: true})[0]?.years).toBe(years)
  })
  it('requires explicit linkage on personal notes', () => {
    expect(parseBurialAge('Sepultura: 60 años', e)).toEqual([])
    expect(parseBurialAge('E90001 edad60años', e)[0]?.years).toBe(60)
  })
  it.each([
    'Censo: 50 años',
    'Testigo, 50 años',
    'Índice: 57 años',
    'Primera lectura91años RETIRADA',
    'E90002 edad50años',
    'Edad 50años y 57años',
    '<script>50</script>',
    '12 meses',
    '200 años',
    'âgé de -1 ans',
    'Sepultura, -1 años',
  ])('fails closed for %s', text => {
    expect(parseBurialAge(text, e, {attached: true})).toEqual([])
  })
  it('does not read a calendar date or an age glued to another person ID', () => {
    expect(
      parseBurialAge(
        'En mil setecientos cincuenta y cinco años se enterró el cuerpo',
        e,
        {attached: true}
      )
    ).toEqual([])
    expect(
      parseBurialAge('1877I9000256años,1863I9000370', e, {attached: true})
    ).toEqual([])
  })
  it('preserves uncertainty and uses no HTML interpreter', () => {
    expect(
      parseBurialAge('Candidato(?), âgé de 85 ans ou environ', e, {
        attached: true,
      })[0]
    ).toMatchObject({years: 85, approximate: true, candidate: true})
  })
})

it('treats custom event identifiers as literal text, not regex syntax', () => {
  const event = {...e, gramps_id: 'E[90001'}
  expect(parseBurialAge('E[90001 edad60años', event)[0]?.years).toBe(60)
})

it.each([
  ['Inhumé Pierre, en présence de Jean son père âgé de 70 ans', true],
  ['E90001 Pierre inhumé en présence de Jean son frère âgé de 60 ans', false],
  ['Sepultura de Pedro, su padre Juan edad 70 años', true],
  ['Inhumé Pierre avec son fils Jean âgé de 20 ans', true],
  ['Inhumée Marie épouse de Jean âgé de 70 ans', true],
])(
  'rejects an age attached to a different or ambiguous subject: %s',
  (text, attached) => {
    expect(parseBurialAge(text, e, {attached})).toEqual([])
  }
)

it.each([
  'Inhumé Pierre avec Jean âgé de 70 ans',
  'Inhumé Pierre accompagné de Jean âgé de 70 ans',
  'Inhumé Pierre et Jean âgé de 70 ans',
  'E90001 Pierre, Jean âgé de 70 ans',
])('rejects all narrative subject ambiguity: %s', text => {
  expect(parseBurialAge(text, e, {attached: true})).toEqual([])
})
