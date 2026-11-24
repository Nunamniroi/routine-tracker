import { useState } from 'react'
import { DndContext, DragOverlay, MouseSensor, TouchSensor, closestCenter, useDroppable, useSensor, useSensors, type DragEndEvent, type DragOverEvent, type DragStartEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { justDragged, markDragEnd } from '../ui/dragGuard'
import { useStore } from '../lib/store'
import { activeHabits, dayNeed, dayParts, globalStreak, habitStreak, isPaused, isScheduled, bestValue } from '../lib/streaks'
import type { Habit, Routine } from '../lib/types'
import { DAYS, addDays, fmtDuration, humanDate, plural } from '../lib/date'
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
    if (justDragged()) return
    if (done) setEntry(dateKey, h.id, null)
    else if (h.valueRequired && h.kind !== 'check') onOpen({ type: 'value', habitId: h.id, key: dateKey })
    else setEntry(dateKey, h.id, { done: true, value: entry?.value })
  }

  let meta: string
  if (grace) meta = 'пощада — зроби сьогодні'
  else {
    meta = streakLabel(st.count, st.unit)
    if (h.schedule.type === 'perWeek') meta += ` · ціль ${h.schedule.n}/тиж`
    if (best != null && h.kind === 'time') meta += ` · рек. ${fmtDuration(best)}`
  }

  return (
    <div className={'hrow' + (grace ? ' grace' : '')}>
      <button className={'check' + (done ? ' done' : grace ? ' grace' : '')} onClick={toggle} aria-label={done ? 'Зняти відмітку' : 'Відмітити'}>
        {done && <Icon name="check" size={16} color="var(--on-accent)" />}
      </button>
      <button className="hrow-body" onClick={() => { if (!justDragged()) onOpen({ type: 'value', habitId: h.id, key: dateKey }) }}>
        <div className="hrow-name">{h.name}</div>
        <div className={'hrow-meta' + (grace ? ' grace' : '')}>
          <Icon name={grace ? 'heart' : 'flame'} size={15} color={grace ? 'var(--grace)' : done ? 'var(--fire)' : 'var(--muted)'} />
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

function SortableRow({ h, dateKey, onOpen }: { h: Habit; dateKey: string; onOpen: (o: Overlay) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: h.id })
  return (
    <div ref={setNodeRef} className="sortable" {...attributes} {...listeners}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 }}>
      <HabitRow h={h} dateKey={dateKey} onOpen={onOpen} />
    </div>
  )
}

