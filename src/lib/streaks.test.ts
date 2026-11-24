import { describe, expect, it } from 'vitest'
import type { Habit, State } from './types'
import { abstainStats, dayStatus, globalStreak, habitDots, habitStreak, moodEffects } from './streaks'
import { addDays, dayKey } from './date'

const T = '2026-11-24' // вівторок

function habit(id: string, routine: 'morning' | 'evening', extra: Partial<Habit> = {}): Habit {
  return { id, name: id, routine, kind: 'check', schedule: { type: 'daily' }, createdAt: '2026-10-01', order: 0, ...extra }
}

function mkState(habits: Habit[]): State {
  return {
    version: 1, habits, abstains: [], days: {}, pauses: [], onboarded: true,
    settings: { dayStartHour: 4, remindMorning: { on: true, time: '09:00' }, remindEvening: { on: true, time: '21:00' } },
  }
}

function done(s: State, id: string, ...offsets: number[]) {
  for (const o of offsets) {
    const k = addDays(T, -o)
    s.days[k] ??= { entries: {} }
    s.days[k].entries[id] = { done: true }
  }
}

describe('dayKey: новий день о 04:00', () => {
  it('03:30 — ще вчора', () => {
    expect(dayKey(new Date(2026, 10, 24, 3, 30))).toBe('2026-11-23')
    expect(dayKey(new Date(2026, 10, 24, 4, 0))).toBe('2026-11-24')
  })
})

describe('стрік справи з пощадою', () => {
  const h = habit('a', 'morning', { createdAt: '2026-11-10' })
  it('кожен день — рахує всі дні', () => {
    const s = mkState([h]); done(s, 'a', 0, 1, 2, 3)
    expect(habitStreak(s, h, T).count).toBe(4)
  })
  it('один пропуск не ламає, але й не додає', () => {
    const s = mkState([h]); done(s, 'a', 0, 2, 3) // вчора пропуск
    expect(habitStreak(s, h, T).count).toBe(3)
  })
  it('два пропуски поспіль — обнулення', () => {
    const s = mkState([h]); done(s, 'a', 0, 3, 4) // пропущено 1 і 2
    expect(habitStreak(s, h, T).count).toBe(1)
  })
  it('через день — стрік живе (так задумано)', () => {
    const s = mkState([h]); done(s, 'a', 0, 2, 4, 6, 8)
    expect(habitStreak(s, h, T).count).toBe(5)
  })
  it('сьогодні ще не зроблено — не пропуск; вчора пропуск → стан grace', () => {
    const s = mkState([h]); done(s, 'a', 2, 3)
    const r = habitStreak(s, h, T)
    expect(r.count).toBe(2)
    expect(r.status).toBe('grace')
  })
  it('дні поза розкладом не рахуються як пропуск', () => {
    // Пн/Ср/Пт. T = вівторок. Пн = 1 день тому, Пт = 4, Ср = 6
    const hw = habit('w', 'morning', { createdAt: '2026-11-10', schedule: { type: 'weekdays', days: [0, 2, 4] } })
    const s = mkState([hw]); done(s, 'w', 1, 4, 6)
    expect(habitStreak(s, hw, T).count).toBe(3)
  })
  it('пауза пропускається', () => {
    const s = mkState([h]); done(s, 'a', 0, 4, 5)
    s.pauses.push({ id: 'p', from: addDays(T, -3), to: addDays(T, -1), reason: 'Хвороба' })
    expect(habitStreak(s, h, T).count).toBe(3)
  })
  it('рекорд зберігається після обнулення', () => {
    const s = mkState([h]); done(s, 'a', 0, 5, 6, 7, 8, 9)
    const r = habitStreak(s, h, T)
    expect(r.count).toBe(1)
    expect(r.record).toBe(5)
  })
  it('крапочки: перший пропуск жовтий, другий червоний', () => {
    const s = mkState([h]); done(s, 'a', 3)
    const d = habitDots(s, h, T, 4)
    expect(d).toEqual(['done', 'grace', 'miss', 'today'])
  })
})

describe('N разів на тиждень', () => {
  it('рахує тижні', () => {
    const h = habit('p', 'morning', { createdAt: '2026-11-02', schedule: { type: 'perWeek', n: 2 } })
    const s = mkState([h])
    // тиждень з 2026-11-09: 2 рази; з 2026-11-16: 2 рази; поточний (з 23) — 1 раз (ще триває)
    done(s, 'p', 15, 13, 8, 6, 1)
    expect(habitStreak(s, h, T)).toMatchObject({ count: 2, unit: 'weeks' })
  })
})

