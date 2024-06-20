import {
  CALCULATION_MODE,
  Pacejka2002,
  TIRE_SIDE,
} from '../src/tire-models/pacejka2002.js'
import { beforeAll, describe, it } from 'jsr:@std/testing/bdd'
import { TireProperties } from '../src/tire-properties.js'
import { assertObjectMatch } from 'jsr:@std/assert'

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

  describe('loading parameters from individual .tir file sections', () => {
    it('UNITS', () => {
      assertObjectMatch(model.unitScales, {
        lengthMeters: 1.0,
        timeSeconds: 1.0,
        angleRadians: 1.0,
        massKilograms: 1.0,
        forceNewtons: 1.0,
        pressurePascals: 1.0,
        speedMetersPerSecond: 1.0,
        inertiaKilogramMetersSquared: 1.0,
        stiffnessNewtonsPerMeter: 1.0,
        dampingNewtonsPerMetersPerSecond: 1.0,
      })
    })

    it('MODEL', () => {
      assertObjectMatch(model.modelParameters, {
        measuredSide: TIRE_SIDE.LEFT,
        useFrictionEllipse: true,
        calculationMode: CALCULATION_MODE.COMBINED_FORCE,
      })
    })

    it('DIMENSION', () => {
      assertObjectMatch(model.dimensionParameters, {
        unloadedTireRadius: 0.344,
        tireWidth: 0.245,
        aspectRatio: 0.4,
      })
    })

    it('VERTICAL', () => {
      assertObjectMatch(
        // QFZ1 and QFZ2 have special calculations, so we'll ignore their values here
        { ...model.verticalParameters, qfz1: 0.0, qfz2: 0.0 },
        {
          verticalStiffness: 280835.2941,
          verticalDamping: 2000,
          fNomin: 4850,
          qfz1: 0.0,
          qfz2: 0.0,
          qfz3: 0.0,
          qpfz1: 0.0,
        },
      )
    })

    it('DIMENSION', () => {
      assertObjectMatch(model.dimensionParameters, {
        unloadedTireRadius: 0.344,
        tireWidth: 0.245,
        aspectRatio: 0.4,
      })
    })

    it('SCALING_COEFFICIENTS', () => {
      assertObjectMatch(model.scalingParameters, {
        lfzo: 0.81,
        lcx: 1,
        lmux: 1,
        lex: 1,
        lkx: 1,
        lhx: 1,
        lvx: 1,
        lgax: 1,
        lcy: 1,
        lmuy: 1,
        ley: 1,
        lky: 1,
        lhy: 1,
        lvy: 1,
        lgay: 1,
        ltr: 1,
        lres: 1,
        lgaz: 1,
        lxal: 1,
        lyka: 1,
        lvyka: 1,
        ls: 1,
        lsgkp: 1,
        lsgal: 1,
        lgyr: 1,
        lvmx: 1,
        lmx: 1,
        lmy: 1,
        lip: 1,
        lkyg: 1,
        lcz: 1,
      })
    })

    it('LONGITUDINAL_COEFFICIENTS', () => {
      assertObjectMatch(model.longitudinalParameters, {
        pcx1: 1.6411,
        pdx1: 1.1739,
        pdx2: -0.16395,
        pdx3: 0,
        pex1: 0.46403,
        pex2: 0.25022,
        pex3: 0.067842,
        pex4: -0.000037604,
        pkx1: 22.303,
        pkx2: 0.48896,
        pkx3: 0.21253,
        phx1: 0.0012297,
        phx2: 0.0004318,
        pvx1: -0.0000088098,
        pvx2: 0.00001862,
        rbx1: 0,
        rbx2: 0,
        rcx1: 0,
        rex1: 0,
        rex2: 0,
        rhx1: 0,
        ptx1: 2.3657,
        ptx2: 1.4112,
        ptx3: 0.56626,
        ppx1: 0,
        ppx2: 0,
        ppx3: 0,
        ppx4: 0,
      })
    })

    it('OVERTURNING_COEFFICIENTS', () => {
      assertObjectMatch(model.overturningParameters, {
        qsx2: 0.004,
      })
    })

    it('LATERAL_COEFFICIENTS', () => {
      assertObjectMatch(model.lateralParameters, {
        pcy1: 1.3507,
        pdy1: 1.0489,
        pdy2: -0.18033,
        pdy3: -2.8821,
        pey1: -0.0074722,
        pey2: -0.0063208,
        pey3: -9.9935,
        pey4: -760.14,
        pky1: -21.92,
        pky2: 2.0012,
        pky3: -0.024778,
        phy1: 0.0026747,
        phy2: 0.000089094,
        phy3: 0.031415,
        pvy1: 0.037318,
        pvy2: -0.010049,
        pvy3: -0.32931,
        pvy4: -0.69553,
        rby1: 0,
        rby2: 0,
        rby3: 0,
        rcy1: 0,
        rey1: 0,
        rey2: 0,
        rhy1: 0,
        rhy2: 0,
        rvy1: 0,
        rvy2: 0,
        rvy3: 0,
        rvy4: 0,
        rvy5: 0,
        rvy6: 0,
        pty1: 2.1439,
        pty2: 1.9829,
        ppy1: 0,
        ppy2: 0,
        ppy3: 0,
        ppy4: 0,
      })
    })

    it('ROLLING_COEFFICIENTS', () => {
      assertObjectMatch(model.rollingParameters, {})
    })

    it('ALIGNING_COEFFICIENTS', () => {
      assertObjectMatch(model.aligningParameters, {
        qbz1: 10.904,
        qbz2: -1.8412,
        qbz3: -0.52041,
        qbz4: 0.039211,
        qbz5: 0.41511,
        qbz9: 8.9846,
        qbz10: 0,
        qcz1: 1.2136,
        qdz1: 0.093509,
        qdz2: -0.0092183,
        qdz3: -0.057061,
        qdz4: 0.73954,
        qdz6: -0.0067783,
        qdz7: 0.0052254,
        qdz8: -0.18175,
        qdz9: 0.029952,
        qez1: -1.5697,
        qez2: 0.33394,
        qez3: 0,
        qez4: 0.26711,
        qez5: -3.594,
        qhz1: 0.0047326,
        qhz2: 0.0026687,
        qhz3: 0.11998,
        qhz4: 0.059083,
        qpz1: 0,
        qpz2: 0,
        ssz1: 0,
        ssz2: 0,
        ssz3: 0,
        ssz4: 0,
        qtz1: 0.2,
        mbelt: 5.4,
      })
    })

    it('TIRE_CONDITIONS', () => {
      assertObjectMatch(model.conditionsParameters, {
        ip: 200000,
        ipNom: 200000,
      })
    })
  })
})
