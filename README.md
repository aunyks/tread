# TreadJS

A JavaScript library for modeling and realtime simulation of automotive tires.

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

## Supported Models

- Pacejka 2002
  ([10.1016/C2010-0-68548-8](https://doi.org/10.1016/C2010-0-68548-8))
- Harsh and Shyrokau 2019
  ([10.3390/app9245328](https://doi.org/10.3390/app9245328))

## Installation

Tread runs everywhere standard Web APIs are present. Install it for local use
with any JavaScript runtime, or use it in the browser.

### Browser

```javascript
import * as Tread from 'https://jsr.io/@hivoltagexyz/tread/2024.6.2/src/mod.js'
```

### Deno

```shell
deno add @hivoltagexyz/tread
```

### Node.js

```shell
npx jsr add @hivoltagexyz/tread
```

### Bun

```shell
bunx jsr add @hivoltagexyz/tread
```

### Cloudflare Workers

```shell
npx jsr add @hivoltagexyz/tread
```

## Demos and Examples

See `examples/` for a growing list of example use cases for this library.

## Documentation

See [jsr.io/@hivoltagexyz/tread/doc](https://jsr.io/@hivoltagexyz/tread/doc) for this library's documentation.

## Versioning

This project employs a [Calendar Versioning](https://calver.org/) scheme
following the form `YYYY.MM.PATCH`. Patch level releases will NOT contain known
breaking changes. Releases that contain breaking changes will change the date
component (`YYYY.MM`) of the library's version.

## Contributing

Contributions to Tread are welcome. Please view the project's contribution
guidelines in `docs/contributing.md`.

## Legal

Copyright 2024 Gerald Nash

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors
   may be used to endorse or promote products derived from this software without
   specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

### Third Party Notices

Third party notices can be found in this repository's `THIRD_PARTY_NOTICES`
file.
