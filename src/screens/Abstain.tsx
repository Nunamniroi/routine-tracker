import { useEffect, useState } from 'react'
import { useStore, uid } from '../lib/store'
import { abstainStats, fmtSpan, spanShort } from '../lib/streaks'
import { DAYS, plural, humanDate, dayKey, monthTitle, WD_SHORT } from '../lib/date'
import { QUOTES } from '../lib/quotes'
import { DndContext, DragOverlay, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { justDragged, markDragEnd } from '../ui/dragGuard'
import type { Abstain as A } from '../lib/types'
import { Chips, Icon, Label, Screen, Segmented, Sheet } from '../ui/kit'
import type { Overlay } from '../App'
import { progressColor } from '../ui/colors'
import { DAY_MILESTONES, titleOf } from '../lib/achievements'

const UNDO_MS = 10 * 60 * 1000
const DAY_MS = 86400000

function leftText(ms: number) {
  const m = Math.max(0, Math.ceil(ms / 60000))
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60
  if (d) return h ? `${d} дн ${h} год` : `${d} дн`
  if (h) return mm ? `${h} год ${mm} хв` : `${h} год`
  return `${mm} хв`
}

/** Смужка до наступного досягнення: наступна віха після рекорду, прогрес — поточна серія. */
function NextGoal({ currentMs, recordMs }: { currentMs: number; recordMs: number }) {
  const best = Math.floor(recordMs / DAY_MS)
  const next = DAY_MILESTONES.find(n => n > best)
  if (!next) return <div className="row-between small"><span className="fire b">Усі досягнення здобуто</span><span /></div>
  const p = Math.min(1, currentMs / (next * DAY_MS))
  return (
    <>
      <div className="bar goal"><div className="bar-fill" style={{ width: `${Math.max(2, p * 100)}%`, background: progressColor(p) }} /></div>
      <div className="row-between small">
        <span className="muted">До «{titleOf(next, 'days')}» — ще <b className="txt">{leftText(next * DAY_MS - currentMs)}</b></span>
        <span className="b" style={{ color: progressColor(p) }}>{Math.floor(p * 100)}%</span>
      </div>
    </>
  )
}

export function spanText(ms: number) {
  const { days, hours } = fmtSpan(ms)
  return { days, hours, unit: plural(days, DAYS) }
}

function useTick() {
  const [t, setT] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setT(Date.now()), 1000)
    const onVis = () => setT(Date.now())
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis) }
  }, [])
  return t
}

const p2 = (n: number) => String(n).padStart(2, '0')
const WD = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']
function startText(ts: number) {
  const d = new Date(ts)
  return `${WD[d.getDay()]}, ${humanDate(dayKey(ts, 0), false)} ${d.getFullYear() !== new Date().getFullYear() ? d.getFullYear() + ' ' : ''}· ${p2(d.getHours())}:${p2(d.getMinutes())}`
}
function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000)) % 86400
  return `${p2(Math.floor(s / 3600))}:${p2(Math.floor((s % 3600) / 60))}:${p2(s % 60)}`
}

function QuoteRotator() {
  const [i, setI] = useState(() => Math.floor(Math.random() * QUOTES.length))
  const [shown, setShown] = useState(true)
  const next = () => { setShown(false); setTimeout(() => { setI(x => (x + 1) % QUOTES.length); setShown(true) }, 350) }
  useEffect(() => { const t = setInterval(next, 30000); return () => clearInterval(t) }, [])
  const [text, src] = QUOTES[i]
  return (
    <button className={'quote' + (shown ? ' on' : '')} onClick={next}>
      <span className="quote-text">«{text}»</span>
      <span className="quote-src">— {src}</span>
    </button>
  )
}

