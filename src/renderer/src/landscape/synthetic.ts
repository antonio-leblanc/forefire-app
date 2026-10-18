// Paisagem sintética do M1 (PLAN passo 4): uma colina e manchas de combustível,
// geradas por código, pra o fogo ter onde reagir sem baixar dado nenhum.
// Segue o contrato do SPEC §4: grade em metros, flat em ordem C (y, x), linha 0 = sul.
import type { Landscape } from '../engine/types'
import { FUELS_TABLE } from './fuels'

export const MAQUIS = 5
export const GRASS = 4
export const NONE = 0

export interface Feature {
  label: string
  /** Onde fica, em metros no plano do domínio. */
  at: [number, number]
}

export interface Synthetic {
  landscape: Landscape & { fuel: Int32Array; altitude: Float64Array }
  features: Feature[]
}

export function synthetic(side = 4000, n = 200): Synthetic {
  const cell = side / n
  const fuel = new Int32Array(n * n)
  const altitude = new Float64Array(n * n)

  // Colina gaussiana: 400 m de altura, um pouco ao norte do centro. Declive
  // máximo perto de 40%, o bastante pro Rothermel mostrar a diferença.
  const hill = { x: side / 2, y: side * 0.6, h: 400, sigma: side * 0.15 }
  // Capim a sudoeste, clareira a sudeste, estrada cortando o norte.
  const grass = { x: side * 0.27, y: side * 0.27, rx: side * 0.14, ry: side * 0.1 }
  const clearing = { x: side * 0.75, y: side * 0.3, r: side * 0.075 }
  const road = { y: side * 0.8, half: 20, x0: side * 0.1, x1: side * 0.9 }

  for (let j = 0; j < n; j++) {
    const y = (j + 0.5) * cell
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5) * cell
      const k = j * n + i

      const d2 = (x - hill.x) ** 2 + (y - hill.y) ** 2
      altitude[k] = 100 + hill.h * Math.exp(-d2 / (2 * hill.sigma ** 2))

      let f = MAQUIS
      if (((x - grass.x) / grass.rx) ** 2 + ((y - grass.y) / grass.ry) ** 2 <= 1) f = GRASS
      if ((x - clearing.x) ** 2 + (y - clearing.y) ** 2 <= clearing.r ** 2) f = NONE
      if (Math.abs(y - road.y) <= road.half && x >= road.x0 && x <= road.x1) f = NONE
      fuel[k] = f
    }
  }

  return {
    landscape: { side, nx: n, ny: n, fuel, altitude, fuelsTable: FUELS_TABLE, defaultFuel: MAQUIS },
    features: [
      { label: 'colina (400 m)', at: [hill.x, hill.y] },
      { label: 'capim', at: [grass.x, grass.y] },
      { label: 'clareira', at: [clearing.x, clearing.y] },
      { label: 'estrada', at: [road.x0, road.y] }
    ]
  }
}
