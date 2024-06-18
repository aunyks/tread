import { BaseTireModel } from './base.js'
import { clamp, DEFAULT_EPSILON, sineStep } from '../math.js'

const TIRE_SIDE = Object.freeze({
  LEFT: 'tire-side-left',
  RIGHT: 'tire-side-right',
})

const CALCULATION_MODE = Object.freeze({
  VERTICAL_FORCE_ONLY: 0,
  LONGITUDINAL_AND_VERTICAL_FORCES: 1,
  LATERAL_AND_VERTICAL_FORCES: 2,
  UNCOMBINED_FORCE: 3,
  COMBINED_FORCE: 4,
})

/**
 * An error that can be generated by Pacejka2002 models when they can't find an
 * expected tire property section from a Tire Properties File (.tir).
 */
class SectionNotFoundError extends Error {
  constructor(sectionName) {
    super(`Section "${sectionName}" not found`)
    this.name = 'SectionNotFoundError'
    this.sectionName = sectionName
  }

  /**
   *
   * @returns {string} the name of the section that was not found
   */
  getSectionName() {
    return this.sectionName
  }
}

/**
 * An error that can be generated by Pacejka2002 models when they can't find an
 * expected tire property from a Tire Properties File (.tir).
 */
class PropertyNotFoundError extends Error {
  constructor(propertyName, sectionName) {
    super(`Property "${propertyName}" not found in section "${sectionName}"`)
    this.name = 'PropertyNotFoundError'
    this.propertyName = propertyName
    this.sectionName = sectionName
  }

  /**
   *
   * @returns {string} the name of the property that was not found
   */
  getPropertyName() {
    return this.propertyName
  }

  /**
   * @returns {string} the name of the section in which the property was expected to be found
   */
  getSectionName() {
    return this.sectionName
  }
}

/**
 * The 2002 revision of the empirical model created by Hans B. Pacejka. See his book
 * "Tire and Vehicle Dynamics" for more information.
 */
class Pacejka2002 extends BaseTireModel {
  constructor({ tireProperties }) {
    super()
    if (!tireProperties) {
      throw new Error(
        `Required parameter "tireProperties" was falsey. Expected TireProperties object, received ${tireProperties}`
      )
    }
    this.unitScales = {
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
    }
    this.modelParameters = {
      measuredSide: TIRE_SIDE.LEFT,
      useFrictionEllipse: false,
      calculationMode: 0,
    }
    this.dimensionParameters = {
      unloadedTireRadius: 1.0,
      tireWidth: 0.0,
      aspectRatio: 0.0,
      rimRadius: 0.0,
      rimWidth: 0.0,
    }

    this.verticalParameters = {
      verticalStiffness: 0.0,
      verticalDamping: 0.0,
      // Nominal force pushing down on the tire from the rim
      fNomin: 0.0,
      // Variation in vertical stiffness with deflection (power of 1 / linear)
      qfz1: 0.0,
      // Variation in vertical stiffness with deflection (power of 2 / quadratic)
      qfz2: 0.0,
      // Variation in vertical stiffness with wheel inclination angle
      qfz3: 0.0,
      // Variation in vertical stiffness with tire pressure
      qpfz1: 0.0,
    }

    // See loadScaling() below
    this.scalingParameters = {}
    // See loadLongitudinal() below
    this.longitudinalParameters = {}
    // See loadOverturning() below
    this.overturningParameters = {}
    // See loadLateral() below
    this.lateralParameters = {}
    // See loadRolling() below
    this.rollingParameters = {}
    // See loadAligning() below
    this.aligningParameters = {}
    // See loadConditions() below
    this.conditionsParameters = {
      // Measured inflation pressure
      ip: 200_000.0,
      // Nominal inflation pressure
      ipNom: 200_000.0,
    }
    this.properties = tireProperties
  }

