import {
  assert,
  assertEquals,
  assertFalse,
  assertThrows,
} from 'jsr:@std/assert'
import { describe, it } from 'jsr:@std/testing/bdd'
import { TireProperties } from '../src/tire-properties.js'

describe('TireProperties', () => {
  it('never throws an error on construction', () => {
    new TireProperties()
  })

  it('extends the Map standard library type', () => {
    const p = new TireProperties()
    assert(p instanceof Map)
  })

  it('has each of its sections extend the Map standard library type', () => {
    const properties = new TireProperties()
    properties.fromTirFile(`
      [MY_SECTION]
      MY_PARAMETER = 1.0
    `)
    assert(properties.get('MY_SECTION') instanceof Map)
  })

  describe('when parsing and loading from Tire Properties Files (.tir)', () => {
    it('throws an error when input is empty', () => {
      assertThrows(() => {
        const properties = new TireProperties()
        properties.fromTirFile(``)
      })
    })

    it('throws an error when input has parameters with no associated section', () => {
      assertThrows(() => {
        const properties = new TireProperties()
        properties.fromTirFile(`MY_PARAMETER = 1.0`)
      }, 'Input contains one parameter with no associated section')

      assertThrows(
        () => {
          const properties = new TireProperties()
          properties.fromTirFile(`
          MY_PARAMETER = 1.0

          [MY_SECTION]
          YOUR_PARAMETER = 0.5
        `)
        },
        'Input contains two parameters: one that is associated with a section and one that is not.',
      )
    })

    it('parses parameters and stores them in a map under their associated section', () => {
      const properties = new TireProperties()
      properties.fromTirFile(`
        [SECTION_ALPHA]
        PARAMETER_A = 0.1
        [SECTION_BETA]
        PARAMETER_B = 1.0
      `)
      assertEquals(
        properties.size,
        2,
        'Expected 2 sections, a different amount was found',
      )
      assert(
        properties.has('SECTION_ALPHA'),
        'Expected section "SECTION_ALPHA" not found',
      )
      assert(
        properties.has('SECTION_BETA'),
        'Expected section "SECTION_BETA" not found',
      )

      assert(properties.get('SECTION_ALPHA')?.get('PARAMETER_A'), 0.1)
      assertEquals(properties.get('SECTION_BETA')?.get('PARAMETER_B'), 1.0)
    })

    it('parses empty sections', () => {
      const properties = new TireProperties()
      properties.fromTirFile(`
        [SECTION_ALPHA]
        YOUR_PARAMETER = 0.5
        [SECTION_BETA]
      `)

      assert(
        properties.has('SECTION_ALPHA'),
        'Expected to parse section "SECTION_ALPHA" but it is not present',
      )
      assertEquals(
        properties.get('SECTION_ALPHA')?.get('YOUR_PARAMETER'),
        0.5,
        'Expected to parse parameter "YOUR_PARAMETER" in section "SECTION_ALPHA" but the parameter was not found',
      )
      assert(
        properties.has('SECTION_BETA'),
        'Expected to parse section "SECTION_BETA" but it is not present',
      )
      assertEquals(
        properties.get('SECTION_BETA').size,
        0,
        'Expected section "SECTION_BETA" to be empty but it was not',
      )

      const properties2 = new TireProperties()
      properties2.fromTirFile(`
        [SECTION_ALPHA]
      `)
      assert(
        properties2.has('SECTION_ALPHA'),
        'Expected to parse section "SECTION_ALPHA" but it is not present',
      )
      assertEquals(
        properties2.get('SECTION_ALPHA').size,
        0,
        'Expected section "SECTION_ALPHA" to be empty but was not',
      )
    })

    it('ignores "$" line-terminating comments', () => {
      const properties = new TireProperties()
      properties.fromTirFile(`
        [SECTION_ALPHA]
        YOUR_PARAMETER = 0.5 $ Hey there
      `)

      assertEquals(properties.get('SECTION_ALPHA')?.get('YOUR_PARAMETER'), 0.5)
    })

    it('ignores "!" line-terminating comments', () => {
      const properties = new TireProperties()
      properties.fromTirFile(`
        [SECTION_ALPHA]
        YOUR_PARAMETER = 0.5 ! Hey there
      `)

      assertEquals(properties.get('SECTION_ALPHA')?.get('YOUR_PARAMETER'), 0.5)
    })

    it('ignores "{" line-terminating comments', () => {
      const properties = new TireProperties()
      properties.fromTirFile(`
        [SECTION_ALPHA]
        YOUR_PARAMETER = 0.5 { Hey there
      `)

      assertEquals(properties.get('SECTION_ALPHA')?.get('YOUR_PARAMETER'), 0.5)
    })

    it('ignores "$" full line comments', () => {
      const properties = new TireProperties()
      properties.fromTirFile(`
        [SECTION_ALPHA]
        $ MY_PARAMETER = 1.0
        YOUR_PARAMETER = 0.5
      `)

      assertFalse(properties.get('SECTION_ALPHA')?.has('MY_PARAMETER'))
      assertEquals(properties.get('SECTION_ALPHA')?.get('YOUR_PARAMETER'), 0.5)
    })

    it('ignores "!" full line comments', () => {
      const properties = new TireProperties()
      properties.fromTirFile(`
        [SECTION_ALPHA]
        ! MY_PARAMETER = 1.0
        YOUR_PARAMETER = 0.5
      `)

      assertFalse(properties.get('SECTION_ALPHA')?.has('MY_PARAMETER'))
      assertEquals(properties.get('SECTION_ALPHA')?.get('YOUR_PARAMETER'), 0.5)
    })

    it('ignores "{" full line comments', () => {
      const properties = new TireProperties()
      properties.fromTirFile(`
        [SECTION_ALPHA]
        { MY_PARAMETER = 1.0
        YOUR_PARAMETER = 0.5
      `)

      assertFalse(properties.get('SECTION_ALPHA')?.has('MY_PARAMETER'))
      assertEquals(properties.get('SECTION_ALPHA')?.get('YOUR_PARAMETER'), 0.5)
    })

    it('parses numbers for parameters', () => {
      const properties = new TireProperties()
      properties.fromTirFile(`
        [SECTION_ALPHA]
        MY_PARAMETER = 0.5
      `)

      assertEquals(properties.get('SECTION_ALPHA')?.get('MY_PARAMETER'), 0.5)
    })

    it('parses strings for parameters', () => {
      const properties = new TireProperties()
      properties.fromTirFile(`
        [SECTION_ALPHA]
        MY_PARAMETER = 'my string'
      `)

      assertEquals(
        properties.get('SECTION_ALPHA')?.get('MY_PARAMETER'),
        'my string',
      )
    })
  })
})
