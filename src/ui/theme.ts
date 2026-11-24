// 5 тем за часом доби, як у прогнозах погоди: ранок, день, обід, вечір, ніч.
export type Theme = 'morning' | 'day' | 'noon' | 'evening' | 'night'
export type ThemeMode = 'auto' | Theme

export const THEME_NAMES: [ThemeMode, string][] = [['auto', 'Авто'], ['morning', 'Ранок'], ['day', 'День'], ['noon', 'Обід'], ['evening', 'Вечір'], ['night', 'Ніч']]

/** Межі для «Авто»: ранок 04–10, день 10–13, обід 13–17, вечір 17–21, ніч 21–04 */
export function autoTheme(date: Date): Theme {
  const h = date.getHours()
  if (h >= 4 && h < 10) return 'morning'
  if (h >= 10 && h < 13) return 'day'
  if (h >= 13 && h < 17) return 'noon'
  if (h >= 17 && h < 21) return 'evening'
  return 'night'
}

export function applyTheme(mode: ThemeMode | string = 'auto', date = new Date()) {
  const valid = THEME_NAMES.some(([k]) => k === mode)
  const t = !valid || mode === 'auto' ? autoTheme(date) : (mode as Theme)
  const root = document.documentElement
  if (root.dataset.theme !== t) {
    root.dataset.theme = t
    const bar = getComputedStyle(root).getPropertyValue('--bar').trim()
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bar || '#0E0F12')
  }
}