function AbstainCard({ a, now, onOpen }: { a: A; now: number; onOpen: (o: Overlay) => void }) {
  const { update } = useStore()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: a.id })
  const st = abstainStats(a, now)
  const cur = spanText(st.currentMs)
  const pct = st.recordMs ? Math.min(1, st.currentMs / st.recordMs) : 1
  const lastLogged = Math.max(0, ...a.relapses.map(r => r.loggedAt))
  const canUndo = now - lastLogged < UNDO_MS
  const undo = () => update(s => {
    const x = s.abstains.find(y => y.id === a.id)!
    x.relapses = x.relapses.filter(r => r.loggedAt !== lastLogged)
  })
  const stop = (e: React.SyntheticEvent) => e.stopPropagation()
  return (
    <div ref={setNodeRef} className="sortable" {...attributes} {...listeners}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 }}>
      <div className="card abst" onClick={() => { if (!justDragged()) onOpen({ type: 'abstain', id: a.id }) }}>
        <div className="row-between">
          <div>
            <div className="link-title">{a.name}</div>
            <div className="muted small">{a.relapses.length ? 'Після зриву' : 'Початок'}: {startText(st.lastStart)}</div>
          </div>
          <Icon name="chevr" size={20} color="var(--muted)" />
        </div>
        <div className="row-between">
          <div className="abst-num">
            <span className={'big-num' + (st.isRecord && a.relapses.length ? ' fire' : '')}>{cur.days}</span>
            <span className="abst-side">
              <span className="muted">{cur.unit}</span>
              <span className="clock">{clock(st.currentMs)}</span>
            </span>
          </div>
          <button className="btn-outline danger" onPointerDown={stop} onClick={e => { stop(e); onOpen({ type: 'relapse', id: a.id }) }}>Зірвався</button>
        </div>
        <NextGoal currentMs={st.currentMs} recordMs={st.recordMs} />
        <div className="small">
          {!a.relapses.length
            ? <span className="muted">Жодного зриву</span>
            : st.isRecord
            ? <span className="fire b">Новий рекорд 🔥</span>
            : st.prevBestMs < DAY_MS
            ? <span className="muted">Минула серія — {spanShort(st.prevBestMs)}</span>
            : <span className="muted">Рекорд — {spanShort(st.recordMs)} · {Math.round(pct * 100)}% від рекорду</span>}
        </div>
        {canUndo && a.relapses.length > 0 && (
          <button className="link small" onPointerDown={stop} onClick={e => { stop(e); undo() }}><Icon name="undo" size={14} /> Скасувати останній зрив</button>
        )}
      </div>
    </div>
  )
}

export function AbstainScreen({ onOpen }: { onOpen: (o: Overlay) => void }) {
  const { state, update } = useStore()
  const now = useTick()
  const list = state.abstains.filter(a => !a.archived).sort((a, b) => a.order - b.order)
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 8 } }),
  )
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null)
    markDragEnd()
    if (!over || active.id === over.id) return
    const ids = list.map(a => a.id)
    const moved = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)))
    update(s => { moved.forEach((id, i) => { s.abstains.find(x => x.id === id)!.order = i }) })
  }
  const active = list.find(a => a.id === activeId)

  return (
    <div className="page">
      <h1>Не роблю</h1>
      <QuoteRotator />
      <DndContext sensors={sensors} collisionDetection={closestCenter}
        onDragStart={(e: DragStartEvent) => { setActiveId(String(e.active.id)); navigator.vibrate?.(25) }}
        onDragEnd={onDragEnd} onDragCancel={() => { setActiveId(null); markDragEnd() }}>
        <SortableContext items={list.map(a => a.id)} strategy={verticalListSortingStrategy}>
          {list.map(a => <AbstainCard key={a.id} a={a} now={now} onOpen={onOpen} />)}
        </SortableContext>
        <DragOverlay>{active ? <div className="drag-ghost"><AbstainCard a={active} now={now} onOpen={() => {}} /></div> : null}</DragOverlay>
      </DndContext>
      <button className="dashed" onClick={() => onOpen({ type: 'abstainEdit', id: null })}><Icon name="plus" size={18} /> Додати звичку</button>
    </div>
  )
}

