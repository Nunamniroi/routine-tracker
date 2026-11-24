import { useState } from 'react'
import { useStore } from '../lib/store'
import { abstainStats, activeHabits, dayStatus, fmtSpan, spanShort, globalStreak, habitDots, habitStreak, moodEffects, valuesSeries, bestValue } from '../lib/streaks'
import { DAYS, WD_SHORT, addDays, fmtKey, monthTitle, plural, weekday, dayKey, fmtDuration, humanDate } from '../lib/date'
import { Icon, Segmented } from '../ui/kit'
import { fmtValue, streakLabel } from './Today'
import type { Overlay } from '../App'
import { moodColor } from '../ui/colors'

type Tab = 'routine' | 'abstain' | 'mood'

export function Stats({ onOpen }: { onOpen: (o: Overlay) => void }) {
  const [tab, setTab] = useState<Tab>('routine')
  return (
    <div className="page">
      <h1>Статистика</h1>
      <Segmented value={tab} onChange={setTab} options={[['routine', 'Рутина'], ['abstain', 'Не роблю'], ['mood', 'Самопочуття']]} />
      {tab === 'routine' && <RoutineStats onOpen={onOpen} />}
      {tab === 'abstain' && <AbstainStatsView />}
      {tab === 'mood' && <MoodStats onOpen={onOpen} />}
    </div>
  )
}

function useMonth(today: string) {
  const t = new Date(today + 'T12:00:00')
  const [ym, setYm] = useState({ y: t.getFullYear(), m: t.getMonth() })
  const shift = (d: number) => setYm(({ y, m }) => { const n = new Date(y, m + d, 1); return { y: n.getFullYear(), m: n.getMonth() } })
  return { ...ym, shift }
}

function RoutineStats({ onOpen }: { onOpen: (o: Overlay) => void }) {
  const { state, today } = useStore()
  const { y, m, shift } = useMonth(today)
  const g = globalStreak(state, today)
  const first = fmtKey(new Date(y, m, 1, 12))
  const nDays = new Date(y, m + 1, 0).getDate()
  const lead = weekday(first)
  const counts = { full: 0, partial: 0, empty: 0, paused: 0 }
  const cells = Array.from({ length: nDays }, (_, i) => {
    const key = addDays(first, i)
    const st = dayStatus(state, key, today)
    if (st in counts) counts[st as keyof typeof counts]++
    return { key, st, d: i + 1 }
  })
  const [open, setOpen] = useState<string | null>(null)

  return (
    <>
      <div className="card">
        <div className="cal-head">
          <button className="icon-btn" onClick={() => shift(-1)}><Icon name="chev" /></button>
          <b>{monthTitle(y, m)}</b>
          <button className="icon-btn" onClick={() => shift(1)}><Icon name="chevr" /></button>
        </div>
        <div className="cal">
          {WD_SHORT.map(w => <div key={w} className="cal-wd">{w}</div>)}
          {Array.from({ length: lead }, (_, i) => <div key={'e' + i} />)}
          {cells.map(c => (
            <button key={c.key} className={`cal-cell ${c.st}`} disabled={c.st === 'future'}
              onClick={() => onOpen({ type: 'day', key: c.key })}>{c.d}</button>
          ))}
        </div>
        <div className="legend">
          <span><i className="dot full" />Повний</span><span><i className="dot partial" />Пощада</span>
          <span><i className="dot empty" />Зрив</span><span><i className="dot paused" />Пауза</span>
        </div>
        <div className="muted small">Стрік {g.count} · рекорд {g.record} · за місяць: повних {counts.full}, пощад {counts.partial}, зривів {counts.empty}</div>
        <div className="muted small">Тапни по дню, щоб змінити відмітки.</div>
      </div>

      <div className="row-between sub-head"><b>Практики</b><span className="muted small">останні 14 днів</span></div>
      {activeHabits(state).length === 0 && <div className="muted center pad">Ще немає справ — додай їх на екрані «Сьогодні».</div>}
      {activeHabits(state).map(h => {
        const st = habitStreak(state, h, today)
        const dots = habitDots(state, h, today, 14)
        const isOpen = open === h.id
        return (
          <div key={h.id} className="card stat-row">
            <button className="stat-row-head" onClick={() => setOpen(isOpen ? null : h.id)}>
              <div>
                <div>{h.name}</div>
                <div className="muted small"><Icon name="flame" size={14} color="var(--fire)" /> {streakLabel(st.count, st.unit)} · рекорд {st.record}</div>
              </div>
              <div className="dots">{dots.map((d, i) => <i key={i} className={'dot ' + d} />)}</div>
            </button>
            {isOpen && <HabitDetail habitId={h.id} />}
          </div>
        )
      })}
    </>
  )
}

