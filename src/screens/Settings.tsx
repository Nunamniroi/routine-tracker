import { useRef, useState } from 'react'
import { useStore, uid, emptyState } from '../lib/store'
import { activeHabits, rulesOf } from '../lib/streaks'
import { addDays, cmpKey, humanDate, diffDays, plural, DAYS } from '../lib/date'
import type { Habit, HabitKind, Routine, State, TimerMode } from '../lib/types'
import { Chips, Icon, Label, Screen, Segmented, Sheet, Stepper, Switch, parseDuration } from '../ui/kit'
import { fmtDuration } from '../lib/date'
import type { Overlay } from '../App'

function download(name: string, data: string, type: string) {
  const blob = new Blob([data], { type })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

function toCSV(s: State): string {
  const esc = (v: unknown) => { const t = String(v ?? ''); return /[",\n;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t }
  const rows: string[][] = [['date', 'type', 'name', 'routine', 'done', 'value', 'unit', 'mood', 'note']]
  const keys = Object.keys(s.days).sort()
  for (const k of keys) {
    const d = s.days[k]
    for (const [id, e] of Object.entries(d.entries)) {
      const h = s.habits.find(x => x.id === id)
      if (!h) continue
      const val = e.value == null ? '' : h.kind === 'time' ? (e.value / 60).toFixed(2) : String(e.value)
      rows.push([k, 'habit', h.name, h.routine, e.done ? '1' : '0', val, h.kind === 'time' ? 'хв' : h.unit ?? '', '', ''])
    }
    if (d.mood || d.note) rows.push([k, 'mood', '', '', '', '', '', String(d.mood ?? ''), d.note ?? ''])
  }
  for (const a of s.abstains) {
    rows.push([new Date(a.startAt).toISOString(), 'abstain_start', a.name, '', '', '', '', '', ''])
    for (const r of a.relapses) rows.push([new Date(r.at).toISOString(), 'relapse', a.name, '', '', '', '', '', [r.trigger, r.note].filter(Boolean).join(' — ')])
  }
  for (const p of s.pauses) rows.push([p.from, 'pause', p.reason, '', '', '', '', '', `до ${p.to}`])
  return '﻿' + rows.map(r => r.map(esc).join(',')).join('\n')
}

export function SettingsScreen({ onClose, onOpen }: { onClose: () => void; onOpen: (o: Overlay) => void }) {
  const { state, today, update, replaceState } = useStore()
  const file = useRef<HTMLInputElement>(null)
  const st = state.settings
  const set = (fn: (s: State['settings']) => void) => update(s => fn(s.settings))
  const activePause = state.pauses.filter(p => cmpKey(p.to, today) >= 0)

  const restore = async (f: File) => {
    try {
      const data = JSON.parse(await f.text()) as State
      if (!data || data.version !== 1 || !Array.isArray(data.habits)) throw new Error('bad')
      if (confirm('Замінити всі поточні дані даними з копії?')) replaceState({ ...emptyState(), ...data })
    } catch { alert('Не вдалося прочитати файл копії') }
  }

  return (
    <Screen title="Налаштування" onBack={onClose}>
      <div className="group-title">СПРАВИ</div>
      <div className="card list">
        {activeHabits(state).map((h, i, arr) => (
          <div className="list-row" key={h.id}>
            <Icon name={h.routine === 'morning' ? 'sun' : 'moon'} size={18} color={h.routine === 'morning' ? 'var(--morning)' : 'var(--evening)'} />
            <button className="list-main" onClick={() => onOpen({ type: 'habit', habitId: h.id })}>{h.name}</button>
            <button className="icon-btn sm" disabled={i === 0} onClick={() => update(s => { const a = s.habits.find(x => x.id === h.id)!, b = s.habits.find(x => x.id === arr[i - 1].id)!; [a.order, b.order] = [b.order, a.order] })}><Icon name="chevu" size={18} /></button>
            <button className="icon-btn sm" disabled={i === arr.length - 1} onClick={() => update(s => { const a = s.habits.find(x => x.id === h.id)!, b = s.habits.find(x => x.id === arr[i + 1].id)!; [a.order, b.order] = [b.order, a.order] })}><Icon name="chevd" size={18} /></button>
          </div>
        ))}
        <button className="list-row add" onClick={() => onOpen({ type: 'habit', habitId: null })}><Icon name="plus" size={18} /> Додати справу</button>
      </div>

      <div className="group-title">НАГАДУВАННЯ</div>
      <div className="card list">
        <div className="list-row"><Icon name="bell" size={18} color="var(--morning)" /><div className="list-main"><div>Ранок</div><div className="muted small">якщо нічого не відмічено</div></div>
          <input className="input time" type="time" value={st.remindMorning.time} onChange={e => set(x => { x.remindMorning.time = e.target.value })} />
          <Switch on={st.remindMorning.on} onChange={v => set(x => { x.remindMorning.on = v })} /></div>
        <div className="list-row"><Icon name="bell" size={18} color="var(--evening)" /><div className="list-main"><div>Вечір</div><div className="muted small">якщо день ще не зараховано</div></div>
          <input className="input time" type="time" value={st.remindEvening.time} onChange={e => set(x => { x.remindEvening.time = e.target.value })} />
          <Switch on={st.remindEvening.on} onChange={v => set(x => { x.remindEvening.on = v })} /></div>
        <div className="note small">Push-сповіщення підключимо наступним кроком. Поки що нагадування видно банером на екрані «Сьогодні» після 18:00.</div>
      </div>

      <div className="group-title">ПРАВИЛА ПОВНОГО ДНЯ</div>
      <div className="card list">
        {(() => {
          const r = rulesOf(state)
          const hs = activeHabits(state)
          const nM = hs.filter(h => h.routine === 'morning').length
          const nE = hs.filter(h => h.routine === 'evening').length
          const setR = (patch: Partial<typeof r>) => update(x => { x.settings.rules = { ...rulesOf(x), ...patch } })
          return <>
            <div className="list-row"><Icon name="sun" size={18} color="var(--morning)" /><div className="list-main"><div>Ранкових мінімум</div><div className="muted small">з {nM}</div></div>
              <Stepper value={r.morningMin} max={nM} onChange={v => setR({ morningMin: v })} /></div>
            <div className="list-row"><Icon name="moon" size={18} color="var(--evening)" /><div className="list-main"><div>Вечірніх мінімум</div><div className="muted small">з {nE}</div></div>
              <Stepper value={r.eveningMin} max={nE} onChange={v => setR({ eveningMin: v })} /></div>
            <div className="list-row"><Icon name="check" size={18} color="var(--done)" /><div className="list-main"><div>Усього за день мінімум</div><div className="muted small">будь-яких справ, з {nM + nE}</div></div>
              <Stepper value={Math.max(r.totalMin, r.morningMin + r.eveningMin)} min={Math.max(1, r.morningMin + r.eveningMin)} max={nM + nE} onChange={v => setR({ totalMin: v })} /></div>
            <div className="list-row"><Icon name="heart" size={18} color="var(--grace)" /><div className="list-main"><div>Пощада</div><div className="muted small">1 неповний день не ламає стрік, 2 поспіль — ламають</div></div>
              <Switch on={r.grace} onChange={v => setR({ grace: v })} /></div>
            <div className="note small">Повний день: ранкових ≥ {r.morningMin}, вечірніх ≥ {r.eveningMin}, усього ≥ {Math.max(r.totalMin, r.morningMin + r.eveningMin)}. Якщо в день заплановано менше справ — вимога зменшується. Зміна правил перерахує й минулі дні.</div>
          </>
        })()}
      </div>

      <div className="group-title">ДЕНЬ І СТРІКИ</div>
      <div className="card list">
        <div className="list-row"><Icon name="moon" size={18} color="var(--muted)" /><div className="list-main"><div>Новий день починається</div><div className="muted small">справи до цього часу — у вчора</div></div>
          <select className="input time" value={st.dayStartHour} onChange={e => set(x => { x.dayStartHour = Number(e.target.value) })}>
            {[0, 1, 2, 3, 4, 5, 6].map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
          </select></div>
        <button className="list-row" onClick={() => onOpen({ type: 'pause' })}><Icon name="snow" size={18} color="var(--pause)" /><div className="list-main"><div>Пауза</div><div className="muted small">{activePause.length ? `активна: ${humanDate(activePause[0].from, false)} – ${humanDate(activePause[0].to, false)}` : 'хвороба, травма, поїздка'}</div></div><Icon name="chevr" size={18} color="var(--muted)" /></button>
      </div>

      <div className="group-title">ДАНІ</div>
      <div className="card list">
        <div className="list-row"><Icon name="wifi" size={18} color="var(--done)" /><div className="list-main"><div>Працює офлайн</div><div className="muted small">усе зберігається на цьому телефоні</div></div></div>
        <button className="list-row" onClick={() => download(`routine-${today}.csv`, toCSV(state), 'text/csv;charset=utf-8')}><Icon name="dl" size={18} color="var(--muted)" /><div className="list-main"><div>Експорт у CSV</div><div className="muted small">для Excel / Google Sheets</div></div></button>
        <button className="list-row" onClick={() => download(`routine-backup-${today}.json`, JSON.stringify(state), 'application/json')}><Icon name="up" size={18} color="var(--muted)" /><div className="list-main"><div>Зберегти резервну копію</div><div className="muted small">файл .json — зберігай у хмарі</div></div></button>
        <button className="list-row" onClick={() => file.current?.click()}><Icon name="undo" size={18} color="var(--muted)" /><div className="list-main"><div>Відновити з копії</div><div className="muted small">замінить поточні дані</div></div></button>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={e => e.target.files?.[0] && restore(e.target.files[0])} />
      </div>
      <div className="muted small center pad">Трекер рутини · v1</div>
    </Screen>
  )
}

export function PauseSheet({ onClose }: { onClose: () => void }) {
  const { state, today, addPause, update } = useStore()
  const [reason, setReason] = useState<string | null>('Хвороба')
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(addDays(today, 3))
  const n = diffDays(to, from) + 1
  const valid = n >= 1 && n <= 60
  const list = [...state.pauses].sort((a, b) => cmpKey(b.from, a.from)).slice(0, 5)
  return (
    <Sheet open onClose={onClose} title={<><Icon name="snow" size={22} color="var(--pause)" /> Пауза</>}>
      <p className="muted">Ці дні не рахуються ні в плюс, ні в мінус. У календарі — блакитні. «Не роблю» паузу не отримують — лише рутина.</p>
      <Label>Причина</Label>
      <Chips options={['Хвороба', 'Травма', 'Поїздка', 'Інше']} value={reason} onChange={setReason} color="pause" />
      <div className="row gap">
        <div className="grow"><Label>З</Label><input className="input" type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div className="grow"><Label>По</Label><input className="input" type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
      </div>
      <button className="btn pause-fill" disabled={!valid} onClick={() => { addPause({ from, to, reason: reason ?? 'Інше' }); onClose() }}>
        Поставити паузу на {n} {plural(n, DAYS)}
      </button>
      {list.length > 0 && <>
        <Label>Паузи</Label>
        {list.map(p => (
          <div className="list-row" key={p.id}>
            <span className="list-main">{p.reason}: {humanDate(p.from, false)} – {humanDate(p.to, false)}</span>
            {cmpKey(p.to, today) >= 0 && <button className="link small" onClick={() => update(s => { const x = s.pauses.find(y => y.id === p.id)!; if (cmpKey(x.from, today) > 0) s.pauses = s.pauses.filter(y => y.id !== p.id); else x.to = addDays(today, -1) })}>Завершити</button>}
          </div>
        ))}
      </>}
    </Sheet>
  )
}

export function HabitEdit({ habitId, onClose }: { habitId: string | null; onClose: () => void }) {
  const { state, today, upsertHabit, update } = useStore()
  const ex = habitId ? state.habits.find(h => h.id === habitId) : undefined
  const [h, setH] = useState<Habit>(() => ex ? JSON.parse(JSON.stringify(ex)) : {
    id: uid(), name: '', routine: 'morning', kind: 'check', schedule: { type: 'daily' }, createdAt: today, order: 0, timerMode: 'both',
  })
  const [goalText, setGoalText] = useState(ex?.goal ? (ex.kind === 'time' ? fmtDuration(ex.goal) : String(ex.goal)) : '')
  const p = (patch: Partial<Habit>) => setH(x => ({ ...x, ...patch }))
  const sType = h.schedule.type
  const days = h.schedule.type === 'weekdays' ? h.schedule.days : []
  const valid = h.name.trim().length > 0 && !(h.schedule.type === 'weekdays' && !days.length)

  const save = () => {
    const goal = goalText.trim() ? (h.kind === 'time' ? parseDuration(goalText) : Number(goalText.replace(',', '.'))) : undefined
    upsertHabit({ ...h, name: h.name.trim(), goal: goal && !isNaN(goal) ? goal : undefined })
    onClose()
  }

  return (
    <Screen title={ex ? 'Налаштування справи' : 'Нова справа'} onBack={onClose}>
      <Label>Назва</Label>
      <input className="input" value={h.name} placeholder="Напр. Холодний душ" onChange={e => p({ name: e.target.value })} autoFocus={!ex} />
      <Label>Рутина</Label>
      <Segmented value={h.routine} onChange={(v: Routine) => p({ routine: v })} options={[['morning', 'Ранок'], ['evening', 'Вечір']]} />
      <Label>Що записувати</Label>
      <Segmented value={h.kind} onChange={(v: HabitKind) => p({ kind: v })} options={[['check', 'Відмітка'], ['time', 'Час'], ['number', 'Число']]} />
      {h.kind === 'time' && <>
        <Label>Як вводити час</Label>
        <Segmented value={h.timerMode ?? 'both'} onChange={(v: TimerMode) => p({ timerMode: v })} options={[['timer', 'Таймер'], ['manual', 'Вручну'], ['both', 'Обидва']]} />
      </>}
      {h.kind === 'number' && <>
        <Label>Одиниця</Label>
        <input className="input" value={h.unit ?? ''} placeholder="км, повтори…" onChange={e => p({ unit: e.target.value })} />
      </>}
      {h.kind !== 'check' && <>
        <Label>Ціль (необовʼязково)</Label>
        <input className="input" inputMode="decimal" value={goalText} placeholder={h.kind === 'time' ? '7:00' : '5'} onChange={e => setGoalText(e.target.value)} />
        <div className="list-row card"><div className="list-main"><div>Значення обовʼязкове</div><div className="muted small">вимкнено: галочка без цифри теж рахується</div></div>
          <Switch on={!!h.valueRequired} onChange={v => p({ valueRequired: v })} /></div>
      </>}
      <Label>Розклад</Label>
      <Segmented value={sType} onChange={(v: 'daily' | 'weekdays' | 'perWeek') => p({ schedule: v === 'daily' ? { type: 'daily' } : v === 'weekdays' ? { type: 'weekdays', days: [0, 2, 4] } : { type: 'perWeek', n: 3 } })}
        options={[['daily', 'Щодня'], ['weekdays', 'Дні тижня'], ['perWeek', 'N на тиждень']]} />
      {h.schedule.type === 'weekdays' && (
        <div className="wd-row">
          {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map((d, i) => (
            <button key={d} className={'wd' + (days.includes(i) ? ' on' : '')}
              onClick={() => p({ schedule: { type: 'weekdays', days: days.includes(i) ? days.filter(x => x !== i) : [...days, i].sort() } })}>{d}</button>
          ))}
        </div>
      )}
      {h.schedule.type === 'perWeek' && (
        <div className="row gap center-items">
          <button className="btn ghost narrow" onClick={() => p({ schedule: { type: 'perWeek', n: Math.max(1, (h.schedule as { n: number }).n - 1) } })}>−</button>
          <b className="big-num sm">{h.schedule.n}</b><span className="muted">рази на тиждень</span>
          <button className="btn ghost narrow" onClick={() => p({ schedule: { type: 'perWeek', n: Math.min(7, (h.schedule as { n: number }).n + 1) } })}>+</button>
        </div>
      )}
      <div className="note small">{sType === 'perWeek' ? 'Стрік рахується тижнями: тиждень зараховано, якщо виконав N разів.' : 'У дні поза розкладом справа не рахується як пропуск і не ламає стрік.'}</div>
      <button className="btn primary" disabled={!valid} onClick={save}>Зберегти</button>
      {ex && <button className="btn ghost danger" onClick={() => {
        if (confirm(`Архівувати «${ex.name}»? Історія збережеться, але справа зникне зі списку.`)) { update(s => { s.habits.find(x => x.id === ex.id)!.archived = true }); onClose() }
      }}>Архівувати справу</button>}
    </Screen>
  )
}