export function AbstainDetail({ id, onClose, onOpen }: { id: string; onClose: () => void; onOpen: (o: Overlay) => void }) {
  const { state, update } = useStore()
  const now = useTick()
  const a = state.abstains.find(x => x.id === id)
  const t0 = new Date(now)
  const [ym, setYm] = useState({ y: t0.getFullYear(), m: t0.getMonth() })
  if (!a) return null
  const st = abstainStats(a, now)
  const cur = spanText(st.currentMs)
  const rels = [...a.relapses].sort((x, y) => y.at - x.at)
  const day = 86400000
  // календар
  const first = new Date(ym.y, ym.m, 1)
  const nDays = new Date(ym.y, ym.m + 1, 0).getDate()
  const lead = (first.getDay() + 6) % 7
  const relCount = (d: Date) => a.relapses.filter(r => { const x = new Date(r.at); return x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth() && x.getDate() === d.getDate() }).length
  const startDay = new Date(a.startAt); startDay.setHours(0, 0, 0, 0)
  const todayD = new Date(now); todayD.setHours(0, 0, 0, 0)
  // серії
  const bounds = [a.startAt, ...[...a.relapses].map(r => r.at).sort((x, y) => x - y), now]
  const series = bounds.slice(1).map((b, i) => b - bounds[i])
  const maxS = Math.max(1, ...series)
  const shift = (d: number) => setYm(({ y, m }) => { const n = new Date(y, m + d, 1); return { y: n.getFullYear(), m: n.getMonth() } })
  const trig: Record<string, number> = {}
  a.relapses.forEach(r => { if (r.trigger) trig[r.trigger] = (trig[r.trigger] ?? 0) + 1 })

  return (
    <Screen title={a.name} onBack={onClose} right={<button className="icon-btn" onClick={() => onOpen({ type: 'abstainEdit', id: a.id })} aria-label="Редагувати"><Icon name="edit" size={20} color="var(--muted)" /></button>}>
      <div className="card">
        <div className="muted small">{a.relapses.length ? 'Після зриву' : 'Початок'}: {startText(st.lastStart)}</div>
        <div className="abst-num">
          <span className={'big-num' + (st.isRecord && a.relapses.length ? ' fire' : '')}>{cur.days}</span>
          <span className="abst-side"><span className="muted">{cur.unit}</span><span className="clock">{clock(st.currentMs)}</span></span>
        </div>
        <NextGoal currentMs={st.currentMs} recordMs={st.recordMs} />
        <button className="btn danger-fill" style={{ marginTop: 6 }} onClick={() => onOpen({ type: 'relapse', id: a.id })}>Зірвався</button>
      </div>
      <div className="card trio4">
        <div><div className="muted small">Рекорд</div><b>{spanShort(st.recordMs, true)}</b></div>
        <div><div className="muted small">Зривів усього</div><b>{a.relapses.length}</b></div>
        <div><div className="muted small">За місяць</div><b>{st.relapsesThisMonth}</b></div>
        <div><div className="muted small">Сер. серія</div><b>{st.avgSeriesMs != null ? spanShort(st.avgSeriesMs, true) : '—'}</b></div>
      </div>
      <div className="card">
        <div className="cal-head">
          <button className="icon-btn" onClick={() => shift(-1)}><Icon name="chev" /></button>
          <b>{monthTitle(ym.y, ym.m)}</b>
          <button className="icon-btn" onClick={() => shift(1)}><Icon name="chevr" /></button>
        </div>
        <div className="cal">
          {WD_SHORT.map(w => <div key={w} className="cal-wd">{w}</div>)}
          {Array.from({ length: lead }, (_, i) => <div key={'e' + i} />)}
          {Array.from({ length: nDays }, (_, i) => {
            const d = new Date(ym.y, ym.m, i + 1)
            const n = relCount(d)
            const cls = d > todayD || d < startDay ? 'future' : n ? 'empty' : d.getTime() === todayD.getTime() ? 'today' : 'full'
            return <div key={i} className={'cal-cell ' + cls + (n && d.getTime() === todayD.getTime() ? ' today-ring' : '')}>{i + 1}{n > 1 ? <sup>×{n}</sup> : null}</div>
          })}
        </div>
        <div className="legend"><span><i className="dot full" />Без зриву</span><span><i className="dot empty" />Зрив</span><span><i className="dot today" />Сьогодні</span></div>
      </div>
      {series.length > 1 && maxS >= day && (
        <div className="card">
          <b>Серії</b>
          <div className="bars tall">
            {series.slice(-14).map((v, i, arr) => (
              <div key={i} className="barcol">
                <span className="barlbl">{Math.floor(v / day)}</span>
                <div className={'barv' + (i === arr.length - 1 ? ' last' : '')} style={{ height: `${Math.max(4, (v / maxS) * 100)}%` }} />
              </div>
            ))}
          </div>
          <div className="muted small">Дні між зривами; помаранчева — поточна серія</div>
        </div>
      )}
      {Object.keys(trig).length > 0 && (
        <div className="card"><b>Тригери</b>
          {Object.entries(trig).sort((x, y) => y[1] - x[1]).map(([k, v]) => (
            <div key={k} className="row-between"><span>{k}</span><span className="muted">×{v}</span></div>
          ))}
        </div>
      )}
      <div className="sub-head b">Історія зривів</div>
      {rels.length ? (
        <div className="card list">
          {rels.map(r => (
            <div className="list-row" key={r.loggedAt + '-' + r.at}>
              <div className="list-main">
                <div>{startText(r.at)}</div>
                {(r.trigger || r.note) && <div className="muted small">{[r.trigger, r.note].filter(Boolean).join(' — ')}</div>}
              </div>
              <button className="icon-btn sm" aria-label="Видалити зрив" onClick={() => {
                if (confirm('Видалити цей зрив з історії? Серії перерахуються.')) update(s => { const x = s.abstains.find(y => y.id === a.id)!; x.relapses = x.relapses.filter(q => !(q.at === r.at && q.loggedAt === r.loggedAt)) })
              }}><Icon name="trash" size={18} color="var(--muted)" /></button>
            </div>
          ))}
        </div>
      ) : <div className="muted center pad">Жодного зриву 💪</div>}
    </Screen>
  )
}

