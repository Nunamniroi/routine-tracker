import { useEffect, type ReactNode } from 'react'

const P: Record<string, [string, 'f' | 's' | 's3']> = {
  flame: ['M12 2c.8 3.2 4 5.3 5.6 8.4 1.9 3.8-.4 9.6-5.6 9.6s-7.4-4.6-5.8-8.4c.6-1.4 1.6-2.4 2.4-3.1.1 1.6.8 2.8 2 3.3C10.3 8.6 10.8 5 12 2z', 'f'],
  heart: ['M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z', 's'],
  check: ['M5 12.5l4.5 4.5L19 7.5', 's3'],
  sun: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4', 's'],
  moon: ['M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z', 's'],
  today: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 12.5l2.7 2.7L16 9.8', 's'],
  ban: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM5.6 5.6l12.8 12.8', 's'],
  stats: ['M5 20V11M12 20V5M19 20v-6', 's'],
  plus: ['M12 5v14M5 12h14', 's'],
  chev: ['M15 6l-6 6 6 6', 's'],
  chevr: ['M9 6l6 6-6 6', 's'],
  chevd: ['M6 9l6 6 6-6', 's'],
  chevu: ['M6 15l6-6 6 6', 's'],
  bell: ['M6 9a6 6 0 1 1 12 0c0 6 2.5 8 2.5 8h-17S6 15 6 9zM10 20.5a2 2 0 0 0 4 0', 's'],
  snow: ['M12 2v20M3.5 7l17 10M3.5 17l17-10', 's'],
  dl: ['M12 4v11M7 10l5 5 5-5M5 20h14', 's'],
  up: ['M12 19V5M6 11l6-6 6 6', 's'],
  x: ['M6 6l12 12M18 6L6 18', 's'],
  sliders: ['M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4', 's'],
  undo: ['M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3', 's'],
  wifi: ['M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0M12 20h.01', 's'],
  edit: ['M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4', 's'],
  play: ['M8 5.5v13l11-6.5z', 'f'],
  trash: ['M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13', 's'],
}

export function Icon({ name, size = 20, color = 'currentColor', className }: { name: string; size?: number; color?: string; className?: string }) {
  const [d, k] = P[name] ?? P.x
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      {k === 'f'
        ? <path d={d} fill={color} />
        : <path d={d} fill="none" stroke={color} strokeWidth={k === 's3' ? 3 : 2} strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  )
}

export function Sheet({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title?: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()} role="dialog">
        <div className="sheet-handle" />
        {title && <div className="sheet-title">{title}</div>}
        {children}
      </div>
    </div>
  )
}

export function Screen({ title, onBack, children, right }: { title: string; onBack: () => void; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="screen-overlay">
      <div className="topbar">
        <button className="icon-btn" onClick={onBack} aria-label="Назад"><Icon name="chev" size={24} /></button>
        <div className="topbar-title">{title}</div>
        <div className="topbar-right">{right}</div>
      </div>
      <div className="overlay-body">{children}</div>
    </div>
  )
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map(([v, l]) => (
        <button key={v} className={'seg-item' + (v === value ? ' on' : '')} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  )
}

export function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return <button className={'switch' + (on ? ' on' : '')} onClick={() => onChange(!on)} role="switch" aria-checked={on}><span /></button>
}

export function Chips({ options, value, onChange, color = 'fire' }: { options: string[]; value: string | null; onChange: (v: string | null) => void; color?: string }) {
  return (
    <div className="chips">
      {options.map(o => (
        <button key={o} className={'chip' + (o === value ? ' on ' + color : '')} onClick={() => onChange(o === value ? null : o)}>{o}</button>
      ))}
    </div>
  )
}

export function Label({ children }: { children: ReactNode }) {
  return <div className="label">{children}</div>
}

export function Toast({ text, action, onAction, onClose }: { text: string; action?: string; onAction?: () => void; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 8000)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div className="toast">
      <span>{text}</span>
      {action && <button onClick={() => { onAction?.(); onClose() }}>{action}</button>}
    </div>
  )
}

/** Розбір 'хв:сек' або 'хв' у секунди */
export function parseDuration(s: string): number | null {
  s = s.trim().replace(',', '.')
  if (!s) return null
  const parts = s.split(':').map(Number)
  if (parts.some(isNaN)) return null
  if (parts.length === 1) return Math.round(parts[0] * 60)
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return parts[0] * 3600 + parts[1] * 60 + parts[2]
}