function Section({ routine, habits, onOpen, collapsed, onToggle, dragging }: { routine: Routine; habits: Habit[]; onOpen: (o: Overlay) => void; collapsed: boolean; onToggle: () => void; dragging: boolean }) {
  const { state, today } = useStore()
  const { setNodeRef, isOver } = useDroppable({ id: routine })
  const doneN = habits.filter(h => state.days[today]?.entries[h.id]?.done).length
  const isM = routine === 'morning'
  if (!habits.length && !dragging) return null
  if (collapsed && !dragging) {
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
    <div className={'section' + (dragging && isOver ? ' drop-over' : '')} ref={setNodeRef}>
      <button className="section-head" onClick={onToggle} disabled={dragging}>
        <Icon name={isM ? 'sun' : 'moon'} size={20} color={isM ? 'var(--morning)' : 'var(--evening)'} />
        <span className="section-title">{isM ? 'Ранок' : 'Вечір'}</span>
        <span className="spacer" />
        <span className="muted">{doneN} з {habits.length}</span>
        <Icon name="chevu" size={16} color="var(--muted)" />
      </button>
      <SortableContext id={routine} items={habits.map(h => h.id)} strategy={verticalListSortingStrategy}>
        {habits.map(h => <SortableRow key={h.id} h={h} dateKey={today} onOpen={onOpen} />)}
      </SortableContext>
      {dragging && !habits.length && <div className="drop-empty">Перетягни сюди</div>}
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
  // авто-згортання вирішуємо лише при відкритті екрана — щоб секція не зникала з-під пальця
  const [autoCollapse] = useState(() => eveningFirst && p.morningDone > 0 || morningAllDone)
  const morningCollapsed = manual.morning ?? autoCollapse
  const eveningCollapsed = manual.evening ?? false
  const toggle = (r: Routine, cur: boolean) => setManual(m => ({ ...m, [r]: !cur }))

  const { update } = useStore()
  const [drag, setDrag] = useState<{ id: string; items: Record<Routine, string[]> } | null>(null)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 8 } }),
  )
  const base: Record<Routine, string[]> = { morning: morning.map(h => h.id), evening: evening.map(h => h.id) }
  const cur = drag?.items ?? base
  const byId = (id: string) => all.find(h => h.id === id)!
  const findC = (id: string, items: Record<Routine, string[]>): Routine | null =>
    id === 'morning' || id === 'evening' ? id : items.morning.includes(id) ? 'morning' : items.evening.includes(id) ? 'evening' : null

  const onDragStart = (e: DragStartEvent) => { setDrag({ id: String(e.active.id), items: base }); navigator.vibrate?.(25) }
  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || !drag) return
    const id = String(active.id), overId = String(over.id)
    setDrag(d => {
      if (!d) return d
      const a = findC(id, d.items), o = findC(overId, d.items)
      if (!a || !o || a === o) return d
      const from = d.items[a].filter(x => x !== id)
      const idx = d.items[o].indexOf(overId)
      const to = [...d.items[o]]
      to.splice(idx < 0 ? to.length : idx, 0, id)
      return { ...d, items: { ...d.items, [a]: from, [o]: to } }
    })
  }
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    markDragEnd()
    if (!drag) return
    let items = drag.items
    const id = String(active.id)
    if (over) {
      const a = findC(id, items), o = findC(String(over.id), items)
      if (a && a === o) {
        const oi = items[a].indexOf(id), ni = items[a].indexOf(String(over.id))
        if (ni >= 0 && oi !== ni) items = { ...items, [a]: arrayMove(items[a], oi, ni) }
      }
    }
    setDrag(null)
    if (JSON.stringify(items) === JSON.stringify(base)) return
    update(s => {
      const shown = new Set([...items.morning, ...items.evening])
      const hidden = (r: Routine) => s.habits.filter(h => !h.archived && h.routine === r && !shown.has(h.id)).sort((x, y) => x.order - y.order).map(h => h.id)
      const finalM = [...items.morning, ...hidden('morning')]
      const finalE = [...items.evening, ...hidden('evening')]
      let k = 0
      for (const hid of finalM) { const h = s.habits.find(x => x.id === hid)!; h.routine = 'morning'; h.order = k++ }
      for (const hid of finalE) { const h = s.habits.find(x => x.id === hid)!; h.routine = 'evening'; h.order = k++ }
    })
  }

  const need = dayNeed(state, today)
  const showEveningNudge = !paused && !g.todayFull && hour >= 18 && need.total > 0
  const needParts: string[] = []
  if (need.morning) needParts.push(`${need.morning} ${plural(need.morning, ['ранкова', 'ранкові', 'ранкових'])}`)
  if (need.evening) needParts.push(`${need.evening} ${plural(need.evening, ['вечірня', 'вечірні', 'вечірніх'])}`)
  const extra = need.total - need.morning - need.evening
  if (extra > 0) needParts.push(needParts.length ? `ще ${extra} ${extra === 1 ? 'будь-яка' : 'будь-які'}` : `${extra} ${plural(extra, ['справа', 'справи', 'справ'])}`)
  const order: Routine[] = eveningFirst ? ['evening', 'morning'] : ['morning', 'evening']

  if (!all.length) return <Empty onOpen={onOpen} />

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="muted">{humanDate(today)}</div>
          <h1>Сьогодні</h1>
          <button className="link small" onClick={() => onOpen({ type: 'day', key: addDays(today, -1) })}><Icon name="edit" size={14} /> Відмітити вчора</button>
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
          <div className={'part' + (p.morningDone ? ' ok-m' : '')}><Icon name="sun" size={16} /> Ранок {p.morningDone}/{p.morningTotal}</div>
          <div className={'part' + (p.eveningDone ? ' ok-e' : '')}><Icon name="moon" size={16} /> Вечір {p.eveningDone}/{p.eveningTotal}</div>
        </div>
      </div>

      {paused && <div className="banner pause"><Icon name="snow" size={20} /> <div><b>Пауза</b><div className="small">Сьогодні не рахується ні в плюс, ні в мінус</div></div></div>}
      {!paused && g.graceWarning && !g.todayFull && (
        <div className="banner grace"><Icon name="heart" size={20} /> <div><b>Вчора неповний день</b><div className="small">Сьогодні потрібен повний — інакше стрік обнулиться</div></div></div>
      )}
      {showEveningNudge && (
        <div className="banner evening"><Icon name="bell" size={20} /> <div>
          <b>{p.morningDone + p.eveningDone ? 'День ще не зараховано' : 'Сьогодні ще нічого не відмічено'}</b>
          <div className="small">До повного дня ще: {needParts.join(' + ')}</div>
        </div></div>
      )}
      {!paused && g.todayFull && <div className="banner ok"><Icon name="check" size={18} /> <div><b>День зараховано</b><div className="small">Стрік +1</div></div></div>}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => { setDrag(null); markDragEnd() }}>
        {order.map(r => {
          const list = cur[r].map(byId).filter(Boolean)
          const col = r === 'morning' ? morningCollapsed : eveningCollapsed
          return <Section key={r} routine={r} habits={list} collapsed={col} onToggle={() => toggle(r, col)} onOpen={onOpen} dragging={!!drag} />
        })}
        <DragOverlay>
          {drag ? <div className="drag-ghost"><HabitRow h={byId(drag.id)} dateKey={today} onOpen={() => {}} /></div> : null}
        </DragOverlay>
      </DndContext>
      {!drag && <div className="muted small center hint">Утримуй справу, щоб перетягнути</div>}

      <MoodCard dateKey={today} />

      <button className="dashed" onClick={() => onOpen({ type: 'habit', habitId: null })}><Icon name="plus" size={18} /> Додати справу</button>
    </div>
  )
}

function Empty({ onOpen }: { onOpen: (o: Overlay) => void }) {
  return (
    <div className="page empty">
      <div className="page-head">
        <h1>Сьогодні</h1>
        <button className="icon-btn" onClick={() => onOpen({ type: 'settings' })} aria-label="Налаштування"><Icon name="sliders" size={24} color="var(--muted)" /></button>
      </div>
      <div className="empty-icon"><Icon name="flame" size={64} color="var(--border)" /></div>
      <h2>Почнемо з малого</h2>
      <p className="muted center">Додай 1–3 справи на ранок і 1–3 на вечір.<br />Більше — потім, коли втягнешся.</p>
      <button className="btn primary" onClick={() => onOpen({ type: 'habit', habitId: null })}>+ Додати першу справу</button>
    </div>
  )
}
