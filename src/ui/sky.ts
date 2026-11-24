// Фон за часом доби: ранній ранок, ранок, день, обід, вечір, ніч.
// Між опорними точками кольори плавно переходять.
type RGB = [number, number, number]
const hex = (h: string): RGB => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) as RGB

export const PERIODS: { name: string; from: number }[] = [
  { name: 'ніч', from: 0 },
  { name: 'ранній ранок', from: 4 },
  { name: 'ранок', from: 7 },
  { name: 'день', from: 11 },
  { name: 'обід', from: 13 },
  { name: 'вечір', from: 17 },
  { name: 'ніч', from: 22 },
]

// [година, верхнє сяйво, нижнє сяйво]
const KEYS: [number, string, string][] = [
  [0, '#1E2F7A', '#0E1440'],   // ніч — глибокий синій
  [3.5, '#1E2F7A', '#0E1440'],
  [5.5, '#6A3E9E', '#D0667E'], // ранній ранок — світанок, фіолет і рожевий
  [8.5, '#FF8E45', '#FFC66B'], // ранок — теплий помаранчевий
  [12, '#3E9FE6', '#6CD6F0'],  // день — небесно-блакитний
  [14.5, '#F2B43A', '#78C98F'],// обід — золотистий
  [19, '#E5552F', '#7A3AA6'],  // вечір — захід, помаранч і фіолет
  [22.5, '#1E2F7A', '#0E1440'],// ніч
  [24, '#1E2F7A', '#0E1440'],
]

function mix(a: RGB, b: RGB, t: number): RGB {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t)) as RGB
}

export function skyAt(date: Date) {
  const h = date.getHours() + date.getMinutes() / 60
  let i = KEYS.findIndex(k => k[0] > h) - 1
  if (i < 0) i = KEYS.length - 2
  const [h0, a0, b0] = KEYS[i], [h1, a1, b1] = KEYS[i + 1]
  const t = h1 === h0 ? 0 : (h - h0) / (h1 - h0)
  const top = mix(hex(a0), hex(a1), t), bottom = mix(hex(b0), hex(b1), t)
  const period = [...PERIODS].reverse().find(p => h >= p.from)!.name
  return { top, bottom, period }
}

export function applySky(date = new Date()) {
  const { top, bottom, period } = skyAt(date)
  const r = document.documentElement.style
  r.setProperty('--sky-top', `rgb(${top.join(',')})`)
  r.setProperty('--sky-bottom', `rgb(${bottom.join(',')})`)
  document.documentElement.dataset.period = period
  // рядок стану телефона — у тон фону (на 30% від сяйва поверх темного)
  const bg: RGB = [14, 15, 18]
  const bar = mix(bg, top, 0.3)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', `rgb(${bar.join(',')})`)
}