  initializeFromProperties() {
    const errors = []
    errors.push(...this.loadUnits())
    errors.push(...this.loadModel())
    errors.push(...this.loadDimension())
    errors.push(...this.loadVertical())
    errors.push(...this.loadScaling())
    errors.push(...this.loadLongitudinal())
    errors.push(...this.loadOverturning())
    errors.push(...this.loadLateral())
    errors.push(...this.loadRolling())
    errors.push(...this.loadAligning())
    errors.push(...this.loadConditions())

    this.verticalParameters.qfz1 =
      (this.verticalParameters.verticalStiffness *
        this.dimensionParameters.unloadedTireRadius) /
      this.verticalParameters.fNomin
    this.verticalParameters.qfz2 = 0
    const hasTireConditions =
      this.conditionsParameters.ip != 1.0 &&
      this.conditionsParameters.ipNom != 1.0
    if (!hasTireConditions) {
      const paramsToZero = [
        'PPX1',
        'PPX2',
        'PPX3',
        'PPX4',
        'PPY1',
        'PPY2',
        'PPY3',
        'PPY4',
        'QSY1',
        'QSY2',
        'QSY8',
        'QPFZ1',
      ]
      for (const paramToZero of paramsToZero) {
        if (this.longitudinalParameters[paramToZero.toLowerCase()]) {
          this.longitudinalParameters[paramToZero.toLowerCase()] = 0
        }
        if (this.lateralParameters[paramToZero.toLowerCase()]) {
          this.lateralParameters[paramToZero.toLowerCase()] = 0
        }
        if (this.rollingParameters[paramToZero.toLowerCase()]) {
          this.rollingParameters[paramToZero.toLowerCase()] = 0
        }
        if (this.verticalParameters[paramToZero.toLowerCase()]) {
          this.verticalParameters[paramToZero.toLowerCase()] = 0
        }
      }
    }
    return errors
  }

  loadUnits() {
    const errors = []
    const unitProperties = this.properties.get('UNITS')
    if (!unitProperties) {
      return [new SectionNotFoundError('UNITS')]
    }

    const lengthUnit = unitProperties.get('LENGTH')
    switch (lengthUnit?.toUpperCase()) {
      case 'MM':
        this.unitScales.lengthMeters = 0.001
        break
      case 'CM':
        this.unitScales.lengthMeters = 0.01
        break
      case 'KM':
        this.unitScales.lengthMeters = 1000.0
        break
      case 'MILE':
        this.unitScales.lengthMeters = 1609.35
        break
      case 'FOOT':
        this.unitScales.lengthMeters = 0.3048
        break
      case 'IN':
        this.unitScales.lengthMeters = 0.0254
        break
      case 'METER':
        this.unitScales.lengthMeters = 1
        break
      default:
        errors.push(
          new Error(
            `No length unit conversion found for length property ${lengthUnit}`
          )
        )
    }
    const timeUnit = unitProperties.get('TIME')
    switch (timeUnit?.toUpperCase()) {
      case 'MILLI':
        this.unitScales.timeSeconds = 0.001
        break
      case 'MIN':
        this.unitScales.timeSeconds = 60.0
        break
      case 'HOUR':
        this.unitScales.timeSeconds = 3600.0
        break
      case 'SEC':
      case 'SECOND':
        this.unitScales.timeSeconds = 1.0
        break
      default:
        errors.push(
          new Error(
            `No time unit conversion found for time property ${timeUnit}`
          )
        )
    }
    const angleUnit = unitProperties.get('ANGLE')
    switch (angleUnit?.toUpperCase()) {
      case 'DEG':
        this.unitScales.angleRadians = Math.PI / 180.0
        break
      case 'RAD':
      case 'RADIAN':
      case 'RADIANS':
        this.unitScales.angleRadians = 1.0
        break
      default:
        errors.push(
          new Error(
            `No angle unit conversion found for angle property ${angleUnit}`
          )
        )
    }
    const massUnit = unitProperties.get('MASS')
    switch (massUnit?.toUpperCase()) {
      case 'GRAM':
        this.unitScales.massKilograms = 0.001
        break
      case 'POUND_MASS':
        this.unitScales.massKilograms = 0.45359237
        break
      case 'KPOUND_MASS':
        this.unitScales.massKilograms = 0.45359237 / 1000.0
        break
      case 'SLUG':
        this.unitScales.massKilograms = 14.593902937
        break
      case 'OUNCE_MASS':
        this.unitScales.massKilograms = 0.0283495231
        break
      case 'KG':
      case 'KILOGRAM':
        this.unitScales.massKilograms = 1.0
        break
      default:
        errors.push(
          new Error(
            `No mass unit conversion found for mass property ${massUnit}`
          )
        )
    }
    const forceUnit = unitProperties.get('FORCE')
    switch (forceUnit?.toUpperCase()) {
      case 'POUND_FORCE':
        this.unitScales.forceNewtons = 4.4482216153
        break
      case 'KPOUND_FORCE':
        this.unitScales.forceNewtons = 4.4482216153 / 1000.0
        break
      case 'DYNE':
        this.unitScales.forceNewtons = 0.00001
        break
      case 'OUNCE_FORCE':
        this.unitScales.forceNewtons = 0.278013851
        break
      case 'KG_FORCE':
        this.unitScales.forceNewtons = 9.80665
        break
      case 'KN':
      case 'KNEWTON':
        this.unitScales.forceNewtons = 0.001
        break
      case 'N':
      case 'NEWTON':
        this.unitScales.forceNewtons = 1.0
        break
      default:
        errors.push(
          new Error(
            `No force unit conversion found for force property ${forceUnit}`
          )
        )
    }
    const pressureUnit = unitProperties.get('PRESSURE')
    switch (pressureUnit?.toUpperCase()) {
      case 'KSI':
        this.unitScales.pressurePascals = 6894757.2932
        break
      case 'PSI':
        this.unitScales.pressurePascals = 6894.7572932
        break
      case 'BAR':
        this.unitScales.pressurePascals = 1.0e5
        break
      case 'KPA':
      case 'KPASCAL':
        this.unitScales.pressurePascals = 1000.0
        break
      case 'PA':
      case 'PASCAL':
        this.unitScales.pressurePascals = 1.0
        break
      default:
        errors.push(
          new Error(
            `No pressure unit conversion found for pressure property ${pressureUnit}`
          )
        )
    }
    this.unitScales.speedMetersPerSecond =
      this.unitScales.lengthMeters / this.unitScales.timeSeconds
    this.unitScales.inertiaKilogramMetersSquared =
      this.unitScales.massKilograms *
      this.unitScales.lengthMeters *
      this.unitScales.lengthMeters
    this.unitScales.stiffnessNewtonsPerMeter =
      this.unitScales.forceNewtons / this.unitScales.lengthMeters
    this.unitScales.dampingNewtonsPerMetersPerSecond =
      this.unitScales.forceNewtons / this.unitScales.speedMetersPerSecond
    return errors
  }

