import { describe, expect, it } from 'vitest'
import { sunTimes } from './sun'
import { autoTheme } from './theme'

const hm = (d: Date) => d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' })
const mins = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + m }

describe('схід і захід сонця', () => {
  it('Київ, 25 листопада: схід ≈ 07:28, захід ≈ 15:58 (±10 хв)', () => {
    const t = sunTimes(new Date('2026-11-25T12:00:00+02:00'), 50.45, 30.52)
    expect(Math.abs(mins(hm(t.sunrise)) - mins('07:28'))).toBeLessThan(10)
    expect(Math.abs(mins(hm(t.sunset)) - mins('15:58'))).toBeLessThan(10)
  })
  it('Київ, 21 червня: схід ≈ 04:47, захід ≈ 21:12 (±10 хв)', () => {
    const t = sunTimes(new Date('2026-06-21T12:00:00+03:00'), 50.45, 30.52)
    expect(Math.abs(mins(hm(t.sunrise)) - mins('04:47'))).toBeLessThan(10)
    expect(Math.abs(mins(hm(t.sunset)) - mins('21:12'))).toBeLessThan(10)
  })
  it('теми взимку йдуть за сонцем', () => {
    const at = (s: string) => autoTheme(new Date(`2026-11-25T${s}:00+02:00`))
    expect(at('05:30')).toBe('night')
    expect(at('08:00')).toBe('morning')
    expect(at('11:30')).toBe('day')
    expect(at('14:00')).toBe('noon')
    expect(at('16:00')).toBe('evening')
    expect(at('18:00')).toBe('night')
  })
})
