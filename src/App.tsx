import { useCallback, useState } from 'react'
import { StoreProvider, presetHabits, useStore } from './lib/store'
import { Icon, Toast } from './ui/kit'
import { Today } from './screens/Today'
import { ValueSheet } from './screens/ValueSheet'
import { Timer } from './screens/Timer'
import { AbstainEdit, AbstainScreen, RelapseSheet } from './screens/Abstain'
import { Stats } from './screens/Stats'
import { DayEdit } from './screens/DayEdit'
import { HabitEdit, PauseSheet, SettingsScreen } from './screens/Settings'

export type Overlay =
  | { type: 'value'; habitId: string; key: string }
  | { type: 'timer'; habitId: string; key: string }
  | { type: 'day'; key: string }
  | { type: 'settings' }
  | { type: 'habit'; habitId: string | null }
  | { type: 'abstainEdit'; id: string | null }
  | { type: 'relapse'; id: string }
  | { type: 'pause' }

type Tab = 'today' | 'abstain' | 'stats'

function Shell() {
  const { loaded, state, today, update } = useStore()
  const [tab, setTab] = useState<Tab>('today')
  const [stack, setStack] = useState<Overlay[]>([])
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null)
  const open = useCallback((o: Overlay) => setStack(s => [...s, o]), [])
  const close = useCallback(() => setStack(s => s.slice(0, -1)), [])
  const closeToast = useCallback(() => setToast(null), [])

  if (!loaded) return <div className="splash"><Icon name="flame" size={48} color="var(--fire)" /></div>

  if (!state.onboarded && state.habits.length === 0) {
    return (
      <div className="page onboarding">
        <div className="empty-icon"><Icon name="flame" size={72} color="var(--fire)" /></div>
        <h1 className="center">Трекер рутини</h1>
        <p className="muted center">Стріки з пощадою, таймер для практик, «не роблю» і статистика. Усе зберігається на цьому телефоні й працює без інтернету.</p>
        <button className="btn primary" onClick={() => update(s => { s.habits = presetHabits(today); s.onboarded = true })}>Завантажити мою рутину (11 справ)</button>
        <button className="btn ghost" onClick={() => update(s => { s.onboarded = true })}>Почати з нуля</button>
        <p className="muted small center">Справи потім можна змінити в налаштуваннях.</p>
      </div>
    )
  }

  const top = stack[stack.length - 1]

  return (
    <div className="app">
      <main className="main">
        {tab === 'today' && <Today onOpen={open} />}
        {tab === 'abstain' && <AbstainScreen onOpen={open} />}
        {tab === 'stats' && <Stats onOpen={open} />}
      </main>
      <nav className="tabbar">
        {([['today', 'Сьогодні', 'today'], ['abstain', 'Не роблю', 'ban'], ['stats', 'Статистика', 'stats']] as const).map(([k, l, ic]) => (
          <button key={k} className={'tab' + (tab === k ? ' on' : '')} onClick={() => { setTab(k); setStack([]) }}>
            <Icon name={ic} size={22} color={tab === k ? 'var(--fire)' : 'var(--muted)'} />
            <span>{l}</span>
          </button>
        ))}
      </nav>

      {/* повноекранні екрани — стопкою, «назад» повертає на попередній */}
      {stack.map((o, i) => {
        const style = { position: 'relative' as const, zIndex: 20 + i }
        switch (o.type) {
          case 'settings': return <div key={i} style={style}><SettingsScreen onClose={close} onOpen={open} /></div>
          case 'habit': return <div key={i} style={style}><HabitEdit habitId={o.habitId} onClose={close} /></div>
          case 'day': return <div key={i} style={style}><DayEdit dateKey={o.key} onClose={close} /></div>
          case 'timer': return <div key={i} style={style}><Timer habitId={o.habitId} dateKey={o.key} onClose={() => setStack(s => s.filter(x => x !== o && x.type !== 'value'))} /></div>
          default: return null
        }
      })}
      {top?.type === 'value' && <ValueSheet habitId={top.habitId} dateKey={top.key} onClose={close} onOpen={o => setStack(s => (o.type === 'timer' ? [...s.slice(0, -1), o] : [...s, o]))} />}
      {top?.type === 'relapse' && <RelapseSheet id={top.id} onClose={close} onToast={(text, undo) => setToast({ text, undo })} />}
      {top?.type === 'abstainEdit' && <AbstainEdit id={top.id} onClose={close} />}
      {top?.type === 'pause' && <PauseSheet onClose={close} />}
      {toast && <Toast text={toast.text} action={toast.undo ? 'Скасувати' : undefined} onAction={toast.undo} onClose={closeToast} />}
    </div>
  )
}

export default function App() {
  return <StoreProvider><Shell /></StoreProvider>
}