  loadModel() {
    const errors = []
    const modelSection = this.properties.get('MODEL')
    if (!modelSection) {
      return [new SectionNotFoundError('MODEL')]
    }

    const propertyFileFormat = modelSection.get('PROPERTY_FILE_FORMAT')
    if (!['PAC2002', 'MF_05'].includes(propertyFileFormat?.toUpperCase())) {
      errors.push(
        new Error(
          `Acceptable tire property file format not found: Expected "PAC2002" or "MF_05", found ${propertyFileFormat}`
        )
      )
    }
    const measuredTireSide = modelSection.get('TYRESIDE')
    if (['UNKNOWN', 'LEFT'].includes(measuredTireSide?.toUpperCase())) {
      this.modelParameters.measuredSide = TIRE_SIDE.LEFT
    } else {
      this.modelParameters.measuredSide = TIRE_SIDE.RIGHT
    }

    const useFrictionEllipse = modelSection.get('FE_METHOD')
    if (useFrictionEllipse?.toUpperCase() === 'NO') {
      this.modelParameters.useFrictionEllipse = false
    } else {
      this.modelParameters.useFrictionEllipse = true
    }

    const calculationMode = modelSection.get('USE_MODE')
    switch (calculationMode) {
      case CALCULATION_MODE.COMBINED_FORCE:
        this.modelParameters.calculationMode = CALCULATION_MODE.COMBINED_FORCE
        break
      case CALCULATION_MODE.UNCOMBINED_FORCE:
        this.modelParameters.calculationMode = CALCULATION_MODE.UNCOMBINED_FORCE
        break
      case CALCULATION_MODE.LATERAL_AND_VERTICAL_FORCES:
        this.modelParameters.calculationMode =
          CALCULATION_MODE.LATERAL_AND_VERTICAL_FORCES
        break
      case CALCULATION_MODE.LONGITUDINAL_AND_VERTICAL_FORCES:
        this.modelParameters.calculationMode =
          CALCULATION_MODE.LONGITUDINAL_AND_VERTICAL_FORCES
        break
      case CALCULATION_MODE.VERTICAL_FORCE_ONLY:
      default:
        this.modelParameters.calculationMode =
          CALCULATION_MODE.VERTICAL_FORCE_ONLY
    }
    return errors
  }

  loadDimension() {
    const errors = []
    const dimensionSection = this.properties.get('DIMENSION')
    if (!dimensionSection) {
      return [new SectionNotFoundError('DIMENSION')]
    }

    const unloadedTireRadius = dimensionSection.get('UNLOADED_RADIUS')
    if (unloadedTireRadius) {
      this.dimensionParameters.unloadedTireRadius =
        this.unitScales.lengthMeters * unloadedTireRadius
    } else {
      this.dimensionParameters.unloadedTireRadius = 0
      errors.push(new PropertyNotFoundError('UNLOADED_RADIUS', 'DIMENSION'))
    }
    const tireWidth = dimensionSection.get('WIDTH')
    if (tireWidth) {
      this.dimensionParameters.tireWidth =
        this.unitScales.lengthMeters * tireWidth
    } else {
      this.dimensionParameters.tireWidth = 0
      errors.push(new PropertyNotFoundError('WIDTH', 'DIMENSION'))
    }
    const aspectRatio = dimensionSection.get('ASPECT_RATIO')
    if (tireWidth) {
      this.dimensionParameters.aspectRatio = aspectRatio
    } else {
      this.dimensionParameters.aspectRatio = 0
      errors.push(new PropertyNotFoundError('ASPECT_RATIO', 'DIMENSION'))
    }
    return errors
  }

