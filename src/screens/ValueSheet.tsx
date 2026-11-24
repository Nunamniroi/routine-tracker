import { useState } from 'react'
import { useStore } from '../lib/store'
import { habitStreak, bestValue } from '../lib/streaks'
import { fmtDuration, humanDate } from '../lib/date'
import { Icon, Sheet, parseDuration } from '../ui/kit'
import { fmtValue, streakLabel } from './Today'
import type { Overlay } from '../App'

export function ValueSheet({ habitId, dateKey, onClose, onOpen }: { habitId: string; dateKey: string; onClose: () => void; onOpen: (o: Overlay) => void }) {
  const { state, today, setEntry } = useStore()
  const h = state.habits.find(x => x.id === habitId)
  const entry = state.days[dateKey]?.entries[habitId]
  const [text, setText] = useState(() => {
    if (entry?.value == null || !h) return ''
    return h.kind === 'time' ? fmtDuration(entry.value) : String(entry.value)
  })
  if (!h) return null
  const st = habitStreak(state, h, today)
  const best = bestValue(state, h.id)
  const parsed = h.kind === 'time' ? parseDuration(text) : text.trim() ? Number(text.replace(',', '.')) : null
  const valid = parsed != null && !isNaN(parsed) && parsed > 0

  const save = () => { if (valid) { setEntry(dateKey, h.id, { done: true, value: parsed! }); onClose() } }

  return (
    <Sheet open onClose={onClose} title={h.name}>
      <div className="muted small sheet-sub">
        <Icon name="flame" size={13} color="var(--fire)" /> {streakLabel(st.count, st.unit)}
        {best != null && <> · рекорд {fmtValue(h, best)}</>}
        {dateKey !== today && <> · {humanDate(dateKey)}</>}
      </div>

      {h.kind === 'check' && (
        <button className={'btn ' + (entry?.done ? 'ghost' : 'primary')} onClick={() => { setEntry(dateKey, h.id, entry?.done ? null : { done: true }); onClose() }}>
          {entry?.done ? 'Зняти відмітку' : 'Відмітити ✓'}
        </button>
      )}

      {h.kind === 'time' && (
        <>
          {dateKey === today && (
            <button className="btn primary" onClick={() => onOpen({ type: 'timer', habitId: h.id, key: dateKey })}>
              <Icon name="play" size={18} color="var(--bg)" /> Таймер
            </button>
          )}
          <div className="label">Або вручну (хв:сек або просто хвилини)</div>
          <div className="row gap">
            <input className="input big" inputMode="decimal" placeholder="7:00" value={text} onChange={e => setText(e.target.value)} />
            <button className="btn primary narrow" disabled={!valid} onClick={save}>Зберегти</button>
          </div>
          <div className="chips">
            {[1, 2, 5, 10, 15, 20, 30].map(m => <button key={m} className="chip" onClick={() => setText(String(m))}>{m} хв</button>)}
          </div>
        </>
      )}

      {h.kind === 'number' && (
        <>
          <div className="label">Значення{h.unit ? `, ${h.unit}` : ''}</div>
          <div className="row gap">
            <input className="input big" inputMode="decimal" placeholder="0" value={text} onChange={e => setText(e.target.value)} autoFocus />
            <button className="btn primary narrow" disabled={!valid} onClick={save}>Зберегти</button>
          </div>
        </>
      )}

      {h.kind !== 'check' && !h.valueRequired && !entry?.done && (
        <button className="btn ghost" onClick={() => { setEntry(dateKey, h.id, { done: true }); onClose() }}>Відмітити без цифри</button>
      )}
      {h.kind !== 'check' && entry?.done && (
        <button className="btn ghost danger" onClick={() => { setEntry(dateKey, h.id, null); onClose() }}>Зняти відмітку</button>
      )}
      <button className="link muted center-block" onClick={() => onOpen({ type: 'habit', habitId: h.id })}><Icon name="edit" size={14} /> Налаштування справи</button>
    </Sheet>
  )
}
