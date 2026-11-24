// Схід і захід сонця — розрахунок на телефоні (алгоритм NOAA / SunCalc), без інтернету.
const rad = Math.PI / 180
const J1970 = 2440588, J2000 = 2451545, dayMs = 86400000
const toJulian = (d: Date) => d.getTime() / dayMs - 0.5 + J1970
const fromJulian = (j: number) => new Date((j + 0.5 - J1970) * dayMs)
const toDays = (d: Date) => toJulian(d) - J2000
const e = rad * 23.4397
const declination = (l: number) => Math.asin(Math.sin(e) * Math.sin(l))
const solarMeanAnomaly = (d: number) => rad * (357.5291 + 0.98560028 * d)
function eclipticLongitude(M: number) {
  const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M))
  return M + C + rad * 102.9372 + Math.PI
}
const J0 = 0.0009
const julianCycle = (d: number, lw: number) => Math.round(d - J0 - lw / (2 * Math.PI))
const approxTransit = (Ht: number, lw: number, n: number) => J0 + (Ht + lw) / (2 * Math.PI) + n
const solarTransitJ = (ds: number, M: number, L: number) => J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L)
const hourAngle = (h: number, phi: number, d: number) => Math.acos((Math.sin(h) - Math.sin(phi) * Math.sin(d)) / (Math.cos(phi) * Math.cos(d)))

export interface SunTimes { sunrise: Date; sunset: Date; noon: Date; polar?: 'day' | 'night' }

export function sunTimes(date: Date, lat: number, lon: number): SunTimes {
  const lw = rad * -lon, phi = rad * lat
  const mid = new Date(date); mid.setHours(12, 0, 0, 0)
  const d = toDays(mid)
  const n = julianCycle(d, lw)
  const ds = approxTransit(0, lw, n)
  const M = solarMeanAnomaly(ds), L = eclipticLongitude(M), dec = declination(L)
  const Jnoon = solarTransitJ(ds, M, L)
  const h0 = -0.833 * rad
  const cosw = (Math.sin(h0) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec))
  const noon = fromJulian(Jnoon)
  if (cosw < -1 || cosw > 1) {
    // полярний день / ніч — умовні межі
    const s = new Date(mid); s.setHours(6, 0, 0, 0); const t = new Date(mid); t.setHours(18, 0, 0, 0)
    return { sunrise: s, sunset: t, noon, polar: cosw < -1 ? 'day' : 'night' }
  }
  const w = hourAngle(h0, phi, dec)
  const Jset = solarTransitJ(approxTransit(w, lw, n), M, L)
  const Jrise = Jnoon - (Jset - Jnoon)
  return { sunrise: fromJulian(Jrise), sunset: fromJulian(Jset), noon }
}

export const KYIV = { lat: 50.45, lon: 30.52, name: 'Київ' }