const TRIGGERS = ['Стрес', 'Втома', 'Компанія', 'Нудьга', 'Голод', 'Свято', 'Інше']

function toLocalInput(ts: number) {
  const d = new Date(ts - new Date().getTimezoneOffset() * 60000)
  return d.toISOString().slice(0, 16)
}

export function RelapseSheet({ id, onClose, onToast }: { id: string; onClose: () => void; onToast: (t: string, undo?: () => void) => void }) {
  const { state, now, update } = useStore()
  const a = state.abstains.find(x => x.id === id)
  const [when, setWhen] = useState<'now' | 'other'>('now')
  const [at, setAt] = useState(toLocalInput(now))
  const [trigger, setTrigger] = useState<string | null>(null)
  const [note, setNote] = useState('')
  if (!a) return null
  const st = abstainStats(a, now)
  const cur = spanText(st.currentMs)
  const ts = when === 'now' ? Date.now() : new Date(at).getTime()
  const valid = !isNaN(ts) && ts >= st.lastStart && ts <= Date.now() + 60000

  const confirm = () => {
    const loggedAt = Date.now()
    update(s => { s.abstains.find(x => x.id === id)!.relapses.push({ at: ts, loggedAt, trigger: trigger ?? undefined, note: note || undefined }) })
    onToast(`${a.name}: серію обнулено`, () => update(s => {
      const x = s.abstains.find(y => y.id === id)!
      x.relapses = x.relapses.filter(r => r.loggedAt !== loggedAt)
    }))
    onClose()
  }

  return (
    <Sheet open onClose={onClose} title={`Зірвався: ${a.name}?`}>
      <p className="muted">Серія {cur.days ? `${cur.days} ${cur.unit} ${cur.hours} год` : spanShort(st.currentMs)} обнулиться.<br />Рекорд {spanShort(st.recordMs)} збережеться.</p>
      <Label>Коли</Label>
      <Segmented value={when} onChange={setWhen} options={[['now', 'Зараз'], ['other', 'Інший час']]} />
      {when === 'other' && <input className="input" type="datetime-local" value={at} onChange={e => setAt(e.target.value)} />}
      <Label>Що спровокувало? (необовʼязково)</Label>
      <Chips options={TRIGGERS} value={trigger} onChange={setTrigger} />
      <input className="input" placeholder="Нотатка…" value={note} onChange={e => setNote(e.target.value)} />
      <button className="btn danger-fill" disabled={!valid} onClick={confirm}>Так, зірвався</button>
      <button className="btn ghost" onClick={onClose}>Скасувати</button>
      <div className="muted small center">Помилився? Відміна доступна 10 хв</div>
    </Sheet>
  )
}

export function AbstainEdit({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { state, now, upsertAbstain, update } = useStore()
  const ex = id ? state.abstains.find(x => x.id === id) : undefined
  const [name, setName] = useState(ex?.name ?? '')
  const [start, setStart] = useState(toLocalInput(ex?.startAt ?? now))
  const ts = new Date(start).getTime()
  const valid = name.trim() && !isNaN(ts) && ts <= Date.now() + 60000
  return (
    <Sheet open onClose={onClose} title={ex ? 'Редагувати' : 'Нова звичка «не роблю»'}>
      <Label>Назва</Label>
      <input className="input" placeholder="Напр. Солодке" value={name} onChange={e => setName(e.target.value)} autoFocus={!ex} />
      <Label>Не роблю з (можна вказати дату в минулому)</Label>
      <input className="input" type="datetime-local" value={start} onChange={e => setStart(e.target.value)} />
      <button className="btn primary" disabled={!valid} onClick={() => {
        upsertAbstain(ex ? { ...ex, name: name.trim(), startAt: ts } : { id: uid(), name: name.trim(), startAt: ts, relapses: [], order: 0 })
        onClose()
      }}>Зберегти</button>
      {ex && <button className="btn ghost danger" onClick={() => { if (confirm(`Видалити «${ex.name}» разом з історією?`)) { update(s => { s.abstains = s.abstains.filter(x => x.id !== ex.id) }); onClose() } }}>Видалити</button>}
    </Sheet>
  )
}
