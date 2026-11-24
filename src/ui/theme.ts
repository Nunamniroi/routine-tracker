// Тема за часом доби: ранок — світла, день — кольорова, вечір і ніч — темна.
export type ThemeMode = 'auto' | 'light' | 'color' | 'dark'
export type Theme = Exclude<ThemeMode, 'auto'>

/** Межі для «Авто»: 04–11 світла, 11–17 кольорова, 17–04 темна */
export function autoTheme(date: Date): Theme {
  const h = date.getHours()
  if (h >= 4 && h < 11) return 'light'
  if (h >= 11 && h < 17) return 'color'
  return 'dark'
}

export function applyTheme(mode: ThemeMode = 'auto', date = new Date()) {
  const t = mode === 'auto' ? autoTheme(date) : mode
  const root = document.documentElement
  if (root.dataset.theme !== t) {
    root.dataset.theme = t
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim()
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg || '#0E0F12')
  }
}
