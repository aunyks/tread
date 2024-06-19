/**
 * The default margin of error used during miscellaneous calculations.
 */
const DEFAULT_EPSILON = 0.001

/**
 * Returns a value clamped between a minimum and maximum value. If `n` is less than the minimum, the function will return the minimum. If `n` is greater than the maximum, the function will return the maximum. If `n` is both less than the maximum and greater than the minimum, the function will return `n`.
 *
 * @param {number} n - The number to clamp.
 * @param {number} min - The minimum clamp value.
 * @param {number} max - The maximum clamp value.
 * @returns {number} - The clamped value.
 */
function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max)
}

function sineStep(x, x1, y1, x2, y2) {
  if (x <= x1) return y1
  if (x >= x2) return y2
  const dx = x2 - x1
  const dy = y2 - y1
  return (
    y1 +
    (dy * (x - x1)) / dx -
    (dy / CH_C_2PI) * Math.sin((CH_C_2PI * (x - x1)) / dx)
  )
}

export { clamp, DEFAULT_EPSILON, sineStep }
