const DEFAULT_EPSILON = 0.001

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
    (dy / CH_C_2PI) * Math.Sin((CH_C_2PI * (x - x1)) / dx)
  )
}

export { clamp, DEFAULT_EPSILON, sineStep }
