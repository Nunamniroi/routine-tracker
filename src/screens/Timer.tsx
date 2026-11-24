import { useEffect, useRef, useState } from 'react'
import { useStore } from '../lib/store'
import { bestValue } from '../lib/streaks'
import { fmtDuration } from '../lib/date'
import { Icon, Segmented, Switch, parseDuration } from '../ui/kit'

type Mode = 'stopwatch' | 'countdown'
interface Saved { acc: number; startAt: number | null; mode: Mode; goal: number }

let audioCtx: AudioContext | null = null
function beep(freq = 880, dur = 0.18, times = 1) {
  try {
    audioCtx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const ctx = audioCtx
    for (let i = 0; i < times; i++) {
      const t = ctx.currentTime + i * (dur + 0.12)
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = freq
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      o.connect(g).connect(ctx.destination)
      o.start(t)
      o.stop(t + dur + 0.05)
    }
  } catch { /* empty */ }
  navigator.vibrate?.(times > 1 ? [200, 100, 200, 100, 400] : 120)
}

function unlockAudio() {
  try {
    audioCtx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    audioCtx.resume()
  } catch { /* empty */ }
}

const prefKey = 'timer-prefs'
function loadPrefs() {
  try { return { minute: true, goal: true, ...JSON.parse(localStorage.getItem(prefKey) || '{}') } } catch { return { minute: true, goal: true } }
}

