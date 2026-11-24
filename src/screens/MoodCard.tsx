import { useRef, useState } from 'react'
import { Icon } from '../ui/kit'
import { moodColor } from '../ui/colors'
import { useStore } from '../lib/store'

export function MoodCard({ dateKey, draft, onDraft }: {
  dateKey: string
  draft?: { mood?: number; note?: string }
  onDraft?: (d: { mood?: number; note?: string }) => void
}) {
  const { state, update } = useStore()
  const log = state.days[dateKey]
  const mood = draft ? draft.mood : log?.mood
  const note = draft ? draft.note : log?.note
  const [noteOpen, setNoteOpen] = useState(!!note)
  const [focused, setFocused] = useState(false)
  const ta = useRef<HTMLTextAreaElement>(null)

  const setMood = (m: number | undefined) => {
    if (onDraft) return onDraft({ mood: m, note })
    update(s => { s.days[dateKey] ??= { entries: {} }; s.days[dateKey].mood = m })
  }
  const setNote = (n: string) => {
    if (onDraft) return onDraft({ mood, note: n })
    update(s => { s.days[dateKey] ??= { entries: {} }; s.days[dateKey].note = n || undefined })
  }

  return (
    <div className="card mood">
      <div className="row-between">
        <b>Як день?</b>
        <span className="muted small">енергія / настрій</span>
      </div>
      <div className="mood-row">
        {[1, 2, 3, 4, 5].map(i => (
          <button key={i} className={'mood-dot' + (mood === i ? ' on' : '')} style={mood === i ? { background: moodColor(i) } : undefined} onClick={() => setMood(mood === i ? undefined : i)}>{i}</button>
        ))}
      </div>
      {noteOpen
        ? <>
          <textarea ref={ta} className="input" rows={2} placeholder="Нотатка…" value={note ?? ''} onChange={e => setNote(e.target.value)}
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
          {(focused || (!draft && note)) && (
            <div className="row-between small">
              <span className="muted">{draft ? 'Збережеться разом із днем' : note ? <><Icon name="check" size={14} color="var(--done)" /> Збережено</> : ''}</span>
              {focused && <button className="link small" onMouseDown={e => e.preventDefault()} onClick={() => ta.current?.blur()}>Готово</button>}
            </div>
          )}
        </>
        : <button className="link muted small" onClick={() => setNoteOpen(true)}>+ нотатка (необовʼязково)</button>}
    </div>
  )
}
