import {
  Pacejka2002,
  PropertyNotFoundError,
  SectionNotFoundError,
} from './pacejka2002.js'
import { clamp, DEFAULT_EPSILON } from '../math.js'

/**
 * An extension to the Pacejka Magic Formula model that models
 * includes temperature effects in tire force calculations.
 */
class HarshAndShyrokau2019 extends Pacejka2002 {
  constructor(config) {
    super(config)

    this.temperatureParameters = {}
  }

  initializeFromProperties() {
    super.initializeFromProperties()
    this.loadTemperature()
  }

  loadTemperature() {
    const errors = []
    const longitudinalSection = this.properties.get('TEMPERATURE_COEFFICIENTS')
    if (!longitudinalSection) {
      return [new SectionNotFoundError('TEMPERATURE_COEFFICIENTS')]
    }

    const parameters = [
      'TY1',
      'TY2',
      'TY3',
      'TY4',
      'TX1',
      'TX2',
      'TX3',
      'TX4',
      'TREF',
    ]

    parameters.forEach((param) => {
      const value = longitudinalSection.get(param)
      if (value) {
        this.temperatureParameters[param.toLowerCase()] = value
      } else {
        this.temperatureParameters[param.toLowerCase()] = 0
        errors.push(
          new PropertyNotFoundError(param, 'TEMPERATURE_COEFFICIENTS')
        )
      }
    })
    return errors
  }

  /**
   * Compute the lateral force (F_y) generated by the tire.
   *
   * @param {number} slipAngleRadians - The slip angle (alpha, in radians) of the tire. This is often a function of steering angle.
   * @param {number} verticalLoadNewtons - The vertical load (F_z, in newtons) of the tire. This is often a function of vehicle weight.
   * @param {number} inclinationAngleRadians - The inclination angle (in radians) of the tire. This is often a function of camber.
   * @param {number} coefficientOfFriction - The coefficient of friction between the ground and the tire at the contact patch location.
   * @param {number} temperatureCelsius - The temperature of the tire.
   * @param {Array.<number>} target - An array of length 4 to which this function's outputs will be copied. The first element is the lateral force. The second is an Shf value to be used in calculating aligning moment. The third is the computed B parameter, and the fourth is the computed C parameter.
   */
  computeLateralForce(
    slipAngleRadians,
    verticalLoadNewtons,
    inclinationAngleRadians,
    coefficientOfFriction,
    // Unique to model
    temperatureCelsius,
    //
    target
  ) {
    const referenceCoefficientOfFriction = this.properties.get('MU0') || 0.8

    const scaledNominalVerticalLoad =
      this.verticalParameters.fNomin * this.scalingParameters.lfzo
    const deltaVerticalLoad =
      (verticalLoadNewtons - scaledNominalVerticalLoad) /
      scaledNominalVerticalLoad
    const C = this.lateralParameters.pcy1 * this.scalingParameters.lcy
    const mu =
      (this.lateralParameters.pdy1 +
        this.lateralParameters.pdy2 * deltaVerticalLoad) *
      (1.0 -
        this.lateralParameters.pdy3 * Math.pow(inclinationAngleRadians, 2)) *
      this.scalingParameters.lmuy
    const dBase =
      (mu * verticalLoadNewtons * coefficientOfFriction) /
      referenceCoefficientOfFriction
    // Unique to model
    const deltaTemperature =
      (temperatureCelsius - this.temperatureParameters.tref) /
      this.temperatureParameters.tref
    const D =
      (1 +
        this.temperatureParameters.ty3 * deltaTemperature +
        this.temperatureParameters.ty4 * Math.pow(deltaTemperature, 2)) *
      dBase
    //
    let E =
      (this.lateralParameters.pey1 +
        this.lateralParameters.pey2 * deltaVerticalLoad) *
      (1.0 -
        (this.lateralParameters.pey3 +
          this.lateralParameters.pey4 * inclinationAngleRadians) *
          Math.sign(slipAngleRadians)) *
      this.scalingParameters.ley
    if (E > 1.0) E = 1.0
    const temperatureScaler =
      1 + this.temperatureParameters.ty1 * deltaTemperature
    const BCD =
      // Unique to model
      temperatureScaler *
      //
      this.lateralParameters.pky1 *
      this.verticalParameters.fNomin *
      Math.sin(
        Math.atan(
          verticalLoadNewtons /
            (this.lateralParameters.pky2 *
              scaledNominalVerticalLoad *
              // Unique to model
              (1 + this.temperatureParameters.ty2 * deltaTemperature))
          //
        )
      ) *
      this.scalingParameters.lfzo *
      this.scalingParameters.lky

    const B = BCD / (C * D)

    const horizontalShift =
      (this.lateralParameters.phy1 +
        this.lateralParameters.phy2 * deltaVerticalLoad) *
      this.scalingParameters.lhy

    const verticalShift =
      verticalLoadNewtons *
      ((this.lateralParameters.pvy1 +
        this.lateralParameters.pvy2 * deltaVerticalLoad) *
        this.scalingParameters.lvy) *
      this.scalingParameters.lmuy

    const shiftedBAlpha = clamp(
      B * (slipAngleRadians + horizontalShift),
      -Math.PI / 2 + DEFAULT_EPSILON,
      Math.PI / 2 - DEFAULT_EPSILON
    )

    target[0] =
      D *
        Math.sin(
          C *
            Math.atan(
              shiftedBAlpha - E * (shiftedBAlpha - Math.atan(shiftedBAlpha))
            )
        ) +
      verticalShift
    target[1] = horizontalShift + verticalShift / BCD
    target[2] = B
    target[3] = C
  }