  loadVertical() {
    const errors = []
    const verticalSection = this.properties.get('VERTICAL')
    if (!verticalSection) {
      return [new SectionNotFoundError('VERTICAL')]
    }

    const verticalStiffness = verticalSection.get('VERTICAL_STIFFNESS')
    if (verticalStiffness) {
      this.verticalParameters.verticalStiffness =
        this.unitScales.stiffnessNewtonsPerMeter * verticalStiffness
    } else {
      this.verticalParameters.verticalStiffness = 0
      errors.push(new PropertyNotFoundError('VERTICAL_STIFFNESS', 'VERTICAL'))
    }

    const verticalDamping = verticalSection.get('VERTICAL_DAMPING')
    if (verticalDamping) {
      this.verticalParameters.verticalDamping =
        this.unitScales.dampingNewtonsPerMetersPerSecond * verticalDamping
    } else {
      this.verticalParameters.verticalDamping = 0
      errors.push(new PropertyNotFoundError('VERTICAL_DAMPING', 'VERTICAL'))
    }

    const fNomin = verticalSection.get('FNOMIN')
    if (fNomin) {
      this.verticalParameters.fNomin = this.unitScales.forceNewtons * fNomin
    } else {
      this.verticalParameters.fNomin = 0
      errors.push(new PropertyNotFoundError('FNOMIN', 'VERTICAL'))
    }

    const qfz1 = verticalSection.get('QFZ1')
    if (qfz1) {
      this.verticalParameters.qfz1 = qfz1
    } else {
      this.verticalParameters.qfz1 = 0
      errors.push(new PropertyNotFoundError('QFZ1', 'VERTICAL'))
    }

    const qfz2 = verticalSection.get('QFZ2')
    if (qfz2) {
      this.verticalParameters.qfz2 = qfz2
    } else {
      this.verticalParameters.qfz2 = 0
      errors.push(new PropertyNotFoundError('QFZ2', 'VERTICAL'))
    }

    const qfz3 = verticalSection.get('QFZ3')
    if (qfz3) {
      this.verticalParameters.qfz3 = qfz3
    } else {
      this.verticalParameters.qfz3 = 0
      errors.push(new PropertyNotFoundError('QFZ3', 'VERTICAL'))
    }

    const qpfz1 = verticalSection.get('QPFZ1')
    if (qpfz1) {
      this.verticalParameters.qpfz1 = qpfz1
    } else {
      this.verticalParameters.qpfz1 = 0
      errors.push(new PropertyNotFoundError('QPFZ1', 'VERTICAL'))
    }
    return errors
  }

  loadScaling() {
    const errors = []
    const scalingSection = this.properties.get('SCALING_COEFFICIENTS')
    if (!scalingSection) {
      return [new SectionNotFoundError('SCALING_COEFFICIENTS')]
    }

    const parameters = [
      'LFZO',
      'LCX',
      'LMUX',
      'LEX',
      'LKX',
      'LHX',
      'LVX',
      'LGAX',
      'LCY',
      'LMUY',
      'LEY',
      'LKY',
      'LHY',
      'LVY',
      'LGAY',
      'LTR',
      'LRES',
      'LGAZ',
      'LXAL',
      'LYKA',
      'LVYKA',
      'LS',
      'LSGKP',
      'LSGAL',
      'LGYR',
      'LVMX',
      'LMX',
      'LMY',
      'LIP',
      'LKYG',
      'LCZ',
    ]

    parameters.forEach((param) => {
      const value = scalingSection.get(param)
      this.scalingParameters[param.toLowerCase()] = value ? value : 1.0
    })
    return errors
  }

