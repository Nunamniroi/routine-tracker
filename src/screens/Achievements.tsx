import { useStore } from '../lib/store'
import { achId, nextMilestone, tierOf, titleOf, tracks, type Achievement, type Tier, type Track } from '../lib/achievements'
import { DAYS, plural } from '../lib/date'
import { Icon } from '../ui/kit'

const WEEKS: [string, string, string] = ['тиждень', 'тижні', 'тижнів']
export const unitWord = (n: number, unit: 'days' | 'weeks') => plural(n, unit === 'weeks' ? WEEKS : DAYS)

export function Badge({ n, unit, tier, locked, size = 64 }: { n: number; unit: 'days' | 'weeks'; tier: Tier; locked?: boolean; size?: number }) {
  return (
    <div className={`badge-medal ${locked ? 'locked' : tier}`} style={{ width: size, height: size }}>
      <span className="medal-num" style={{ fontSize: size * (n >= 100 ? 0.3 : 0.38) }}>{n}</span>
      <span className="medal-unit" style={{ fontSize: Math.max(9, size * 0.15) }}>{unit === 'weeks' ? 'тиж' : 'дн'}</span>
    </div>
  )
}

function TrackCard({ t, earned }: { t: Track; earned: Record<string, number> }) {
  const has = (n: number) => t.best >= n || !!earned[achId(t.scope, t.refId, n)]
  const got = t.milestones.filter(has)
  const next = nextMilestone(t)
  // показуємо всі отримані + 2 наступні
  const shown = [...got, ...t.milestones.filter(n => !has(n)).slice(0, 2)]
  const pct = next ? Math.min(1, t.current / next) : 1
  return (
    <div className="card ach-card">
      <div className="row-between">
        <b>{t.name}</b>
        <span className="muted small">{got.length} з {t.milestones.length}</span>
      </div>
      <div className="medals">
        {shown.map(n => (
          <div className="medal-cell" key={n}>
            <Badge n={n} unit={t.unit} tier={tierOf(n, t.unit)} locked={!has(n)} size={56} />
            <span className={'medal-title' + (has(n) ? '' : ' muted')}>{titleOf(n, t.unit)}</span>
          </div>
        ))}
      </div>
      {next ? (
        <>
          <div className="bar"><div className="bar-fill fire" style={{ width: `${Math.max(2, pct * 100)}%` }} /></div>
          <div className="row-between small">
            <span className="muted">Зараз {t.current} {unitWord(t.current, t.unit)}</span>
            <span className="muted">до «{titleOf(next, t.unit)}» ще {next - t.current} {unitWord(next - t.current, t.unit)}</span>
          </div>
        </>
      ) : <div className="fire small b">Усі досягнення здобуто 🔥</div>}
    </div>
  )
}

export function AchievementsScreen() {
  const { state, today, now } = useStore()
  const earned = state.achievements ?? {}
  const ts = tracks(state, today, now)
  const total = ts.reduce((s, t) => s + t.milestones.length, 0)
  const got = ts.reduce((s, t) => s + t.milestones.filter(n => t.best >= n || earned[achId(t.scope, t.refId, n)]).length, 0)
  const recent = Object.entries(earned).sort((a, b) => b[1] - a[1] || Number(b[0].split(':')[2]) - Number(a[0].split(':')[2])).slice(0, 5).map(([id, at]) => {
    const [scope, refId, nStr] = id.split(':')
    const t = ts.find(x => x.scope === scope && x.refId === refId)
    return t ? { id, at, t, n: Number(nStr) } : null
  }).filter(Boolean) as { id: string; at: number; t: Track; n: number }[]

  const group = (scope: Track['scope'], title: string) => {
    const list = ts.filter(t => t.scope === scope)
    if (!list.length) return null
    return <>
      <div className="group-title">{title}</div>
      {list.map(t => <TrackCard key={t.scope + t.refId} t={t} earned={earned} />)}
    </>
  }

  return (
    <div className="page">
      <h1>Досягнення</h1>
      <div className="card row-between">
        <div><div className="muted small">Здобуто</div><div className="big-num sm">{got}<span className="muted small"> / {total}</span></div></div>
        <Icon name="trophy" size={40} color="var(--grace)" />
      </div>
      {recent.length > 0 && <>
        <div className="group-title">ОСТАННІ</div>
        <div className="card list">
          {recent.map(r => (
            <div className="list-row" key={r.id}>
              <Badge n={r.n} unit={r.t.unit} tier={tierOf(r.n, r.t.unit)} size={40} />
              <div className="list-main"><div>{titleOf(r.n, r.t.unit)}</div><div className="muted small">{r.t.name} · {new Date(r.at).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })}</div></div>
            </div>
          ))}
        </div>
      </>}
      {group('global', 'ЗАГАЛЬНИЙ СТРІК')}
      {group('habit', 'СПРАВИ')}
      {group('abst', 'НЕ РОБЛЮ')}
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
