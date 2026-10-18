// Desenha a paisagem como imagem pro mapa: cor do combustível escurecida por um
// sombreamento de relevo (luz de noroeste), pra colina aparecer.
import type { Landscape } from '../engine/types'
import { FUELS } from './fuels'

export function renderLandscape(land: Landscape & { fuel: Int32Array; altitude: Float64Array }): string {
  const { nx, ny, side, fuel, altitude } = land
  const cell = side / nx
  const colors = new Map(FUELS.map((f) => [f.index, f.rgb]))

  const canvas = document.createElement('canvas')
  canvas.width = nx
  canvas.height = ny
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(nx, ny)

  // Vetor apontando pra luz: noroeste (-x, +y), 45° acima do horizonte.
  const L = [-1, 1, Math.SQRT2].map((v) => v / 2)
  const z = (i: number, j: number): number =>
    altitude[Math.min(ny - 1, Math.max(0, j)) * nx + Math.min(nx - 1, Math.max(0, i))]

  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const dzdx = (z(i + 1, j) - z(i - 1, j)) / (2 * cell)
      const dzdy = (z(i, j + 1) - z(i, j - 1)) / (2 * cell)
      const norm = Math.hypot(dzdx, dzdy, 1)
      const shade = Math.max(0, (-dzdx * L[0] - dzdy * L[1] + L[2]) / norm)
      const k = 0.55 + 0.45 * shade

      const rgb = colors.get(fuel[j * nx + i]) ?? [255, 0, 255]
      // Linha 0 da grade é o sul; linha 0 da imagem é o topo (norte).
      const p = ((ny - 1 - j) * nx + i) * 4
      img.data[p] = rgb[0] * k
      img.data[p + 1] = rgb[1] * k
      img.data[p + 2] = rgb[2] * k
      img.data[p + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas.toDataURL()
}
