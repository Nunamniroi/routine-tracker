import type { State } from './types'
import { abstainStats, activeHabits, globalStreak, habitStreak } from './streaks'

export const DAY_MILESTONES = [1, 3, 5, 7, 10, 14, 21, 30, 45, 60, 90, 100, 150, 180, 200, 250, 300, 365, 500, 730, 1000]
export const WEEK_MILESTONES = [1, 2, 4, 8, 12, 26, 52, 104]

const DAY_TITLES: Record<number, string> = {
  1: 'Перший крок', 3: 'Розгін', 5: 'Пʼятірка', 7: 'Тиждень', 10: 'Десятка', 14: 'Два тижні',
  21: 'Звичка формується', 30: 'Місяць', 45: 'Півтора місяця', 60: 'Два місяці', 90: 'Квартал',
  100: 'Сотня', 150: 'Півтори сотні', 180: 'Пів року', 200: 'Двісті', 250: 'Чверть тисячі',
  300: 'Триста', 365: 'Рік', 500: 'Пʼятсот', 730: 'Два роки', 1000: 'Тисяча',
}
const WEEK_TITLES: Record<number, string> = {
  1: 'Перший тиждень', 2: 'Два тижні', 4: 'Місяць', 8: 'Два місяці', 12: 'Квартал', 26: 'Пів року', 52: 'Рік', 104: 'Два роки',
}

export type Tier = 'bronze' | 'silver' | 'gold' | 'legend'
export function tierOf(n: number, unit: 'days' | 'weeks'): Tier {
  const d = unit === 'weeks' ? n * 7 : n
  if (d < 10) return 'bronze'
  if (d < 45) return 'silver'
  if (d < 150) return 'gold'
  return 'legend'
}

export type Scope = 'global' | 'habit' | 'abst'

export interface Track {
  scope: Scope
  refId: string // '' для global
  name: string
  unit: 'days' | 'weeks'
  current: number
  best: number
  milestones: number[]
}

export interface Achievement {
  id: string
  scope: Scope
  refId: string
  name: string
  n: number
  unit: 'days' | 'weeks'
  title: string
  tier: Tier
}

export function achId(scope: Scope, refId: string, n: number) {
  return `${scope}:${refId}:${n}`
}

export function titleOf(n: number, unit: 'days' | 'weeks') {
  return (unit === 'weeks' ? WEEK_TITLES[n] : DAY_TITLES[n]) ?? `${n}`
}

export function tracks(state: State, today: string, now: number): Track[] {
  const out: Track[] = []
  const g = globalStreak(state, today)
  out.push({ scope: 'global', refId: '', name: 'Загальний стрік', unit: 'days', current: g.count, best: g.record, milestones: DAY_MILESTONES })
  for (const h of activeHabits(state)) {
    const st = habitStreak(state, h, today)
    out.push({ scope: 'habit', refId: h.id, name: h.name, unit: st.unit, current: st.count, best: st.record, milestones: st.unit === 'weeks' ? WEEK_MILESTONES : DAY_MILESTONES })
  }
  for (const a of state.abstains.filter(x => !x.archived)) {
    const st = abstainStats(a, now)
    const day = 86400000
    out.push({ scope: 'abst', refId: a.id, name: a.name, unit: 'days', current: Math.floor(st.currentMs / day), best: Math.floor(st.recordMs / day), milestones: DAY_MILESTONES })
  }
  return out
}

/** Усі ачівки, які зараз заслужені за рекордом (тобто вже назавжди) */
export function earnedNow(state: State, today: string, now: number): Achievement[] {
  const out: Achievement[] = []
  for (const t of tracks(state, today, now)) {
    for (const n of t.milestones) {
      if (t.best >= n) out.push({ id: achId(t.scope, t.refId, n), scope: t.scope, refId: t.refId, name: t.name, n, unit: t.unit, title: titleOf(n, t.unit), tier: tierOf(n, t.unit) })
    }
  }
  return out
}

export function nextMilestone(t: Track): number | null {
  return t.milestones.find(n => n > t.best) ?? null
}