  /**
   * Compute the longitudinal force (F_x) generated by the tire.
   *
   * @param {number} slipRatio - The slip ratio of the tire. This is often a function of wheel spin (during acceleration) or longitudinal sliding (during braking).
   * @param {number} verticalLoadNewtons - The vertical load (F_z, in newtons) of the tire. This is often a function of vehicle weight.
   * @param {number} inclinationAngleRadians - The inclination angle (in radians) of the tire. This is often a function of camber.
   * @param {number} coefficientOfFriction - The coefficient of friction between the ground and the tire at the contact patch location.
   * @param {number} temperatureCelsius - The temperature of the tire.
   * @returns {number} The longitudinal force (F_x) in newtons generated by the tire.
   */
  computeLongitudinalForce(
    slipRatio,
    verticalLoadNewtons,
    inclinationAngleRadians,
    coefficientOfFriction,
    temperatureCelsius
  ) {
    const referenceCoefficientOfFriction = this.properties.get('MU0') || 0.8
    const scaledNominalVerticalLoad =
      this.verticalParameters.fNomin * this.scalingParameters.lfzo
    const deltaVerticalLoad =
      (verticalLoadNewtons - scaledNominalVerticalLoad) /
      scaledNominalVerticalLoad
    const C = this.longitudinalParameters.pcx1 * this.scalingParameters.lcx
    const mu =
      (this.longitudinalParameters.pdx1 +
        this.longitudinalParameters.pdx2 * deltaVerticalLoad) *
      (1.0 -
        this.longitudinalParameters.pdx3 *
          Math.pow(inclinationAngleRadians, 2)) *
      this.scalingParameters.lmux

    const deltaTemperature =
      (temperatureCelsius - this.temperatureParameters.tref) /
      this.temperatureParameters.tref
    // Unique to model
    const dBase =
      (mu * verticalLoadNewtons * coefficientOfFriction) /
      referenceCoefficientOfFriction
    const D =
      (1 +
        this.temperatureParameters.tx3 * deltaTemperature +
        this.temperatureParameters.tx4 * Math.pow(deltaTemperature, 2)) *
      dBase
    //
    let E =
      (this.longitudinalParameters.pex1 +
        this.longitudinalParameters.pex2 * deltaVerticalLoad +
        this.longitudinalParameters.pex3 * Math.pow(deltaVerticalLoad, 2)) *
      this.scalingParameters.lex
    if (E > 1.0) E = 1.0

    // Unique to model
    const kxBase =
      verticalLoadNewtons *
      (this.longitudinalParameters.pkx1 + this.longitudinalParameters.pkx2) *
      this.scalingParameters.lkx
    const BCD =
      (1 +
        this.temperatureParameters.tx1 * deltaTemperature +
        this.temperatureParameters.tx2 * Math.pow(deltaTemperature, 2)) *
      kxBase
    //
    const B = BCD / (C * D)
    const horizontalShift =
      (this.longitudinalParameters.phx1 +
        this.longitudinalParameters.phx2 * deltaVerticalLoad) *
      this.scalingParameters.lhx
    const verticalShift =
      verticalLoadNewtons *
      (this.longitudinalParameters.pvx1 +
        this.longitudinalParameters.pvx2 * deltaVerticalLoad) *
      this.scalingParameters.lvx *
      this.scalingParameters.lmux
    const shiftedBKappa = B * (slipRatio + horizontalShift)

    return (
      D *
        Math.sin(
          C *
            Math.atan(
              shiftedBKappa - E * (shiftedBKappa - Math.atan(shiftedBKappa))
            )
        ) +
      verticalShift
    )
  }
}

export { HarshAndShyrokau2019 }
