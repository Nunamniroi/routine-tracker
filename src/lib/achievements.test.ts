import { describe, expect, it } from 'vitest'
import type { State } from './types'
import { earnedNow, tracks, nextMilestone } from './achievements'
import { addDays } from './date'

const T = '2026-11-24'
function st(): State {
  return {
    version: 1, onboarded: true, days: {}, pauses: [], abstains: [],
    settings: { dayStartHour: 4, remindMorning: { on: true, time: '09:00' }, remindEvening: { on: true, time: '21:00' } },
    habits: [
      { id: 'm', name: 'Душ', routine: 'morning', kind: 'check', schedule: { type: 'daily' }, createdAt: addDays(T, -20), order: 0 },
      { id: 'e', name: 'Асани', routine: 'evening', kind: 'check', schedule: { type: 'daily' }, createdAt: addDays(T, -20), order: 1 },
    ],
  }
}

describe('досягнення', () => {
  it('7 днів поспіль → 1, 3, 5, 7 для справи і загального стріку', () => {
    const s = st()
    for (let i = 1; i <= 7; i++) s.days[addDays(T, -i)] = { entries: { m: { done: true }, e: { done: true } } }
    const ids = earnedNow(s, T, Date.now()).map(a => a.id)
    expect(ids).toEqual(expect.arrayContaining(['habit:m:7', 'habit:e:5', 'global::7']))
    expect(ids).not.toContain('habit:m:10')
  })
  it('рекорд лишається після зриву стріку', () => {
    const s = st()
    for (let i = 5; i <= 14; i++) s.days[addDays(T, -i)] = { entries: { m: { done: true } } }
    const ids = earnedNow(s, T, Date.now()).map(a => a.id)
    expect(ids).toContain('habit:m:10')
    const t = tracks(s, T, Date.now()).find(x => x.refId === 'm')!
    expect(t.current).toBe(0)
    expect(nextMilestone(t)).toBe(14)
  })
  it('не роблю: дні без зриву', () => {
    const s = st()
    const now = new Date(2026, 10, 24, 12).getTime()
    s.abstains.push({ id: 'x', name: 'Солодке', startAt: now - 15.5 * 86400000, relapses: [], order: 0 })
    const ids = earnedNow(s, T, now).map(a => a.id)
    expect(ids).toContain('abst:x:14')
    expect(ids).not.toContain('abst:x:21')
  })
})

describe('скидання досягнень', () => {
  it('після скидання «не роблю» рахується з нуля, а інші треки не чіпає', async () => {
    const { resetAchievements, tracks, trackKey } = await import('./achievements')
    const D = 86400000, now = Date.UTC(2026, 10, 25, 12)
    const s = {
      version: 1, habits: [], days: {}, pauses: [], onboarded: true,
      settings: { dayStartHour: 4, remindMorning: { on: false, time: '09:00' }, remindEvening: { on: false, time: '21:00' } },
      abstains: [
        { id: 'a', name: 'A', startAt: now - 40 * D, relapses: [], order: 0 },
        { id: 'b', name: 'B', startAt: now - 10 * D, relapses: [], order: 1 },
      ],
    } as unknown as import('./types').State
    const before = tracks(s, '2026-11-25', now)
    expect(before.find(t => t.refId === 'a')!.best).toBe(40)
    resetAchievements(s, trackKey('abst', 'a'), now)
    const after = tracks(s, '2026-11-25', now + D * 2)
    expect(after.find(t => t.refId === 'a')!.best).toBe(2)
    expect(after.find(t => t.refId === 'b')!.best).toBe(12)
    expect(Object.keys(s.achievements!).some(k => k.startsWith('abst:a:'))).toBe(false)
    resetAchievements(s, 'all', now + D * 2)
    expect(tracks(s, '2026-11-25', now + D * 3).find(t => t.refId === 'b')!.best).toBe(1)
  })
})