function HabitDetail({ habitId }: { habitId: string }) {
  const { state, today } = useStore()
  const h = state.habits.find(x => x.id === habitId)!
  if (h.kind === 'check') {
    let n = 0
    for (let i = 0; i < 30; i++) if (state.days[addDays(today, -i)]?.entries[h.id]?.done) n++
    return <div className="muted small detail">За 30 днів: {n} {plural(n, ['раз', 'рази', 'разів'])}</div>
  }
  const vals = valuesSeries(state, habitId, today, 14)
  const max = Math.max(1, ...vals.map(v => v ?? 0))
  const best = bestValue(state, habitId)
  const filled = vals.filter((v): v is number => v != null)
  const avg = filled.length ? filled.reduce((s, x) => s + x, 0) / filled.length : null
  const sum = filled.reduce((s, x) => s + x, 0)
  return (
    <div className="detail">
      <div className="row-between small">
        <span className="muted">рекорд <b className="fire">{best != null ? fmtValue(h, best) : '—'}</b></span>
        <span className="muted">середнє {avg != null ? fmtValue(h, avg) : '—'} · всього {h.kind === 'time' ? fmtDuration(sum) : fmtValue(h, sum)}</span>
      </div>
      <div className="bars">
        {vals.map((v, i) => <div key={i} className={'barv' + (i === vals.length - 1 ? ' last' : '') + (v == null ? ' none' : '')} style={{ height: v ? `${(v / max) * 100}%` : '3px' }} />)}
      </div>
    </div>
  )
}

function AbstainStatsView() {
  const { state, now } = useStore()
  const list = state.abstains.filter(a => !a.archived)
  if (!list.length) return <div className="muted center pad">Ще немає звичок «не роблю».</div>
  const all = list.map(a => ({ a, st: abstainStats(a, now) }))
  const thisM = all.reduce((s, x) => s + x.st.relapsesThisMonth, 0)
  const prevM = all.reduce((s, x) => s + x.st.relapsesPrevMonth, 0)
  const longest = Math.max(...all.map(x => fmtSpan(x.st.recordMs).days))
  const d = new Date(now)
  const nDays = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  return (
    <>
      <div className="card row-between">
        <div><div className="muted small">Зривів цього місяця</div><div className="big-num sm">{thisM}</div><div className={'small ' + (thisM <= prevM ? 'ok-t' : 'bad-t')}>проти {prevM} минулого</div></div>
        <div className="right"><div className="muted small">Найдовша серія</div><div className="big-num sm fire">{longest}</div><div className="muted small">{plural(longest, DAYS)}</div></div>
      </div>
      {all.map(({ a, st }) => {
        const relDays = new Set(a.relapses.filter(r => new Date(r.at).getMonth() === d.getMonth() && new Date(r.at).getFullYear() === d.getFullYear()).map(r => new Date(r.at).getDate()))
        const s0 = new Date(a.startAt); s0.setHours(0, 0, 0, 0)
        const startDay = s0.getFullYear() === d.getFullYear() && s0.getMonth() === d.getMonth() ? s0.getDate() : s0 < d ? 1 : 99
        return (
          <div className="card" key={a.id}>
            <div className="row-between"><b>{a.name}</b><span className={(st.isRecord ? 'fire b' : 'b') + ' nowrap'}>зараз {spanShort(st.currentMs, true)}</span></div>
            <div className="trio">
              <div><div className="muted small">Рекорд</div><b>{spanShort(st.recordMs, true)}</b></div>
              <div><div className="muted small">Зривів за міс.</div><b>{st.relapsesThisMonth}</b></div>
              <div><div className="muted small">Середня серія</div><b>{st.avgSeriesMs != null ? spanShort(st.avgSeriesMs, true) : '—'}</b></div>
            </div>
            <div className="strip">{Array.from({ length: nDays }, (_, i) => <i key={i} className={relDays.has(i + 1) ? 'bad' : i + 1 <= d.getDate() && i + 1 >= startDay ? 'ok' : ''} />)}</div>
            <TriggerList a={a} />
          </div>
        )
      })}
    </>
  )
}