describe('загальний стрік', () => {
  const m = habit('m', 'morning')
  const e = habit('e', 'evening')
  it('повні дні рахуються, сьогодні — поки ні', () => {
    const s = mkState([m, e])
    done(s, 'm', 1, 2, 3); done(s, 'e', 1, 2, 3)
    s.habits.forEach(h => (h.createdAt = addDays(T, -3)))
    const g = globalStreak(s, T)
    expect(g.count).toBe(3)
    expect(g.todayFull).toBe(false)
  })
  it('сьогодні повний — +1', () => {
    const s = mkState([m, e]); s.habits.forEach(h => (h.createdAt = addDays(T, -1)))
    done(s, 'm', 0, 1); done(s, 'e', 0, 1)
    expect(globalStreak(s, T).count).toBe(2)
  })
  it('неповний день — пощада', () => {
    const s = mkState([m, e]); s.habits.forEach(h => (h.createdAt = addDays(T, -3)))
    done(s, 'm', 1, 2, 3); done(s, 'e', 1, 3) // день -2 тільки ранок
    const g = globalStreak(s, T)
    expect(g.count).toBe(2)
    expect(g.graces).toBe(1)
  })
  it('два неповні поспіль — обнулення', () => {
    const s = mkState([m, e]); s.habits.forEach(h => (h.createdAt = addDays(T, -4)))
    done(s, 'm', 1, 2, 3, 4); done(s, 'e', 1, 4) // -2 і -3 неповні
    expect(globalStreak(s, T).count).toBe(1)
  })
  it('порожній день — обнулення', () => {
    const s = mkState([m, e]); s.habits.forEach(h => (h.createdAt = addDays(T, -3)))
    done(s, 'm', 1, 3); done(s, 'e', 1, 3) // -2 порожній
    expect(globalStreak(s, T).count).toBe(1)
  })
  it('вчора неповний → попередження', () => {
    const s = mkState([m, e]); s.habits.forEach(h => (h.createdAt = addDays(T, -2)))
    done(s, 'm', 1, 2); done(s, 'e', 2)
    expect(globalStreak(s, T).graceWarning).toBe(true)
  })
  it('статуси днів', () => {
    const s = mkState([m, e]); s.habits.forEach(h => (h.createdAt = addDays(T, -3)))
    done(s, 'm', 1, 2); done(s, 'e', 1)
    expect(dayStatus(s, addDays(T, -1), T)).toBe('full')
    expect(dayStatus(s, addDays(T, -2), T)).toBe('partial')
    expect(dayStatus(s, addDays(T, -3), T)).toBe('empty')
    expect(dayStatus(s, T, T)).toBe('today')
    expect(dayStatus(s, addDays(T, 1), T)).toBe('future')
  })
})

describe('не роблю', () => {
  it('серії, рекорд, зриви за місяць', () => {
    const day = 86400000
    const now = new Date(2026, 10, 24, 12).getTime()
    const a = { id: 'x', name: 'Солодке', order: 0, startAt: now - 60 * day, relapses: [
      { at: now - 40 * day, loggedAt: 0 }, { at: now - 12 * day, loggedAt: 0 },
    ] }
    const st = abstainStats(a, now)
    expect(Math.round(st.currentMs / day)).toBe(12)
    expect(Math.round(st.recordMs / day)).toBe(28)
    expect(st.relapsesThisMonth).toBe(1)
  })
})

describe('самопочуття', () => {
  it('рахує різницю з/без', () => {
    const h = habit('m', 'morning', { createdAt: '2026-11-01' })
    const s = mkState([h])
    for (let i = 1; i <= 6; i++) {
      const k = addDays(T, -i)
      s.days[k] = { entries: i % 2 ? { m: { done: true } } : {}, mood: i % 2 ? 5 : 3 }
    }
    const [eff] = moodEffects(s, T)
    expect(eff.diff).toBe(2)
  })
})

describe('налаштовувані правила дня', () => {
  const ms = [habit('m1', 'morning'), habit('m2', 'morning'), habit('m3', 'morning')]
  const es = [habit('e1', 'evening'), habit('e2', 'evening')]
  const mk = () => { const s = mkState([...ms, ...es]); s.habits.forEach(h => (h.createdAt = addDays(T, -3))); return s }
  it('2 ранкових + 1 вечірня: 1 ранкова — неповний', () => {
    const s = mk(); s.settings.rules = { morningMin: 2, eveningMin: 1, totalMin: 0, grace: true }
    done(s, 'm1', 1); done(s, 'e1', 1)
    expect(dayStatus(s, addDays(T, -1), T)).toBe('partial')
    done(s, 'm2', 1)
    expect(dayStatus(s, addDays(T, -1), T)).toBe('full')
  })
  it('мінімум усього 4', () => {
    const s = mk(); s.settings.rules = { morningMin: 1, eveningMin: 1, totalMin: 4, grace: true }
    done(s, 'm1', 1); done(s, 'e1', 1); done(s, 'e2', 1)
    expect(dayStatus(s, addDays(T, -1), T)).toBe('partial')
    done(s, 'm3', 1)
    expect(dayStatus(s, addDays(T, -1), T)).toBe('full')
  })
  it('вечірніх не обовʼязково (0)', () => {
    const s = mk(); s.settings.rules = { morningMin: 1, eveningMin: 0, totalMin: 1, grace: true }
    done(s, 'm1', 1)
    expect(dayStatus(s, addDays(T, -1), T)).toBe('full')
  })
  it('пощаду вимкнено — неповний день ламає стрік', () => {
    const s = mk(); s.settings.rules = { morningMin: 1, eveningMin: 1, totalMin: 1, grace: false }
    done(s, 'm1', 1, 2, 3); done(s, 'e1', 1, 3)
    expect(globalStreak(s, T).count).toBe(1)
  })
  it('мінімум більший за кількість справ — обрізається', () => {
    const s = mk(); s.settings.rules = { morningMin: 10, eveningMin: 10, totalMin: 20, grace: true }
    done(s, 'm1', 1); done(s, 'm2', 1); done(s, 'm3', 1); done(s, 'e1', 1); done(s, 'e2', 1)
    expect(dayStatus(s, addDays(T, -1), T)).toBe('full')
  })
})
