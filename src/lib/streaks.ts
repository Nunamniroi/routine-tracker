import type { Abstain, Habit, State } from './types'
import { addDays, cmpKey, weekStart } from './date'

// ───────────────────────── базові перевірки ─────────────────────────

export function isPaused(state: State, key: string): boolean {
  return state.pauses.some(p => cmpKey(key, p.from) >= 0 && cmpKey(key, p.to) <= 0)
}

export function isDone(state: State, habitId: string, key: string): boolean {
  return !!state.days[key]?.entries[habitId]?.done
}

export function activeHabits(state: State): Habit[] {
  return state.habits.filter(h => !h.archived).sort((a, b) => a.order - b.order)
}

/** Чи має справа бути виконана цього дня (для perWeek — будь-який день підходить, але пропуском не вважається). */
export function isScheduled(h: Habit, key: string): boolean {
  if (cmpKey(key, h.createdAt) < 0) return false
  const s = h.schedule
  if (s.type === 'daily') return true
  if (s.type === 'weekdays') {
    const wd = (new Date(key + 'T12:00:00').getDay() + 6) % 7
    return s.days.includes(wd)
  }
  return true
}

// ───────────────────────── стрік справи ─────────────────────────
// Правило: 1 пропущений запланований день стрік не ламає (але й не додає),
// 2 пропущені поспіль — стрік обнуляється. Пауза й дні поза розкладом — пропускаються.

export type HabitStatus = 'done' | 'pending' | 'grace' | 'off'

export interface HabitStreak {
  count: number
  unit: 'days' | 'weeks'
  status: HabitStatus // стан на сьогодні
  record: number
}

const MAX_BACK = 3660

function weeksMet(state: State, h: Habit, wStart: string): number {
  let n = 0
  for (let i = 0; i < 7; i++) if (isDone(state, h.id, addDays(wStart, i))) n++
  return n
}

export function habitStreak(state: State, h: Habit, today: string): HabitStreak {
  if (h.schedule.type === 'perWeek') return perWeekStreak(state, h, today)

  // поточний стрік — йдемо назад від сьогодні
  let count = 0
  let misses = 0
  let lastScheduledBeforeTodayMissed = false
  let seenBeforeToday = false
  for (let i = 0; i < MAX_BACK; i++) {
    const key = addDays(today, -i)
    if (cmpKey(key, h.createdAt) < 0) break
    if (isPaused(state, key) || !isScheduled(h, key)) continue
    if (isDone(state, h.id, key)) {
      count++
      misses = 0
      if (i > 0 && !seenBeforeToday) seenBeforeToday = true
    } else {
      if (i === 0) continue // сьогодні ще не вечір
      if (!seenBeforeToday) {
        seenBeforeToday = true
        lastScheduledBeforeTodayMissed = true
      }
      misses++
      if (misses >= 2) break
    }
  }

  const todayDone = isDone(state, h.id, today)
  let status: HabitStatus
  if (!isScheduled(h, today) || isPaused(state, today)) status = todayDone ? 'done' : 'off'
  else if (todayDone) status = 'done'
  else if (lastScheduledBeforeTodayMissed && count > 0) status = 'grace'
  else status = 'pending'

  return { count, unit: 'days', status, record: Math.max(count, habitRecord(state, h, today)) }
}

function habitRecord(state: State, h: Habit, today: string): number {
  let best = 0
  let run = 0
  let misses = 0
  for (let key = h.createdAt; cmpKey(key, today) <= 0; key = addDays(key, 1)) {
    if (isPaused(state, key) || !isScheduled(h, key)) continue
    if (isDone(state, h.id, key)) {
      run++
      misses = 0
      best = Math.max(best, run)
    } else if (key !== today) {
      misses++
      if (misses >= 2) run = 0
    }
  }
  return best
}

function perWeekStreak(state: State, h: Habit, today: string): HabitStreak {
  const n = h.schedule.type === 'perWeek' ? h.schedule.n : 1
  const firstWeek = weekStart(h.createdAt)
  const curWeek = weekStart(today)
  // поточна серія тижнів (з тією ж пощадою: 1 провалений тиждень можна, 2 поспіль — ні)
  let count = 0
  let misses = 0
  for (let w = curWeek; cmpKey(w, firstWeek) >= 0; w = addDays(w, -7)) {
    const met = weeksMet(state, h, w) >= n
    if (met) {
      count++
      misses = 0
    } else if (w !== curWeek) {
      misses++
      if (misses >= 2) break
    }
  }
  // рекорд
  let best = 0
  let run = 0
  let m = 0
  for (let w = firstWeek; cmpKey(w, curWeek) <= 0; w = addDays(w, 7)) {
    if (weeksMet(state, h, w) >= n) {
      run++
      m = 0
      best = Math.max(best, run)
    } else if (w !== curWeek) {
      m++
      if (m >= 2) run = 0
    }
  }
  const status: HabitStatus = isDone(state, h.id, today) ? 'done' : weeksMet(state, h, curWeek) >= n ? 'off' : 'pending'
  return { count, unit: 'weeks', status, record: Math.max(best, count) }
}

