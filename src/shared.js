class TreadTechError extends Error {
  constructor(message) {
    super(message)
    this.name = this.constructor.name
  }
}

class TirSyntaxError extends TreadTechError {}
class ModelLoadingError extends TreadTechError {}

export { ModelLoadingError, TirSyntaxError, TreadTechError }
