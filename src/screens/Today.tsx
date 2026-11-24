import { useState } from 'react'
import { useStore } from '../lib/store'
import { activeHabits, dayParts, globalStreak, habitStreak, isPaused, isScheduled, bestValue } from '../lib/streaks'
import type { Habit, Routine } from '../lib/types'
import { DAYS, fmtDuration, humanDate, plural } from '../lib/date'
import { Icon } from '../ui/kit'
import { MoodCard } from './MoodCard'
import type { Overlay } from '../App'

export function fmtValue(h: Habit, v?: number): string {
  if (v == null) return ''
  if (h.kind === 'time') return fmtDuration(v)
  return `${Math.round(v * 100) / 100} ${h.unit ?? ''}`.trim()
}

export function streakLabel(n: number, unit: 'days' | 'weeks') {
  return unit === 'weeks' ? `${n} ${plural(n, ['тиждень', 'тижні', 'тижнів'])}` : `${n} ${plural(n, DAYS)}`
}

export function HabitRow({ h, dateKey, onOpen }: { h: Habit; dateKey: string; onOpen: (o: Overlay) => void }) {
  const { state, today, setEntry } = useStore()
  const entry = state.days[dateKey]?.entries[h.id]
  const st = habitStreak(state, h, today)
  const done = !!entry?.done
  const grace = st.status === 'grace' && !done
  const best = h.kind !== 'check' ? bestValue(state, h.id) : null

  const toggle = () => {
    if (done) setEntry(dateKey, h.id, null)
    else if (h.valueRequired && h.kind !== 'check') onOpen({ type: 'value', habitId: h.id, key: dateKey })
    else setEntry(dateKey, h.id, { done: true, value: entry?.value })
  }

  let meta: string
  if (grace) meta = 'вчора пропуск · сьогодні треба'
  else {
    meta = streakLabel(st.count, st.unit)
    if (h.schedule.type === 'perWeek') meta += ` · ціль ${h.schedule.n}/тиж`
    if (best != null && h.kind === 'time') meta += ` · рек. ${fmtDuration(best)}`
  }

  return (
    <div className={'hrow' + (grace ? ' grace' : '')}>
      <button className={'check' + (done ? ' done' : grace ? ' grace' : '')} onClick={toggle} aria-label={done ? 'Зняти відмітку' : 'Відмітити'}>
        {done && <Icon name="check" size={16} color="var(--bg)" />}
      </button>
      <button className="hrow-body" onClick={() => onOpen({ type: 'value', habitId: h.id, key: dateKey })}>
        <div className="hrow-name">{h.name}</div>
        <div className={'hrow-meta' + (grace ? ' grace' : '')}>
          <Icon name={grace ? 'heart' : 'flame'} size={13} color={grace ? 'var(--grace)' : done ? 'var(--fire)' : 'var(--muted)'} />
          <span>{meta}</span>
        </div>
      </button>
      {h.kind !== 'check' && (
        <button className={'pill' + (entry?.value != null ? ' filled' : '')}
          onClick={() => h.kind === 'time' && entry?.value == null && h.timerMode !== 'manual' && dateKey === today
            ? onOpen({ type: 'timer', habitId: h.id, key: dateKey })
            : onOpen({ type: 'value', habitId: h.id, key: dateKey })}>
          {entry?.value != null ? fmtValue(h, entry.value) : h.kind === 'time' ? '▶ хв' : `+ ${h.unit ?? ''}`}
        </button>
      )}
    </div>
  )
}

function Section({ routine, habits, onOpen, collapsed, onToggle }: { routine: Routine; habits: Habit[]; onOpen: (o: Overlay) => void; collapsed: boolean; onToggle: () => void }) {
  const { state, today } = useStore()
  const doneN = habits.filter(h => state.days[today]?.entries[h.id]?.done).length
  const isM = routine === 'morning'
  if (!habits.length) return null
  if (collapsed) {
    return (
      <button className="collapsed" onClick={onToggle}>
        <Icon name={isM ? 'sun' : 'moon'} size={20} color={isM ? 'var(--morning)' : 'var(--evening)'} />
        <span className="collapsed-title">{isM ? 'Ранок' : 'Вечір'}</span>
        <span className={'badge ' + (doneN === habits.length ? 'done' : doneN ? 'part' : 'none')}>{doneN === habits.length ? '✓ ' : ''}{doneN} з {habits.length}</span>
        <span className="spacer" />
        <span className="muted small">розгорнути</span>
        <Icon name="chevd" size={18} color="var(--muted)" />
      </button>
    )
  }
  return (
    <div className="section">
      <button className="section-head" onClick={onToggle}>
        <Icon name={isM ? 'sun' : 'moon'} size={20} color={isM ? 'var(--morning)' : 'var(--evening)'} />
        <span className="section-title">{isM ? 'Ранок' : 'Вечір'}</span>
        <span className="spacer" />
        <span className="muted">{doneN} з {habits.length}</span>
        <Icon name="chevu" size={16} color="var(--muted)" />
      </button>
      {habits.map(h => <HabitRow key={h.id} h={h} dateKey={today} onOpen={onOpen} />)}
    </div>
  )
}