/** Стан справи за останні N днів для «крапочок»: done | grace (1-й пропуск) | miss (2-й поспіль) | off | today */
export type Dot = 'done' | 'grace' | 'miss' | 'off' | 'today'
export function habitDots(state: State, h: Habit, today: string, n = 14): Dot[] {
  const start = addDays(today, -(n - 1))
  // рахуємо послідовні пропуски, починаючи трохи раніше, щоб правильно визначити перший пропуск
  let misses = 0
  const out: Dot[] = []
  for (let key = addDays(start, -14); cmpKey(key, today) <= 0; key = addDays(key, 1)) {
    let dot: Dot
    if (isPaused(state, key) || !isScheduled(h, key) || h.schedule.type === 'perWeek') {
      dot = isDone(state, h.id, key) ? 'done' : 'off'
    } else if (isDone(state, h.id, key)) {
      misses = 0
      dot = 'done'
    } else if (key === today) {
      dot = 'today'
    } else {
      misses++
      dot = misses >= 2 ? 'miss' : 'grace'
    }
    if (cmpKey(key, start) >= 0) out.push(dot)
  }
  return out
}

// ───────────────────────── загальний стрік (день) ─────────────────────────
// Повний день: хоча б 1 ранкова І хоча б 1 вечірня справа → +1.
// Неповний (лише ранок або лише вечір): пощада — не додає й не ламає; 2 неповні поспіль → 0.
// Порожній день → 0. Пауза — пропускається.

export type DayStatus = 'full' | 'partial' | 'empty' | 'paused' | 'today' | 'future' | 'before'

export interface DayParts {
  morning: boolean
  evening: boolean
  morningDone: number
  morningTotal: number
  eveningDone: number
  eveningTotal: number
}

export function dayParts(state: State, key: string): DayParts {
  const hs = state.habits.filter(h => cmpKey(key, h.createdAt) >= 0 && (!h.archived || isAnyDone(state, h.id, key)))
  const res: DayParts = { morning: false, evening: false, morningDone: 0, morningTotal: 0, eveningDone: 0, eveningTotal: 0 }
  let morningExists = false
  let eveningExists = false
  for (const h of hs) {
    const done = isDone(state, h.id, key)
    const sched = isScheduled(h, key) && !h.archived
    if (h.routine === 'morning') {
      if (sched) { res.morningTotal++; morningExists = true }
      if (done) { res.morningDone++; res.morning = true }
    } else {
      if (sched) { res.eveningTotal++; eveningExists = true }
      if (done) { res.eveningDone++; res.evening = true }
    }
  }
  // якщо в рутині цього дня нічого не заплановано — ця частина вважається виконаною
  if (!morningExists && !res.morning) res.morning = true
  if (!eveningExists && !res.evening) res.evening = true
  return res
}

function isAnyDone(state: State, id: string, key: string) {
  return isDone(state, id, key)
}

export function firstDay(state: State): string | null {
  const keys = state.habits.map(h => h.createdAt).sort()
  return keys[0] ?? null
}

export function dayStatus(state: State, key: string, today: string): DayStatus {
  const first = firstDay(state)
  if (!first || cmpKey(key, first) < 0) return 'before'
  if (cmpKey(key, today) > 0) return 'future'
  if (isPaused(state, key)) return 'paused'
  const p = dayParts(state, key)
  const anyDone = p.morningDone + p.eveningDone > 0
  if (p.morning && p.evening && anyDone) return 'full'
  if (key === today) return 'today'
  if (anyDone) return 'partial'
  return 'empty'
}

export interface GlobalStreak {
  count: number
  record: number
  todayFull: boolean
  graceWarning: boolean // вчора був неповний день: сьогодні треба повний, інакше обнулиться
  graces: number // неповних днів у поточній серії
}

