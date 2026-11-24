import { useState } from 'react'
import { useStore } from '../lib/store'
import { dayStatus, isPaused } from '../lib/streaks'
import { cmpKey, fmtDuration, humanDate, weekday } from '../lib/date'
import type { DayLog, Habit, State } from '../lib/types'
import { Icon, Screen, parseDuration } from '../ui/kit'
import { MoodCard } from './MoodCard'

const ST: Record<string, string> = { before: 'Ще без відміток', full: 'Повний день', partial: 'Неповний — пощада', empty: 'Порожній — стрік обнуляється', paused: 'Пауза', today: 'Сьогодні (ще триває)' }

export function DayEdit({ dateKey, onClose }: { dateKey: string; onClose: () => void }) {
  const { state, today, update } = useStore()
  const [draft, setDraft] = useState<DayLog>(() => JSON.parse(JSON.stringify(state.days[dateKey] ?? { entries: {} })))
  const [texts, setTexts] = useState<Record<string, string>>({})

  const habits = state.habits
    .filter(h => !h.archived || draft.entries[h.id]?.done)
    .sort((a, b) => a.order - b.order)
  const anyDone = Object.values(draft.entries).some(e => e.done)
  const backfill = anyDone && state.habits.some(h => !h.archived && cmpKey(dateKey, h.createdAt) < 0)
  const extend = (h: { archived?: boolean; createdAt: string; id: string }) =>
    anyDone && cmpKey(dateKey, h.createdAt) < 0 && (!h.archived || !!draft.entries[h.id]?.done)

  const withStart = (st: State): State => ({
    ...st,
    habits: st.habits.map(h => (extend(h) ? { ...h, createdAt: dateKey } : h)),
  })
  const tmp: State = withStart({ ...state, days: { ...state.days, [dateKey]: draft } })
  const before = dayStatus(state, dateKey, today)
  const after = dayStatus(tmp, dateKey, today)

  const toggle = (h: Habit) => setDraft(d => {
    const e = { ...d.entries }
    if (e[h.id]?.done) delete e[h.id]; else e[h.id] = { done: true, value: e[h.id]?.value }
    return { ...d, entries: e }
  })
  const setVal = (h: Habit, t: string) => {
    setTexts(x => ({ ...x, [h.id]: t }))
    const v = h.kind === 'time' ? parseDuration(t) : t.trim() ? Number(t.replace(',', '.')) : null
    setDraft(d => {
      const e = { ...d.entries }
      if (v != null && !isNaN(v) && v > 0) e[h.id] = { done: true, value: v }
      else if (e[h.id]) e[h.id] = { done: e[h.id].done }
      return { ...d, entries: e }
    })
  }
  const save = () => {
    update(s => {
      s.days[dateKey] = draft
      s.habits.forEach(h => { if (extend(h)) h.createdAt = dateKey })
    })
    onClose()
  }

  const group = (r: 'morning' | 'evening') => habits.filter(h => h.routine === r).map(h => {
    const e = draft.entries[h.id]
    const txt = texts[h.id] ?? (e?.value != null ? (h.kind === 'time' ? fmtDuration(e.value) : String(e.value)) : '')
    return (
      <div className="mini" key={h.id}>
        <button className={'check sm' + (e?.done ? ' done' : '')} onClick={() => toggle(h)}>{e?.done && <Icon name="check" size={14} color="var(--on-accent)" />}</button>
        <span className="mini-name">{h.name}{h.schedule.type === 'weekdays' && !h.schedule.days.includes(weekday(dateKey)) && <span className="muted small"> · поза розкладом</span>}</span>
        {h.kind !== 'check' && <input className="input mini-input" inputMode="decimal" placeholder={h.kind === 'time' ? 'хв:сек' : h.unit ?? ''} value={txt} onChange={ev => setVal(h, ev.target.value)} />}
      </div>
    )
  })

  return (
    <Screen title={humanDate(dateKey)} onBack={onClose}>
      <div className="card">
        <div className="muted small">Статус дня</div>
        <div className={'b status-' + after}>{before !== after ? `${ST[before] ?? before} → ${ST[after] ?? after}` : ST[after] ?? after}</div>
        {isPaused(state, dateKey) && <div className="muted small">День на паузі — не рахується.</div>}
        {backfill && <div className="muted small">Відлік рутини почнеться з цього дня: невідмічені справи цього дня рахуватимуться як пропуск.</div>}
      </div>
      <div className="sub-head b">Ранок</div>
      {group('morning')}
      <div className="sub-head b">Вечір</div>
      {group('evening')}
      <MoodCard dateKey={dateKey} draft={draft} onDraft={m => setDraft(d => ({ ...d, ...m }))} />
      <button className="btn primary" onClick={save}>Зберегти день</button>
      <div className="muted small center">Стріки перерахуються автоматично</div>
    </Screen>
  )
}
