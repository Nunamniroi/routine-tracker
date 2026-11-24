export type Routine = 'morning' | 'evening'
export type HabitKind = 'check' | 'time' | 'number'
export type TimerMode = 'timer' | 'manual' | 'both'

export type Schedule =
  | { type: 'daily' }
  | { type: 'weekdays'; days: number[] } // 0 = Пн … 6 = Нд
  | { type: 'perWeek'; n: number }

export interface Habit {
  id: string
  name: string
  routine: Routine
  kind: HabitKind
  unit?: string // для kind = 'number' (км, повтори…)
  goal?: number // секунди для 'time', число для 'number'
  timerMode?: TimerMode
  valueRequired?: boolean
  schedule: Schedule
  createdAt: string // dayKey
  archived?: boolean
  order: number
}

export interface Entry {
  done: boolean
  value?: number // секунди для 'time'
}

export interface DayLog {
  entries: Record<string, Entry>
  mood?: number // 1..5
  note?: string
}

export interface Relapse {
  at: number // ms
  loggedAt: number // ms — коли натиснули (для відміни 10 хв)
  trigger?: string
  note?: string
}

export interface Abstain {
  id: string
  name: string
  startAt: number // ms
  relapses: Relapse[]
  archived?: boolean
  order: number
}

export interface Pause {
  id: string
  from: string // dayKey, включно
  to: string // dayKey, включно
  reason: string
}

export interface DayRules {
  morningMin: number // мінімум ранкових справ
  eveningMin: number // мінімум вечірніх справ
  totalMin: number // мінімум справ за день загалом
  grace: boolean // 1 неповний день не ламає стрік
}

export interface Settings {
  dayStartHour: number
  rules?: DayRules
  remindMorning: { on: boolean; time: string }
  remindEvening: { on: boolean; time: string }
  theme?: 'auto' | 'light' | 'color' | 'dark'
}

export interface State {
  version: 1
  habits: Habit[]
  abstains: Abstain[]
  days: Record<string, DayLog>
  pauses: Pause[]
  settings: Settings
  onboarded: boolean
  achievements?: Record<string, number> // id → коли отримано (ms)
}