export function globalStreak(state: State, today: string): GlobalStreak {
  const first = firstDay(state)
  if (!first) return { count: 0, record: 0, todayFull: false, graceWarning: false, graces: 0 }
  let count = 0
  let partials = 0
  let graces = 0
  let lastNonPausedBeforeToday: DayStatus | null = null
  for (let i = 0; i < MAX_BACK; i++) {
    const key = addDays(today, -i)
    if (cmpKey(key, first) < 0) break
    const st = dayStatus(state, key, today)
    if (st === 'paused') continue
    if (i > 0 && lastNonPausedBeforeToday === null) lastNonPausedBeforeToday = st
    if (st === 'today') continue
    if (st === 'full') { count++; partials = 0; continue }
    if (st === 'partial') {
      partials++
      if (partials >= 2) break
      graces++
      continue
    }
    break // empty
  }
  const todayFull = dayStatus(state, today, today) === 'full'
  const graceWarning = !todayFull && lastNonPausedBeforeToday === 'partial' && count > 0
  return { count, record: Math.max(count, globalRecord(state, today)), todayFull, graceWarning, graces }
}

function globalRecord(state: State, today: string): number {
  const first = firstDay(state)
  if (!first) return 0
  let best = 0
  let run = 0
  let partials = 0
  for (let key = first; cmpKey(key, today) <= 0; key = addDays(key, 1)) {
    const st = dayStatus(state, key, today)
    if (st === 'paused' || st === 'today') continue
    if (st === 'full') { run++; partials = 0; best = Math.max(best, run) }
    else if (st === 'partial') { partials++; if (partials >= 2) { run = 0; partials = 0 } }
    else { run = 0; partials = 0 }
  }
  return best
}

// ───────────────────────── «Не роблю» ─────────────────────────

export interface AbstainStats {
  currentMs: number
  recordMs: number
  isRecord: boolean
  relapsesThisMonth: number
  relapsesPrevMonth: number
  avgSeriesMs: number | null
  lastStart: number
}

export function abstainStats(a: Abstain, now: number): AbstainStats {
  const rel = [...a.relapses].map(r => r.at).filter(t => t >= a.startAt && t <= now).sort((x, y) => x - y)
  const bounds = [a.startAt, ...rel]
  const series: number[] = []
  for (let i = 1; i < bounds.length; i++) series.push(bounds[i] - bounds[i - 1])
  const lastStart = bounds[bounds.length - 1]
  const currentMs = now - lastStart
  const recordMs = Math.max(currentMs, ...series, 0)
  const d = new Date(now)
  const mStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime()
  const pStart = new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime()
  return {
    currentMs,
    recordMs,
    isRecord: currentMs >= recordMs && currentMs > 0,
    relapsesThisMonth: rel.filter(t => t >= mStart).length,
    relapsesPrevMonth: rel.filter(t => t >= pStart && t < mStart).length,
    avgSeriesMs: series.length ? series.reduce((s, x) => s + x, 0) / series.length : null,
    lastStart,
  }
}

export function fmtSpan(ms: number): { days: number; hours: number } {
  const h = Math.floor(ms / 3600000)
  return { days: Math.floor(h / 24), hours: h % 24 }
}

// ───────────────────────── Самопочуття ─────────────────────────

export interface MoodEffect {
  habit: Habit
  withAvg: number
  withoutAvg: number
  diff: number
  nWith: number
  nWithout: number
}

export function moodEffects(state: State, today: string, minEach = 3): MoodEffect[] {
  const out: MoodEffect[] = []
  for (const h of activeHabits(state)) {
    const w: number[] = []
    const wo: number[] = []
    for (const [key, log] of Object.entries(state.days)) {
      if (!log.mood || cmpKey(key, today) > 0 || cmpKey(key, h.createdAt) < 0) continue
      if (isPaused(state, key)) continue
      if (log.entries[h.id]?.done) w.push(log.mood)
      else if (isScheduled(h, key)) wo.push(log.mood)
    }
    if (w.length >= minEach && wo.length >= minEach) {
      const a = w.reduce((s, x) => s + x, 0) / w.length
      const b = wo.reduce((s, x) => s + x, 0) / wo.length
      out.push({ habit: h, withAvg: a, withoutAvg: b, diff: a - b, nWith: w.length, nWithout: wo.length })
    }
  }
  return out.sort((x, y) => y.diff - x.diff)
}

/** Найкраще значення (для 'time' / 'number') за весь час */
export function bestValue(state: State, habitId: string): number | null {
  let best: number | null = null
  for (const log of Object.values(state.days)) {
    const v = log.entries[habitId]?.value
    if (typeof v === 'number' && (best === null || v > best)) best = v
  }
  return best
}

export function valuesSeries(state: State, habitId: string, today: string, n: number): (number | null)[] {
  const out: (number | null)[] = []
  for (let i = n - 1; i >= 0; i--) {
    const key = addDays(today, -i)
    const e = state.days[key]?.entries[habitId]
    out.push(e?.done ? e.value ?? null : null)
  }
  return out
}
