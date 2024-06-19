import { Pacejka2002 } from '../src/tire-models/pacejka2002.js'
import { beforeAll, describe } from 'jsr:@std/testing/bdd'
import { TireProperties } from '../src/tire-properties.js'

describe('Pacejka 2002 Model', () => {
  let model = null
  let _initializationErrors = null
  beforeAll(async () => {
    const properties = new TireProperties()
    properties.fromTirFile(
      await Deno.readTextFileSync('./tests/fixtures/params-test.tir'),
    )
    model = new Pacejka2002({
      tireProperties: properties,
    })
    _initializationErrors = model.initializeFromProperties()
  })
})
