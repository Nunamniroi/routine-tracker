import { useState } from 'react'
import { useStore, uid } from '../lib/store'
import { abstainStats, fmtSpan } from '../lib/streaks'
import { DAYS, plural, humanDate, dayKey } from '../lib/date'
import type { Abstain as A } from '../lib/types'
import { Chips, Icon, Label, Segmented, Sheet } from '../ui/kit'
import type { Overlay } from '../App'

const UNDO_MS = 10 * 60 * 1000

export function spanText(ms: number) {
  const { days, hours } = fmtSpan(ms)
  return { days, hours, unit: plural(days, DAYS) }
}

export function AbstainScreen({ onOpen }: { onOpen: (o: Overlay) => void }) {
  const { state, now, update } = useStore()
  const list = state.abstains.filter(a => !a.archived).sort((a, b) => a.order - b.order)

  const undo = (a: A) => update(s => {
    const x = s.abstains.find(y => y.id === a.id)!
    const last = [...x.relapses].sort((p, q) => q.loggedAt - p.loggedAt)[0]
    x.relapses = x.relapses.filter(r => r !== last && !(r.loggedAt === last.loggedAt && r.at === last.at))
  })

  return (
    <div className="page">
      <h1>Не роблю</h1>
      <p className="muted small">Дні без зриву. Тут без пощади: зрив — з нуля.</p>
      {list.map(a => {
        const st = abstainStats(a, now)
        const cur = spanText(st.currentMs)
        const rec = fmtSpan(st.recordMs).days
        const pct = st.recordMs ? Math.min(1, st.currentMs / st.recordMs) : 1
        const lastLogged = Math.max(0, ...a.relapses.map(r => r.loggedAt))
        const canUndo = now - lastLogged < UNDO_MS
        return (
          <div className="card abst" key={a.id}>
            <div className="row-between">
              <button className="link-title" onClick={() => onOpen({ type: 'abstainEdit', id: a.id })}>{a.name}</button>
              <span className="muted small">з {humanDate(dayKey(st.lastStart, 0), false)}</span>
            </div>
            <div className="row-between">
              <div className="abst-num">
                <span className={'big-num' + (st.isRecord && a.relapses.length ? ' fire' : '')}>{cur.days}</span>
                <span className="muted">{cur.unit}{cur.days < 30 ? ` ${cur.hours} год` : ''}</span>
              </div>
              <button className="btn-outline danger" onClick={() => onOpen({ type: 'relapse', id: a.id })}>Зірвався</button>
            </div>
            <div className="bar"><div className={'bar-fill' + (st.isRecord ? ' fire' : '')} style={{ width: `${Math.max(2, pct * 100)}%` }} /></div>
            <div className="row-between small">
              {!a.relapses.length
                ? <><span className="muted">Жодного зриву</span><span /></>
                : st.isRecord
                ? <><span className="fire b">Новий рекорд</span><span className="fire">100%</span></>
                : <><span className="muted">Рекорд — {rec} {plural(rec, DAYS)}</span><span className="muted">{Math.round(pct * 100)}% до рекорду</span></>}
            </div>
            {canUndo && a.relapses.length > 0 && (
              <button className="link small" onClick={() => undo(a)}><Icon name="undo" size={14} /> Скасувати останній зрив</button>
            )}
          </div>
        )
      })}
      <button className="dashed" onClick={() => onOpen({ type: 'abstainEdit', id: null })}><Icon name="plus" size={18} /> Додати звичку</button>
    </div>
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
      <p className="muted">Серія {cur.days} {cur.unit} {cur.hours} год обнулиться.<br />Рекорд {fmtSpan(st.recordMs).days} {plural(fmtSpan(st.recordMs).days, DAYS)} збережеться.</p>
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
