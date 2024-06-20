class TirLoadError extends Error {
  constructor(message) {
    super(message)
    this.name = this.constructor.name
  }
}

class TirSyntaxError extends TirLoadError {}
class ModelLoadingError extends TirLoadError {}

export { ModelLoadingError, TirLoadError, TirSyntaxError }
