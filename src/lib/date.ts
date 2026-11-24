// Ключ дня: 'YYYY-MM-DD'. День починається о dayStartHour (за замовч. 04:00).

const pad = (n: number) => String(n).padStart(2, '0')

export function fmtKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function dayKey(ts: number | Date, startHour = 4): string {
  const d = new Date(typeof ts === 'number' ? ts : ts.getTime())
  d.setHours(d.getHours() - startHour)
  return fmtKey(d)
}

export function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0) // полудень — без проблем з переходом на літній час
}

export function addDays(key: string, n: number): string {
  const d = parseKey(key)
  d.setDate(d.getDate() + n)
  return fmtKey(d)
}

/** 0 = понеділок … 6 = неділя */
export function weekday(key: string): number {
  return (parseKey(key).getDay() + 6) % 7
}

export function weekStart(key: string): string {
  return addDays(key, -weekday(key))
}

export function diffDays(a: string, b: string): number {
  return Math.round((parseKey(a).getTime() - parseKey(b).getTime()) / 86400000)
}

export function cmpKey(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

const MONTHS_GEN = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня']
const MONTHS_NOM = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень']
const WEEKDAYS = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', 'Пʼятниця', 'Субота', 'Неділя']
export const WD_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']

export function humanDate(key: string, withWeekday = true): string {
  const d = parseKey(key)
  const s = `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`
  return withWeekday ? `${WEEKDAYS[weekday(key)]}, ${s}` : s
}

export function monthTitle(year: number, month: number): string {
  return `${MONTHS_NOM[month]} ${year}`
}

export function monthGen(month: number): string {
  return MONTHS_GEN[month]
}

/** Українська множина: plural(5, ['день','дні','днів']) */
export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return forms[2]
  if (b > 1 && b < 5) return forms[1]
  if (b === 1) return forms[0]
  return forms[2]
}

export const DAYS: [string, string, string] = ['день', 'дні', 'днів']

export function fmtDuration(sec: number): string {
  sec = Math.max(0, Math.round(sec))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}
