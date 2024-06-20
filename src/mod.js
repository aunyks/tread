/**
 *
A JavaScript library for modeling and realtime simulation of automotive tires.

## Supported Models

- Pacejka 2002 ([10.1016/C2010-0-68548-8](https://doi.org/10.1016/C2010-0-68548-8))
- Harsh and Shyrokau 2019 ([10.3390/app9245328](https://doi.org/10.3390/app9245328))

## Example

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

// Set our model inputs
const slipAngle = Math.PI / 6
const slipRatio = 0.25

// Get our model outputs
const latForceOutputVector = [0, 0, 0, 0]
pac2002Model.computeLateralForce(
  angleRad,
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

## Documentation

See [jsr.io/@hivoltagexyz/tread/doc](https://jsr.io/@hivoltagexyz/tread/doc) for this library's documentation.

## Versioning

This project employs a [Calendar Versioning](https://calver.org/) scheme
following the form `YYYY.MM.PATCH`. Patch level releases will NOT contain known
breaking changes. Releases that contain breaking changes will change the date
component (`YYYY.MM`) of the library's version.

@module
 */

export * from './parsers/mod.js'
export * from './tire-models/mod.js'
export * from './math.js'
export * from './tire-properties.js'
export * from './shared.js'