  loadLongitudinal() {
    const errors = []
    const longitudinalSection = this.properties.get('LONGITUDINAL_COEFFICIENTS')
    if (!longitudinalSection) {
      return [new SectionNotFoundError('LONGITUDINAL_COEFFICIENTS')]
    }

    const parameters = [
      'PCX1',
      'PDX1',
      'PDX2',
      'PDX3',
      'PEX1',
      'PEX2',
      'PEX3',
      'PEX4',
      'PKX1',
      'PKX2',
      'PKX3',
      'PHX1',
      'PHX2',
      'PVX1',
      'PVX2',
      'RBX1',
      'RBX2',
      'RCX1',
      'REX1',
      'REX2',
      'RHX1',
      'PTX1',
      'PTX2',
      'PTX3',
      'PPX1',
      'PPX2',
      'PPX3',
      'PPX4',
    ]

    parameters.forEach((param) => {
      const value = longitudinalSection.get(param)
      if (value) {
        this.longitudinalParameters[param.toLowerCase()] = value
      } else {
        this.longitudinalParameters[param.toLowerCase()] = 0
        errors.push(
          new PropertyNotFoundError(param, 'LONGITUDINAL_COEFFICIENTS')
        )
      }
    })
    return errors
  }

  loadOverturning() {
    const errors = []
    const overturningSection = this.properties.get('OVERTURNING_COEFFICIENTS')
    if (!overturningSection) {
      return [new SectionNotFoundError('OVERTURNING_COEFFICIENTS')]
    }

    const parameters = [
      'QSX1',
      'QSX2',
      'QSX3',
      'QSX4',
      'QSX5',
      'QSX6',
      'QSX7',
      'QSX8',
      'QSX9',
      'QSX10',
      'QSX11',
      'QPX1',
    ]

    parameters.forEach((param) => {
      const value = overturningSection.get(param)
      if (value) {
        this.overturningParameters[param.toLowerCase()] = value
      } else {
        this.overturningParameters[param.toLowerCase()] = 0
        errors.push(
          new PropertyNotFoundError(param, 'OVERTURNING_COEFFICIENTS')
        )
      }
    })
    return errors
  }

  loadLateral() {
    const errors = []
    const lateralSection = this.properties.get('LATERAL_COEFFICIENTS')
    if (!lateralSection) {
      return [new SectionNotFoundError('LATERAL_COEFFICIENTS')]
    }

    const parameters = [
      'PCY1',
      'PDY1',
      'PDY2',
      'PDY3',
      'PEY1',
      'PEY2',
      'PEY3',
      'PEY4',
      'PKY1',
      'PKY2',
      'PKY3',
      'PHY1',
      'PHY2',
      'PHY3',
      'PVY1',
      'PVY2',
      'PVY3',
      'PVY4',
      'RBY1',
      'RBY2',
      'RBY3',
      'RCY1',
      'REY1',
      'REY2',
      'RHY1',
      'RHY2',
      'RVY1',
      'RVY2',
      'RVY3',
      'RVY4',
      'RVY5',
      'RVY6',
      'PTY1',
      'PTY2',
      'PPY1',
      'PPY2',
      'PPY3',
      'PPY4',
    ]

    parameters.forEach((param) => {
      const value = lateralSection.get(param)
      if (value) {
        this.lateralParameters[param.toLowerCase()] = value
      } else {
        this.lateralParameters[param.toLowerCase()] = 0
        errors.push(new PropertyNotFoundError(param, 'LATERAL_COEFFICIENTS'))
      }
    })
    return errors
  }

  loadRolling() {
    const errors = []
    const rollingSection = this.properties.get('ROLLING_COEFFICIENTS')
    if (!rollingSection) {
      return [new SectionNotFoundError('ROLLING_COEFFICIENTS')]
    }

    const parameters = [
      'QSY1',
      'QSY2',
      'QSY3',
      'QSY4',
      'QSY5',
      'QSY6',
      'QSY7',
      'QSY8',
    ]
    parameters.forEach((param) => {
      const value = rollingSection.get(param)
      if (value) {
        if (param === 'QSY1' && value < 0) {
          value = 0.01
        }
        this.rollingParameters[param.toLowerCase()] = value
      } else {
        this.rollingParameters[param.toLowerCase()] = 0
        errors.push(new PropertyNotFoundError(param, 'ROLLING_COEFFICIENTS'))
      }
    })
    return errors
  }