function TriggerList({ a }: { a: { relapses: { trigger?: string }[] } }) {
  const m: Record<string, number> = {}
  a.relapses.forEach(r => { if (r.trigger) m[r.trigger] = (m[r.trigger] ?? 0) + 1 })
  const e = Object.entries(m).sort((x, y) => y[1] - x[1])
  if (!e.length) return null
  return <div className="muted small">Тригери: {e.map(([k, v]) => `${k} ×${v}`).join(', ')}</div>
}

function MoodStats({ onOpen }: { onOpen: (o: Overlay) => void }) {
  const { state, today, now } = useStore()
  const [showAll, setShowAll] = useState(false)
  const notes = Object.entries(state.days).filter(([, l]) => l.note?.trim()).sort((a, b) => (a[0] < b[0] ? 1 : -1))
  const d = new Date(now)
  const first = fmtKey(new Date(d.getFullYear(), d.getMonth(), 1, 12))
  const n = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  const pts: { i: number; v: number }[] = []
  for (let i = 0; i < n; i++) { const v = state.days[addDays(first, i)]?.mood; if (v) pts.push({ i, v }) }
  const avg = pts.length ? pts.reduce((s, p) => s + p.v, 0) / pts.length : null
  const effects = moodEffects(state, today)
  const W = 320, H = 110
  const x = (i: number) => 8 + (i / (n - 1)) * (W - 16)
  const y = (v: number) => H - 8 - ((v - 1) / 4) * (H - 16)
  void dayKey
  return (
    <>
      <div className="card">
        <div className="row-between"><b>Самопочуття · цей місяць</b><span className="fire b">{avg ? `середнє ${avg.toFixed(1)}` : ''}</span></div>
        {pts.length >= 2 ? (
          <svg viewBox={`0 0 ${W} ${H}`} className="mood-chart">
            {[1, 3, 5].map(v => <line key={v} x1="0" x2={W} y1={y(v)} y2={y(v)} stroke="var(--s2)" />)}
            <path d={pts.map((p, k) => `${k ? 'L' : 'M'}${x(p.i)} ${y(p.v)}`).join('')} fill="none" stroke="var(--fire)" strokeWidth="2" strokeLinejoin="round" />
            {pts.map(p => <circle key={p.i} cx={x(p.i)} cy={y(p.v)} r="4" fill={moodColor(p.v)} />)}
          </svg>
        ) : <div className="muted small pad">Оцінюй день на екрані «Сьогодні» — тут зʼявиться графік.</div>}
      </div>
      <div className="row-between sub-head"><b>Нотатки</b><span className="muted small">{notes.length ? notes.length : ''}</span></div>
      {notes.length ? <div className="card list">
        {(showAll ? notes : notes.slice(0, 10)).map(([k, l]) => (
          <button className="list-row note-row" key={k} onClick={() => onOpen({ type: 'day', key: k })}>
            <div className="list-main">
              <div className="row-between small"><span className="muted">{humanDate(k)}</span>{l.mood ? <span className="mood-mini" style={{ background: moodColor(l.mood) }}>{l.mood}</span> : null}</div>
              <div className="note-text">{l.note}</div>
            </div>
          </button>
        ))}
        {!showAll && notes.length > 10 && <button className="link small" onClick={() => setShowAll(true)}>Показати всі ({notes.length})</button>}
      </div> : <div className="muted small pad">Нотатки з картки «Як день?» зʼявляться тут.</div>}
      <div className="row-between sub-head"><b>Що впливає</b><span className="muted small">середнє: з / без</span></div>
      {effects.length ? effects.map(e => (
        <div className="card row-between" key={e.habit.id}>
          <div><div>{e.habit.name}</div><div className="muted small">{e.withAvg.toFixed(1)} з нею · {e.withoutAvg.toFixed(1)} без</div></div>
          <span className={'badge ' + (Math.abs(e.diff) < 0.05 ? '' : e.diff > 0 ? 'done' : 'bad')}>{Math.abs(e.diff) < 0.05 ? '0.0' : (e.diff > 0 ? '+' : '−') + Math.abs(e.diff).toFixed(1)}</span>
        </div>
      )) : <div className="muted small pad">Потрібно хоча б 3 дні з практикою і 3 без неї з оцінкою самопочуття.</div>}
      <div className="muted small">Кореляція, а не доказ — але закономірність видно.</div>
    </>
  )
}
