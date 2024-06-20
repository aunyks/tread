import { HarshAndShyrokau2019 } from '../src/tire-models/harsh-and-shyrokau2019.js'
import { beforeAll, describe, it } from 'jsr:@std/testing/bdd'
import { TireProperties } from '../src/tire-properties.js'
import { assertObjectMatch } from 'jsr:@std/assert'

describe('Harsh and Shyrokau 2019 Model', () => {
  let model = null
  let _initializationErrors = null
  beforeAll(async () => {
    const properties = new TireProperties()
    properties.fromTirFile(
      await Deno.readTextFileSync('./tests/fixtures/audi-temp.tir'),
    )
    model = new HarshAndShyrokau2019({
      tireProperties: properties,
    })
    _initializationErrors = model.initializeFromProperties()
  })

  it('loads TEMPERATURE_COEFFICIENTS from a .tir file', () => {
    assertObjectMatch(model.temperatureParameters, {
      ty1: -0.25,
      ty2: 0.15,
      ty3: 0.25,
      ty4: -0.1,
      tx1: -0.25,
      tx2: 0.15,
      tx3: 0.25,
      tx4: -0.1,
      tref: 50,
    })
  })
})