  loadAligning() {
    const errors = []
    const aligningSection = this.properties.get('ALIGNING_COEFFICIENTS')
    if (!aligningSection) {
      errors.push(new SectionNotFoundError('ALIGNING_COEFFICIENTS'))
    }

    const parameters = [
      'QBZ1',
      'QBZ2',
      'QBZ3',
      'QBZ4',
      'QBZ5',
      'QBZ9',
      'QBZ10',
      'QCZ1',
      'QDZ1',
      'QDZ2',
      'QDZ3',
      'QDZ4',
      'QDZ6',
      'QDZ7',
      'QDZ8',
      'QDZ9',
      'QEZ1',
      'QEZ2',
      'QEZ3',
      'QEZ4',
      'QEZ5',
      'QHZ1',
      'QHZ2',
      'QHZ3',
      'QHZ4',
      'QPZ1',
      'QPZ2',
      'SSZ1',
      'SSZ2',
      'SSZ3',
      'SSZ4',
      'QTZ1',
      'QPZ1',
      'QPZ2',
      'MBELT',
    ]
    parameters.forEach((param) => {
      const value = aligningSection.get(param)
      if (value) {
        this.aligningParameters[param.toLowerCase()] = value
      } else {
        this.aligningParameters[param.toLowerCase()] = 0
        errors.push(new PropertyNotFoundError(param, 'ALIGNING_COEFFICIENTS'))
      }
    })
    return errors
  }

  loadConditions() {
    const errors = []
    const conditionsSection = this.properties.get('TIRE_CONDITIONS')
    if (!conditionsSection) {
      return [new SectionNotFoundError('TIRE_CONDITIONS')]
    }

    const ip = conditionsSection.get('IP')
    if (ip) {
      this.conditionsParameters.ip = this.unitScales.pressurePascals * ip
    } else {
      this.conditionsParameters.ip = 200000
      errors.push(new PropertyNotFoundError('IP', 'TIRE_CONDITIONS'))
    }

    const ipNom = conditionsSection.get('IP_NOM')
    if (ipNom) {
      this.conditionsParameters.ipNom = this.unitScales.pressurePascals * ipNom
    } else {
      this.conditionsParameters.ipNom = 200000
      errors.push(new PropertyNotFoundError('IP_NOM', 'TIRE_CONDITIONS'))
    }
    return errors
  }

