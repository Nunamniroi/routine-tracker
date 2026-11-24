import { useState } from 'react'
import { useStore } from '../lib/store'
import { achId, nextMilestone, tierOf, titleOf, tracks, type Achievement, type Tier, type Track } from '../lib/achievements'
import { DAYS, plural } from '../lib/date'
import { Icon, Segmented } from '../ui/kit'

const WEEKS: [string, string, string] = ['тиждень', 'тижні', 'тижнів']
/** родовий відмінок після «до»: до 21 дня, до 30 днів */
const genWord = (n: number, unit: 'days' | 'weeks') => (n % 10 === 1 && n % 100 !== 11) ? (unit === 'weeks' ? 'тижня' : 'дня') : (unit === 'weeks' ? 'тижнів' : 'днів')
export const unitWord = (n: number, unit: 'days' | 'weeks') => plural(n, unit === 'weeks' ? WEEKS : DAYS)

export function Badge({ n, unit, tier, locked, size = 64 }: { n: number; unit: 'days' | 'weeks'; tier: Tier; locked?: boolean; size?: number }) {
  return (
    <div className={`badge-medal ${locked ? 'locked' : tier}`} style={{ width: size, height: size }}>
      <span className="medal-num" style={{ fontSize: size * (n >= 100 ? 0.3 : 0.38) }}>{n}</span>
      <span className="medal-unit" style={{ fontSize: Math.max(9, size * 0.15) }}>{unit === 'weeks' ? 'тиж' : 'дн'}</span>
    </div>
  )
}

function TrackCard({ t, earned, defaultOpen }: { t: Track; earned: Record<string, number>; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen)
  const has = (n: number) => t.best >= n || !!earned[achId(t.scope, t.refId, n)]
  const got = t.milestones.filter(has)
  const last = got[got.length - 1]
  const next = nextMilestone(t)
  const shown = [...got, ...t.milestones.filter(n => !has(n)).slice(0, 2)]
  const pct = next ? Math.min(1, t.current / next) : 1
  return (
    <div className="card ach-card">
      <button className="ach-head" onClick={() => setOpen(!open)}>
        {last
          ? <Badge n={last} unit={t.unit} tier={tierOf(last, t.unit)} size={46} />
          : <Badge n={next ?? 1} unit={t.unit} tier="bronze" locked size={46} />}
        <div className="ach-head-main">
          <div className="ach-name">{t.name}</div>
          <div className="muted small">
            {next ? <>до {next} {genWord(next, t.unit)} — ще {next - t.current}</> : 'усе здобуто 🔥'}
          </div>
          {next && <div className="bar thin"><div className="bar-fill fire" style={{ width: `${Math.max(2, pct * 100)}%` }} /></div>}
        </div>
        <span className="ach-count">{got.length}/{t.milestones.length}</span>
        <Icon name={open ? 'chevu' : 'chevd'} size={18} color="var(--muted)" />
      </button>
      {open && (
        <div className="medals">
          {shown.map(n => (
            <div className="medal-cell" key={n}>
              <Badge n={n} unit={t.unit} tier={tierOf(n, t.unit)} locked={!has(n)} size={56} />
              <span className={'medal-title' + (has(n) ? '' : ' muted')}>{titleOf(n, t.unit)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

type Tab = 'habit' | 'abst'

export function AchievementsScreen() {
  const { state, today, now } = useStore()
  const [tab, setTab] = useState<Tab>('habit')
  const earned = state.achievements ?? {}
  const ts = tracks(state, today, now)
  const total = ts.reduce((s, t) => s + t.milestones.length, 0)
  const got = ts.reduce((s, t) => s + t.milestones.filter(n => t.best >= n || earned[achId(t.scope, t.refId, n)]).length, 0)
  const lastEntry = Object.entries(earned).sort((a, b) => b[1] - a[1] || Number(b[0].split(':')[2]) - Number(a[0].split(':')[2]))
    .map(([id]) => { const [scope, refId, n] = id.split(':'); const t = ts.find(x => x.scope === scope && x.refId === refId); return t ? { t, n: Number(n) } : null })
    .find(Boolean)
  const list = ts.filter(t => t.scope === tab)
  const globalTrack = ts.find(t => t.scope === 'global')

  return (
    <div className="page">
      <h1>Досягнення</h1>
      <div className="card row-between">
        <div>
          <div className="muted small">Здобуто</div>
          <div className="big-num sm">{got}<span className="muted small"> / {total}</span></div>
          {lastEntry && <div className="muted small">Останнє: {titleOf(lastEntry.n, lastEntry.t.unit)} · {lastEntry.t.name}</div>}
        </div>
        <Icon name="trophy" size={40} color="var(--grace)" />
      </div>
      {globalTrack && <TrackCard t={globalTrack} earned={earned} />}
      <Segmented value={tab} onChange={setTab} options={[['habit', 'Справи'], ['abst', 'Не роблю']]} />
      {list.length
        ? list.map(t => <TrackCard key={t.scope + t.refId} t={t} earned={earned} />)
        : <div className="muted center pad">Тут поки порожньо.</div>}
    </div>
  )
}

export function Celebration({ a, more, onClose }: { a: Achievement; more: number; onClose: () => void }) {
  return (
    <div className="celebrate" onClick={onClose}>
      <div className="celebrate-card" onClick={e => e.stopPropagation()}>
        <div className="muted small b">НОВЕ ДОСЯГНЕННЯ</div>
        <div className="celebrate-medal"><Badge n={a.n} unit={a.unit} tier={a.tier} size={120} /></div>
        <h2>{a.title}</h2>
        <p className="muted center">{a.scope === 'global' ? 'Загальний стрік' : a.name} — {a.n} {unitWord(a.n, a.unit)}{a.scope === 'abst' ? ' без зриву' : ' поспіль'}</p>
        {more > 0 && <p className="muted small center">і ще {more} {plural(more, ['досягнення', 'досягнення', 'досягнень'])}</p>}
        <button className="btn primary" onClick={onClose}>Круто 🔥</button>
      </div>
    </div>
  )
}
