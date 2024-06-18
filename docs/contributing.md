Contributions to Tread should come in the form of pull requests to
[its GitHub repository](https://github.com/aunyks/tread).

## Required tools

- [Deno](https://deno.com/): Used for formatting, linting, and testing.

## Dependency management

Tread vendors its dependencies. If you'd like to add a dependency, please ensure
that it can be imported from directly within the Tread repository without
requiring a build step.

Before you consider using a dependency, ensure that its license is compatible
with Tread's license.

## Before submitting changes

Before submitting your work, please run the following commands to ensure your
code follows Tread's current style and linting guidelines.

Formatting:

```shell
deno task fmt
```

Linting:

```shell
deno task lint
```

Test your changes as much as is reasonable, and ensure that your changes don't
cause the existing test suite to fail.

```shell
deno task test
```