export function Today({ onOpen }: { onOpen: (o: Overlay) => void }) {
  const { state, today, now } = useStore()
  const g = globalStreak(state, today)
  const p = dayParts(state, today)
  const paused = isPaused(state, today)
  const all = activeHabits(state)
  const vis = (r: Routine) => all.filter(h => h.routine === r && (isScheduled(h, today) || state.days[today]?.entries[h.id]?.done))
  const morning = vis('morning')
  const evening = vis('evening')
  const hour = new Date(now).getHours()
  const eveningFirst = hour >= 15 || hour < state.settings.dayStartHour
  const morningAllDone = morning.length > 0 && morning.every(h => state.days[today]?.entries[h.id]?.done)
  const [manual, setManual] = useState<Record<Routine, boolean | undefined>>({ morning: undefined, evening: undefined })
  const morningCollapsed = manual.morning ?? (eveningFirst && p.morningDone > 0 || morningAllDone)
  const eveningCollapsed = manual.evening ?? false
  const toggle = (r: Routine, cur: boolean) => setManual(m => ({ ...m, [r]: !cur }))

  const showEveningNudge = !paused && hour >= 18 && p.eveningDone === 0 && evening.length > 0
  const order: Routine[] = eveningFirst ? ['evening', 'morning'] : ['morning', 'evening']

  if (!all.length) return <Empty onOpen={onOpen} />

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="muted">{humanDate(today)}</div>
          <h1>Сьогодні</h1>
        </div>
        <button className="icon-btn" onClick={() => onOpen({ type: 'settings' })} aria-label="Налаштування"><Icon name="sliders" size={24} color="var(--muted)" /></button>
      </div>

      <div className="card streak-card">
        <div>
          <div className="muted small">Загальний стрік</div>
          <div className="streak-num">
            <Icon name="flame" size={30} color="var(--fire)" />
            <span className="big-num fire">{g.count}</span>
            <span className="muted">{plural(g.count, DAYS)}</span>
          </div>
          <div className="muted small">Рекорд — {g.record} {plural(g.record, DAYS)}</div>
        </div>
        <div className="parts">
          <div className={'part' + (p.morningDone ? ' ok' : '')}><Icon name="sun" size={16} /> Ранок {p.morningDone}/{p.morningTotal}</div>
          <div className={'part' + (p.eveningDone ? ' ok' : ' ev')}><Icon name="moon" size={16} /> Вечір {p.eveningDone}/{p.eveningTotal}</div>
        </div>
      </div>

      {paused && <div className="banner pause"><Icon name="snow" size={20} /> <div><b>Пауза</b><div className="small">Сьогодні не рахується ні в плюс, ні в мінус</div></div></div>}
      {!paused && g.graceWarning && !g.todayFull && (
        <div className="banner grace"><Icon name="heart" size={20} /> <div><b>Вчора неповний день</b><div className="small">Сьогодні потрібен повний — інакше стрік обнулиться</div></div></div>
      )}
      {showEveningNudge && (
        <div className="banner evening"><Icon name="bell" size={20} /> <div>
          <b>{p.morningDone ? 'Ще жодної вечірньої справи' : 'Сьогодні ще нічого не відмічено'}</b>
          <div className="small">{p.morningDone ? 'Зроби хоча б одну — і день зарахується' : 'Для повного дня — хоча б 1 ранкова і 1 вечірня справа'}</div>
        </div></div>
      )}
      {!paused && g.todayFull && <div className="banner ok"><Icon name="check" size={18} /> <div><b>День зараховано</b><div className="small">Стрік +1</div></div></div>}

      {order.map(r => {
        const list = r === 'morning' ? morning : evening
        const col = r === 'morning' ? morningCollapsed : eveningCollapsed
        return <Section key={r} routine={r} habits={list} collapsed={col} onToggle={() => toggle(r, col)} onOpen={onOpen} />
      })}

      <MoodCard dateKey={today} />

      <button className="dashed" onClick={() => onOpen({ type: 'habit', habitId: null })}><Icon name="plus" size={18} /> Додати справу</button>
    </div>
  )
}

function Empty({ onOpen }: { onOpen: (o: Overlay) => void }) {
  return (
    <div className="page empty">
      <h1>Сьогодні</h1>
      <div className="empty-icon"><Icon name="flame" size={64} color="var(--border)" /></div>
      <h2>Почнемо з малого</h2>
      <p className="muted center">Додай 1–3 справи на ранок і 1–3 на вечір.<br />Більше — потім, коли втягнешся.</p>
      <button className="btn primary" onClick={() => onOpen({ type: 'habit', habitId: null })}>+ Додати першу справу</button>
    </div>
  )
}
