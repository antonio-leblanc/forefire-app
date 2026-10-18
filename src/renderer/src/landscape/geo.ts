// Ponte entre o plano do motor (metros, origem no canto sudoeste) e o mapa
// (lon/lat). Aproximação local: boa até uns 30 km de lado (SPEC §5.3).

export const M_PER_DEG_LAT = 111320
export const mPerDegLon = (lat: number): number => 111320 * Math.cos((lat * Math.PI) / 180)

export interface Domain {
  /** Canto sudoeste, [lon, lat]. */
  sw: [number, number]
  /** Lado em metros. */
  side: number
}

export function domainAround(center: [number, number], side: number): Domain {
  const [lon, lat] = center
  return {
    sw: [lon - side / 2 / mPerDegLon(lat), lat - side / 2 / M_PER_DEG_LAT],
    side
  }
}

export function toLngLat(d: Domain, x: number, y: number): [number, number] {
  const lat = d.sw[1] + y / M_PER_DEG_LAT
  return [d.sw[0] + x / mPerDegLon(d.sw[1]), lat]
}

export function toXY(d: Domain, lon: number, lat: number): [number, number] {
  return [(lon - d.sw[0]) * mPerDegLon(d.sw[1]), (lat - d.sw[1]) * M_PER_DEG_LAT]
}

export function inside(d: Domain, [x, y]: [number, number]): boolean {
  return x >= 0 && y >= 0 && x <= d.side && y <= d.side
}

export function outline(d: Domain): [number, number][] {
  const s = d.side
  return [toLngLat(d, 0, 0), toLngLat(d, s, 0), toLngLat(d, s, s), toLngLat(d, 0, s), toLngLat(d, 0, 0)]
}
