// червоний → жовтий → зелений (кольори теми: --reset, --grace, --done)
const C_RED = [240, 82, 90], C_YEL = [245, 197, 66], C_GRN = [61, 220, 132]

export function progressColor(p: number) {
  const t = Math.max(0, Math.min(1, p))
  const [a, b, k] = t < 0.5 ? [C_RED, C_YEL, t / 0.5] : [C_YEL, C_GRN, (t - 0.5) / 0.5]
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',')})`
}

/** Колір оцінки дня 1..5: 1 — червоний, 3 — жовтий, 5 — зелений */
export const moodColor = (v: number) => progressColor((v - 1) / 4)