export function Timer({ habitId, dateKey, onClose }: { habitId: string; dateKey: string; onClose: () => void }) {
  const { state, setEntry } = useStore()
  const h = state.habits.find(x => x.id === habitId)!
  const storeKey = 'timer-run-' + habitId
  const best = bestValue(state, habitId)
  const [prefs, setPrefs] = useState(loadPrefs)
  const [saved, setSaved] = useState<Saved>(() => {
    try {
      const s = JSON.parse(localStorage.getItem(storeKey) || 'null')
      if (s) return s
    } catch { /* empty */ }
    return { acc: 0, startAt: null, mode: h.goal ? 'countdown' : 'stopwatch', goal: h.goal ?? 0 }
  })
  const [now, setNow] = useState(Date.now())
  const [goalText, setGoalText] = useState(saved.goal ? fmtDuration(saved.goal) : '')
  const lastMinute = useRef(-1)
  const goalFired = useRef(false)
  const wake = useRef<WakeLockSentinel | null>(null)

  const running = saved.startAt != null
  const elapsedMs = saved.acc + (running ? now - saved.startAt! : 0)
  const elapsed = Math.floor(elapsedMs / 1000)
  const goal = saved.goal

  useEffect(() => { localStorage.setItem(storeKey, JSON.stringify(saved)) }, [saved, storeKey])
  useEffect(() => { localStorage.setItem(prefKey, JSON.stringify(prefs)) }, [prefs])

  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [running])

  // утримання екрана ввімкненим
  useEffect(() => {
    const acquire = async () => {
      try { if (running && 'wakeLock' in navigator) wake.current = await navigator.wakeLock.request('screen') } catch { /* empty */ }
    }
    acquire()
    const onVis = () => { if (document.visibilityState === 'visible') { acquire(); setNow(Date.now()) } }
    document.addEventListener('visibilitychange', onVis)
    return () => { document.removeEventListener('visibilitychange', onVis); wake.current?.release().catch(() => {}); wake.current = null }
  }, [running])

  // сигнали
  useEffect(() => {
    if (!running) return
    const min = Math.floor(elapsed / 60)
    if (prefs.minute && min > 0 && min !== lastMinute.current && elapsed % 60 < 2) { lastMinute.current = min; beep(660, 0.15, 1) }
    if (goal && prefs.goal && elapsed >= goal && !goalFired.current) { goalFired.current = true; beep(990, 0.25, 3) }
  }, [elapsed, running, goal, prefs])

  const start = () => { unlockAudio(); setSaved(s => ({ ...s, startAt: Date.now() })); goalFired.current = elapsed >= goal && goal > 0 }
  const pause = () => setSaved(s => ({ ...s, acc: s.acc + (Date.now() - (s.startAt ?? Date.now())), startAt: null }))
  const reset = () => { setSaved(s => ({ ...s, acc: 0, startAt: null })); lastMinute.current = -1; goalFired.current = false }
  const finish = () => {
    if (elapsed > 0) setEntry(dateKey, habitId, { done: true, value: elapsed })
    localStorage.removeItem(storeKey)
    onClose()
  }
  const close = () => { if (!running && elapsed === 0) localStorage.removeItem(storeKey); onClose() }

  const display = saved.mode === 'countdown' && goal ? Math.max(0, goal - elapsed) : elapsed
  const over = saved.mode === 'countdown' && goal > 0 && elapsed > goal
  const progress = goal ? Math.min(1, elapsed / goal) : (elapsed % 60) / 60
  const R = 120
  const C = 2 * Math.PI * R

  return (
    <div className="timer">
      <div className="topbar">
        <button className="icon-btn" onClick={close} aria-label="Закрити"><Icon name="x" size={24} /></button>
        <div className="topbar-title">{h.name}</div>
        <div className="topbar-right" />
      </div>
      <div className="timer-body">
        <Segmented value={saved.mode} onChange={(m: Mode) => setSaved(s => ({ ...s, mode: m }))} options={[['stopwatch', 'Секундомір'], ['countdown', 'Відлік']]} />
        <div className="ring-wrap">
          <svg viewBox="0 0 280 280" className="ring">
            <circle cx="140" cy="140" r={R} fill="none" stroke="var(--s2)" strokeWidth="14" />
            <circle cx="140" cy="140" r={R} fill="none" stroke={over ? 'var(--done)' : 'var(--fire)'} strokeWidth="14" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - progress)} transform="rotate(-90 140 140)" style={{ transition: 'stroke-dashoffset .25s linear' }} />
          </svg>
          <div className="ring-center">
            {best != null && <div className="fire small b">рекорд {fmtDuration(best)}</div>}
            <div className="timer-num">{over ? '+' + fmtDuration(elapsed - goal) : fmtDuration(display)}</div>
            <div className="muted small">{goal ? (elapsed >= goal ? `ціль ${fmtDuration(goal)} ✓ · всього ${fmtDuration(elapsed)}` : `ціль ${fmtDuration(goal)} · ще ${fmtDuration(goal - elapsed)}`) : 'без цілі'}</div>
          </div>
        </div>

        <div className="card list">
          <div className="list-row"><span>Ціль</span>
            <input className="input small-input" inputMode="decimal" placeholder="—" value={goalText}
              onChange={e => { setGoalText(e.target.value); const v = parseDuration(e.target.value); setSaved(s => ({ ...s, goal: v ?? 0 })) }} />
          </div>
          <div className="list-row"><span>Звук щохвилини</span><Switch on={prefs.minute} onChange={v => setPrefs((p: typeof prefs) => ({ ...p, minute: v }))} /></div>
          <div className="list-row"><span>Сигнал на цілі</span><Switch on={prefs.goal} onChange={v => setPrefs((p: typeof prefs) => ({ ...p, goal: v }))} /></div>
        </div>
        <div className="muted small center">Екран не гасне, поки таймер іде. Якщо згорнеш застосунок — час рахується далі.</div>
      </div>

      <div className="timer-actions">
        <button className={'big-btn' + (running ? ' pause' : '')} onClick={running ? pause : start} aria-label={running ? 'Пауза' : 'Старт'}>
          {running ? <span className="pause-bars"><i /><i /></span> : <Icon name="play" size={48} color="var(--bg)" />}
        </button>
        <div className="row gap">
          <button className="btn ghost" onClick={reset} disabled={elapsed === 0}>Скинути</button>
          <button className="btn primary" onClick={finish} disabled={elapsed === 0}>Зберегти {elapsed ? fmtDuration(elapsed) : ''}</button>
        </div>
      </div>
    </div>
  )
}
