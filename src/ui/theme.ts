// 5 тем за часом доби: ранок, день, обід, вечір, ніч.
// Ранок і вечір прив'язані до реального сходу й заходу сонця (рахується на телефоні щодня).
import { KYIV, sunTimes } from './sun'

export type Theme = 'morning' | 'day' | 'noon' | 'evening' | 'night'
export type ThemeMode = 'auto' | Theme
export interface Place { lat: number; lon: number; name: string }

export const THEME_NAMES: [ThemeMode, string][] = [['auto', 'Авто'], ['morning', 'Ранок'], ['day', 'День'], ['noon', 'Обід'], ['evening', 'Вечір'], ['night', 'Ніч']]

const H = 3600000
/** Межі режимів на конкретну дату:
 *  ранок — від 1 год до сходу до 3 год після; день — до 13:00; обід — до 1 год до заходу;
 *  вечір — від 1 год до заходу до 1,5 год після; далі ніч. */
export function themeBounds(date: Date, place: Place = KYIV) {
  const { sunrise, sunset } = sunTimes(date, place.lat, place.lon)
  const at13 = new Date(date); at13.setHours(13, 0, 0, 0)
  const morningFrom = sunrise.getTime() - H
  const dayFrom = sunrise.getTime() + 3 * H
  const eveningFrom = sunset.getTime() - H
  const nightFrom = sunset.getTime() + 1.5 * H
  const noonFrom = Math.min(Math.max(at13.getTime(), dayFrom), eveningFrom)
  return { sunrise, sunset, morningFrom, dayFrom: Math.min(dayFrom, noonFrom), noonFrom, eveningFrom, nightFrom }
}

export function autoTheme(date: Date, place?: Place): Theme {
  const t = date.getTime()
  const b = themeBounds(date, place)
  if (t < b.morningFrom || t >= b.nightFrom) return 'night'
  if (t < b.dayFrom) return 'morning'
  if (t < b.noonFrom) return 'day'
  if (t < b.eveningFrom) return 'noon'
  return 'evening'
}

export function applyTheme(mode: ThemeMode | string = 'auto', date = new Date(), place?: Place) {
  const valid = THEME_NAMES.some(([k]) => k === mode)
  const t = !valid || mode === 'auto' ? autoTheme(date, place) : (mode as Theme)
  const root = document.documentElement
  if (root.dataset.theme !== t) {
    root.dataset.theme = t
    const bar = getComputedStyle(root).getPropertyValue('--bar').trim()
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bar || '#0E0F12')
  }
}