  /**
   * Compute the lateral force (F_y) generated by the tire.
   *
   * @param {number} slipAngleRadians - The slip angle (alpha, in radians) of the tire. This is often a function of steering angle.
   * @param {number} verticalLoadNewtons - The vertical load (F_z, in newtons) of the tire. This is often a function of vehicle weight.
   * @param {number} inclinationAngleRadians - The inclination angle (in radians) of the tire. This is often a function of camber.
   * @param {number} coefficientOfFriction - The coefficient of friction between the ground and the tire at the contact patch location.
   * @param {Array.<number>} target - An array of length 4 to which this function's outputs will be copied. The first element is the lateral force. The second is an Shf value to be used in calculating aligning moment. The third is the computed B parameter, and the fourth is the computed C parameter.
   */
  computeLateralForce(
    slipAngleRadians,
    verticalLoadNewtons,
    inclinationAngleRadians,
    coefficientOfFriction,
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
    const D =
      (mu * verticalLoadNewtons * coefficientOfFriction) /
      referenceCoefficientOfFriction
    let E =
      (this.lateralParameters.pey1 +
        this.lateralParameters.pey2 * deltaVerticalLoad) *
      (1.0 -
        (this.lateralParameters.pey3 +
          this.lateralParameters.pey4 * inclinationAngleRadians) *
          Math.sign(slipAngleRadians)) *
      this.scalingParameters.ley
    if (E > 1.0) E = 1.0
    const BCD =
      this.lateralParameters.pky1 *
      this.verticalParameters.fNomin *
      Math.sin(
        2.0 *
          Math.atan(
            verticalLoadNewtons /
              (this.lateralParameters.pky2 * scaledNominalVerticalLoad)
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
   * @returns {number} The longitudinal force (F_x) in newtons generated by the tire.
   */
  computeLongitudinalForce(
    slipRatio,
    verticalLoadNewtons,
    inclinationAngleRadians,
    coefficientOfFriction
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

    const D =
      (mu * verticalLoadNewtons * coefficientOfFriction) /
      referenceCoefficientOfFriction
    let E =
      (this.longitudinalParameters.pex1 +
        this.longitudinalParameters.pex2 * deltaVerticalLoad +
        this.longitudinalParameters.pex3 * Math.pow(deltaVerticalLoad, 2)) *
      this.scalingParameters.lex
    if (E > 1.0) E = 1.0
    const BCD =
      verticalLoadNewtons *
      (this.longitudinalParameters.pkx1 + this.longitudinalParameters.pkx2) *
      this.scalingParameters.lkx
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

  /**
   * Compute the overturning moment (M_x) generated by the tire.
   *
   * @param {number} lateralForceNewtons - The lateral force (F_y, in newtons) generated by the tire.
   * @param {number} verticalLoadNewtons - The vertical load (F_z, in newtons) of the tire. This is often a function of vehicle weight.
   * @param {number} inclinationAngleRadians - The inclination angle (in radians) of the tire. This is often a function of camber.
   * @returns {number} The overturning moment (M_x) generated by the tire.
   */
  computeOverturningMoment(
    lateralForceNewtons,
    verticalLoadNewtons,
    inclinationAngleRadians
  ) {
    const r0 = this.properties.get('R0') || 1.0
    return (
      r0 *
        verticalLoadNewtons *
        this.overturningParameters.qsx1 *
        this.scalingParameters.lvx -
      this.overturningParameters.qsx2 * inclinationAngleRadians +
      (this.overturningParameters.qsx3 * lateralForceNewtons) /
        this.verticalParameters.fNomin +
      this.overturningParameters.qsx4 *
        Math.cos(
          this.overturningParameters.qsx5 *
            Math.pow(
              Math.atan(
                (this.overturningParameters.qsx6 * verticalLoadNewtons) /
                  this.verticalParameters.fNomin
              ),
              2
            )
        ) *
        Math.sin(
          this.overturningParameters.qsx7 * inclinationAngleRadians +
            this.overturningParameters.qsx8 *
              Math.atan(
                (this.overturningParameters.qsx9 * lateralForceNewtons) /
                  this.verticalParameters.fNomin
              )
        ) +
      this.overturningParameters.qsx10 *
        Math.atan(
          (this.overturningParameters.qsx11 * verticalLoadNewtons) /
            this.verticalParameters.fNomin
        ) *
        inclinationAngleRadians
    )
  }

  /**
   * Compute the rolling resistance moment (M_y) generated by the tire.
   *
   * @param {number} longitudinalForceNewtons - The longitudinal force (F_x, in newtons) generated by the tire.
   * @param {number} verticalLoadNewtons - The vertical load (F_z, in newtons) of the tire. This is often a function of vehicle weight.
   * @param {number} inclinationAngleRadians - The inclination angle (in radians) of the tire. This is often a function of camber.
   * @returns {number} The rolling resistance moment (M_y) generated by the tire.
   */
  computeRollingResistanceMoment(
    longitudinalForceNewtons,
    verticalLoadNewtons,
    inclinationAngleRadians
  ) {
    const r0 = this.properties.get('R0') || 1.0
    // This is a simplification
    const vx = 1.0
    const v0 = Math.sqrt(9.81 * r0)
    const vStar = Math.abs(vx / v0)
    return (
      sineStep(Math.abs(vx), 0.5, 0, 1.0, 1.0) *
      Math.sign(vx) *
      verticalLoadNewtons *
      r0 *
      (this.rollingParameters.qsy1 +
        (this.rollingParameters.qsy2 * longitudinalForceNewtons) /
          this.verticalParameters.fNomin +
        this.rollingParameters.qsy3 * vStar +
        this.rollingParameters.qsy4 * Math.pow(vStar, 4) +
        (this.rollingParameters.qsy5 +
          (this.rollingParameters.qsy6 * verticalLoadNewtons) /
            this.verticalParameters.fNomin) *
          Math.pow(inclinationAngleRadians, 2)) *
      Math.pow(
        verticalLoadNewtons / this.verticalParameters.fNomin,
        this.rollingParameters.qsy7
      )
    )
  }

  /**
   * Compute the aligning moment (M_z) generated by the tire.
   *
   * @param {number} slipAngleRadians - The slip angle (alpha, in radians) of the tire. This is often a function of steering angle.
   * @param {number} verticalLoadNewtons - The vertical load (F_z, in newtons) of the tire. This is often a function of vehicle weight.
   * @param {number} inclinationAngleRadians - The inclination angle (in radians) of the tire. This is often a function of camber.
   * @param {number} lateralForceNewtons - The lateral force (F_y) in newtons generated by the tire.
   * @param {number} sHf_F_y - A value retrieved from computeLateralForce().
   * @param {number} B_F_y - A value retrieved from computeLateralForce().
   * @param {number} C_F_y - A value retrieved from computeLateralForce().
   * @returns {number} The aligning moment (M_z) generated by the tire.
   */
  computeAligningMoment(
    slipAngleRadians,
    verticalLoadNewtons,
    inclinationAngleRadians,
    lateralForceNewtons,
    sHf_F_y,
    B_F_y,
    C_F_y
  ) {
    const r0 = this.properties.get('R0') || 1.0
    const scaledNominalVerticalLoad =
      this.verticalParameters.fNomin * this.scalingParameters.lfzo
    const deltaVerticalLoad =
      (verticalLoadNewtons - scaledNominalVerticalLoad) /
      scaledNominalVerticalLoad
    const C = this.aligningParameters.qcz1
    const scaledInclinationAngle =
      inclinationAngleRadians * this.scalingParameters.lgaz
    const horizontalShift =
      this.aligningParameters.qhz1 +
      this.aligningParameters.qhz2 * deltaVerticalLoad +
      (this.aligningParameters.qhz3 +
        this.aligningParameters.qhz4 * deltaVerticalLoad) *
        scaledInclinationAngle
    const horizShiftedSlipAngle = slipAngleRadians + horizontalShift
    const B =
      (((this.aligningParameters.qbz1 +
        this.aligningParameters.qbz2 * deltaVerticalLoad +
        this.aligningParameters.qbz3 * Math.pow(deltaVerticalLoad, 2)) *
        (1.0 +
          this.aligningParameters.qbz4 * scaledInclinationAngle +
          this.aligningParameters.qbz5 * Math.abs(scaledInclinationAngle)) *
        r0) /
        scaledNominalVerticalLoad) *
      this.scalingParameters.ltr
    const D =
      ((verticalLoadNewtons *
        (this.aligningParameters.qdz1 +
          this.aligningParameters.qdz2 * deltaVerticalLoad) *
        (1.0 +
          this.aligningParameters.qdz3 * scaledInclinationAngle +
          this.aligningParameters.qdz4 * Math.pow(scaledInclinationAngle, 2)) *
        r0) /
        scaledNominalVerticalLoad) *
      this.scalingParameters.ltr
    const E =
      (this.aligningParameters.qez1 +
        this.aligningParameters.qez2 * deltaVerticalLoad +
        this.aligningParameters.qez3 * Math.pow(deltaVerticalLoad, 2)) *
      (1.0 +
        ((this.aligningParameters.qez4 +
          this.aligningParameters.qez5 * scaledInclinationAngle) *
          Math.atan(B * C * horizShiftedSlipAngle)) /
          (Math.PI / 2))
    const scaledBAlpha = B * horizShiftedSlipAngle
    const t =
      D *
      Math.cos(
        C *
          Math.atan(
            B * scaledBAlpha -
              E * (B * scaledBAlpha - Math.atan(B * scaledBAlpha))
          )
      ) *
      Math.cos(slipAngleRadians)
    return (
      -t * lateralForceNewtons +
      this.computeMRes(
        slipAngleRadians,
        verticalLoadNewtons,
        inclinationAngleRadians,
        r0,
        sHf_F_y,
        B_F_y,
        C_F_y
      )
    )
  }

  /**
   * @param {number} slipAngleRadians - The slip angle (alpha, in radians) of the tire. This is often a function of steering angle.
   * @param {number} verticalLoadNewtons - The vertical load (F_z, in newtons) of the tire. This is often a function of vehicle weight.
   * @param {number} inclinationAngleRadians - The inclination angle (in radians) of the tire. This is often a function of camber.
   * @param {number} r0 - A value retrieved from computeAligningMoment().
   * @param {number} sHf_F_y - A value retrieved from computeLateralForce().
   * @param {number} B_F_y - A value retrieved from computeLateralForce().
   * @param {number} C_F_y - A value retrieved from computeLateralForce().
   * @returns {number}
   */
  computeMRes(
    slipAngleRadians,
    verticalLoadNewtons,
    inclinationAngleRadians,
    r0,
    sHf_F_y,
    B_F_y,
    C_F_y
  ) {
    const scaledNominalVerticalLoad =
      this.verticalParameters.fNomin * this.scalingParameters.lfzo
    const deltaVerticalLoad =
      (verticalLoadNewtons - scaledNominalVerticalLoad) /
      scaledNominalVerticalLoad
    const shiftedSlipAngle = slipAngleRadians + sHf_F_y
    const scaledInclinationAngle =
      inclinationAngleRadians * this.scalingParameters.lgaz
    const C = 1.0
    const B =
      (this.aligningParameters.qbz9 * this.scalingParameters.lky) /
        this.scalingParameters.lmuy +
      this.aligningParameters.qbz10 * B_F_y * C_F_y
    const D =
      verticalLoadNewtons *
      ((this.aligningParameters.qdz6 +
        this.aligningParameters.qdz7 * deltaVerticalLoad) *
        this.scalingParameters.ltr +
        (this.aligningParameters.qdz8 +
          this.aligningParameters.qdz9 * deltaVerticalLoad) *
          scaledInclinationAngle) *
      r0 *
      this.scalingParameters.lmuy
    return (
      D *
      Math.cos(C * Math.atan(B * shiftedSlipAngle)) *
      Math.cos(slipAngleRadians)
    )
  }
}

export { Pacejka2002, PropertyNotFoundError, SectionNotFoundError }