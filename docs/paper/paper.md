---
title: 'TreadJS: A JavaScript library for modeling and realtime simulation of automotive tires'
tags:
  - vehicle dynamics
  - automotive
  - simulation
  - tire
  - JavaScript
authors:
  - name: Gerald Nash
    orcid: 0000-0002-1046-5763
date: 13 August 2017
bibliography: paper.bib
---

# Summary

TreadJS is an open source JavaScript library designed for modeling and real-time simulation of automotive tires. It provides a flexible and extensible framework for implementing various tire models, enabling researchers, engineers, and developers to simulate and analyze tire behavior in diverse scenarios. TreadJS is intended for use in both academic research and practical applications, such as vehicle dynamics simulations, gaming, and virtual prototyping. By leveraging JavaScript, TreadJS facilitates easy integration with web-based platforms and interactive applications, offering a versatile and accessible tool for professionals working in the field of automotive simulation.


# Statement of Need

The simulation of automotive tire dynamics is a critical component in vehicle dynamics research and development, with applications ranging from academic studies to practical implementations in gaming and virtual prototyping. While several tools exist for this purpose, they often face limitations in terms of accessibility, extensibility, and integration with modern web-based platforms.

Proprietary solutions, such as Siemens' Simcenter Tire MF-Swift [@siemens2023tire], offer comprehensive functionality but are closed-source and may be cost-prohibitive, especially for academic researchers or independent developers. Conversely, open source alternatives like Chrono::Vehicle [@serban2019chrono], while powerful, are primarily designed for desktop applications written in C++ , hindering their seamless integration with web-based or sandboxed environments.

TreadJS addresses this gap by offering an open source JavaScript library specifically tailored for modeling and real-time simulation of automotive tires. By leveraging the ubiquity and versatility of JavaScript, TreadJS enables the creation of highly configurable automotive simulators that can run natively in web browsers or be easily integrated into interactive web applications. This accessibility is particularly valuable for academic researchers seeking to investigate driver behavior without requiring the driver to install additional, non-browser-based software.

# Functionality

TreadJS includes modules for both parsing an industry standard tire model file format and utilizing various tire models. Each of these modules can be directly imported into JavaScript projects, allowing researchers and developers fine-grained control of the amount of code that's loaded by their projects. TreadJS ultimately serves as an extensible platform for further tire model research and development.

## Tire Model File Parser Module

A key component of TreadJS' functionality is its ability to parse Tyre Property Files (*.tir file extension), which are commonly used to initialize empirical tire models. An example of this is as follows:

```javascript
import { TireProperties } from '@hivoltagexyz/tread'

// Get Tyre Properties File contents
const tirFileContents = `
[UNITS]
LENGTH                     = 'meter'
FORCE                      = 'newton'
ANGLE                      = 'radian'
MASS                       = 'kg'
TIME                       = 'second'
PRESSURE                   = 'pascal'

[MODEL]
PROPERTY_FILE_FORMAT       = 'PAC2002'
USE_MODE                   = 4
LONGVL                     = 16.7
VXLOW                      = 1
TYRESIDE                   = 'LEFT'
BELT_DYNAMICS              = 'NO'
CONTACT_MODEL              = 'DEFAULT'
FE_METHOD                  = 'NO'
LOCAL_SOLVER               = 'NO'
LOCAL_SOLVER_HP            = 'NO'

[TIRE_CONDITIONS]
IP                         = 800000
IP_NOM                     = 800000
`

// Create the properties object and
// initialize it from the .tir file contents
const properties = new TireProperties()
properties.fromTirFile(tirFileContents)

// Retrieve all properties corresponding
// to a section
const tireConditions = properties.get('TIRE_CONDITIONS')
// Retrieve a specific property in a section
const nominalInflationPressure = tireConditions.get('IP_NOM')
```

## Tire Models

The library also provides a set of existing empirical models. These include the "Magic Formula" model by @pacejka2012tire and an extension of the Magic Formula model that incorporates temperature effects on tire force capabilities by @harsh2019tire. An example use of the Magic Formula model is as follows:

```javascript
import { Pacejka2002, TireProperties } from '@hivoltagexyz/tread'

// Load tire properties
const properties = new TireProperties()
properties.fromTirFile(
  await Deno.readTextFileSync('./racing-tire.tir'),
)

// Create and initialize a magic formula model
const pac2002Model = new Pacejka2002({
  tireProperties: properties,
})
// Decide to handle or ignore any errors that arise during initialization
const initErrors = pac2002Model.initializeFromProperties()

// Set model inputs
const slipAngle = Math.PI / 6
const slipRatio = 0.25

// Get model outputs
const latForceOutputVector = [0, 0, 0, 0]
pac2002Model.computeLateralForce(
  slipAngle,
  pac2002Model.verticalParameters.fNomin,
  0,
  1.0,
  latForceOutputVector,
)
const lateralForce = latForceOutputVector[0]

const longitudinalForce = pac2002Model.computeLongitudinalForce(
  slipRatio,
  pac2002Model.verticalParameters.fNomin,
  0,
  1.0,
)
```

# Acknowledgements

This open source research software project received no financial support.

# References