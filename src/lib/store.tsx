import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { get, set } from 'idb-keyval'
import type { Abstain, Entry, Habit, Pause, Settings, State } from './types'
import { dayKey } from './date'

const KEY = 'routine-tracker-state-v1'

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

export const defaultSettings: Settings = {
  dayStartHour: 4,
  remindMorning: { on: true, time: '09:00' },
  remindEvening: { on: true, time: '21:00' },
}

export function emptyState(): State {
  return { version: 1, habits: [], abstains: [], days: {}, pauses: [], settings: defaultSettings, onboarded: false }
}

/** Рутина Андрія — пропонується на першому запуску */
export function presetHabits(today: string): Habit[] {
  const mk = (name: string, routine: Habit['routine'], kind: Habit['kind'], extra: Partial<Habit> = {}): Habit => ({
    id: uid(), name, routine, kind, schedule: { type: 'daily' }, createdAt: today, order: 0, ...extra,
  })
  const list: Habit[] = [
    mk('Холодний душ', 'morning', 'time', { timerMode: 'both' }),
    mk('Масаж Івата', 'morning', 'check'),
    mk('Стояння на цвяхах', 'morning', 'time', { timerMode: 'both', goal: 420 }),
    mk('Спорт', 'morning', 'check'),
    mk('Кіртан ранковий', 'morning', 'time', { timerMode: 'both' }),
    mk('Медитація ранкова', 'morning', 'time', { timerMode: 'both' }),
    mk('Медитація вечірня', 'evening', 'time', { timerMode: 'both' }),
    mk('Кіртан вечірній', 'evening', 'time', { timerMode: 'both' }),
    mk('Прогулянка', 'evening', 'number', { unit: 'км' }),
    mk('Асани', 'evening', 'time', { timerMode: 'both' }),
    mk('Лежання на голках', 'evening', 'time', { timerMode: 'both' }),
  ]
  list.forEach((h, i) => (h.order = i))
  return list
}

interface Store {
  state: State
  loaded: boolean
  now: number
  today: string
  update: (fn: (s: State) => void) => void
  setEntry: (key: string, habitId: string, entry: Entry | null) => void
  upsertHabit: (h: Habit) => void
  upsertAbstain: (a: Abstain) => void
  addPause: (p: Omit<Pause, 'id'>) => void
  replaceState: (s: State) => void
}

const Ctx = createContext<Store | null>(null)

function clone<T>(x: T): T {
  return typeof structuredClone === 'function' ? structuredClone(x) : JSON.parse(JSON.stringify(x))
}

/** Розбір файлу резервної копії. Кидає помилку, якщо файл не наш. */
export async function parseBackup(f: File): Promise<State> {
  const data = JSON.parse(await f.text()) as State
  if (!data || data.version !== 1 || !Array.isArray(data.habits)) throw new Error('bad backup')
  const base = emptyState()
  return { ...base, ...data, settings: { ...base.settings, ...data.settings }, onboarded: true }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(emptyState)
  const [loaded, setLoaded] = useState(false)
  const [now, setNow] = useState(Date.now())
  const saveTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    get(KEY)
      .then(v => {
        if (v) setState({ ...emptyState(), ...(v as State), settings: { ...defaultSettings, ...(v as State).settings } })
      })
      .catch(() => {
        try {
          const raw = localStorage.getItem(KEY)
          if (raw) setState(JSON.parse(raw))
        } catch { /* empty */ }
      })
      .finally(() => setLoaded(true))
    navigator.storage?.persist?.().catch(() => {})
    const t = window.setInterval(() => setNow(Date.now()), 30000)
    const onVis = () => setNow(Date.now())
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis) }
  }, [])

  const latest = useRef(state)
  latest.current = state
  useEffect(() => {
    // при згортанні застосунку зберігаємо одразу, без затримки
    const flush = () => {
      if (!loaded) return
      window.clearTimeout(saveTimer.current)
      set(KEY, latest.current).catch(() => { try { localStorage.setItem(KEY, JSON.stringify(latest.current)) } catch { /* empty */ } })
    }
    const onHide = () => { if (document.visibilityState === 'hidden') flush() }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', flush)
    return () => { document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', flush) }
  }, [loaded])

  useEffect(() => {
    if (!loaded) return
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      set(KEY, state).catch(() => {
        try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* empty */ }
      })
    }, 150)
  }, [state, loaded])

  const update = useCallback((fn: (s: State) => void) => {
    setState(prev => {
      const next = clone(prev)
      fn(next)
      return next
    })
  }, [])

  const setEntry = useCallback((key: string, habitId: string, entry: Entry | null) => {
    update(s => {
      s.days[key] ??= { entries: {} }
      if (entry) s.days[key].entries[habitId] = entry
      else delete s.days[key].entries[habitId]
    })
  }, [update])

  const upsertHabit = useCallback((h: Habit) => {
    update(s => {
      const i = s.habits.findIndex(x => x.id === h.id)
      if (i >= 0) s.habits[i] = h
      else s.habits.push({ ...h, order: Math.max(-1, ...s.habits.map(x => x.order)) + 1 })
    })
  }, [update])

  const upsertAbstain = useCallback((a: Abstain) => {
    update(s => {
      const i = s.abstains.findIndex(x => x.id === a.id)
      if (i >= 0) s.abstains[i] = a
      else s.abstains.push({ ...a, order: s.abstains.length })
    })
  }, [update])

  const addPause = useCallback((p: Omit<Pause, 'id'>) => {
    update(s => { s.pauses.push({ ...p, id: uid() }) })
  }, [update])

  const replaceState = useCallback((s: State) => setState(s), [])

  const today = dayKey(now, state.settings.dayStartHour)

  return (
    <Ctx.Provider value={{ state, loaded, now, today, update, setEntry, upsertHabit, upsertAbstain, addPause, replaceState }}>
      {children}
    </Ctx.Provider>
  )
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('StoreProvider missing')
  return s
}
