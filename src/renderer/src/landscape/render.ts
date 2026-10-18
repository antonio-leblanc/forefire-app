// Camadas da paisagem desenhadas sobre o mapa: combustível e sombreamento do
// relevo. O que não tem nada a mostrar fica transparente, pra o basemap aparecer.
import type { Landscape } from '../engine/types'
import type { Legend } from './pack'

export function renderFuel(land: Landscape & { fuel: Int32Array }, legend: Legend): string {
  const { nx, ny, fuel } = land
  const canvas = document.createElement('canvas')
  canvas.width = nx
  canvas.height = ny
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(nx, ny)

  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const style = legend[fuel[j * nx + i]]
      if (!style) continue
      // Linha 0 da grade é o sul; linha 0 da imagem é o topo (norte).
      const p = ((ny - 1 - j) * nx + i) * 4
      img.data[p] = style.rgb[0]
      img.data[p + 1] = style.rgb[1]
      img.data[p + 2] = style.rgb[2]
      img.data[p + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas.toDataURL()
}

// Luz de noroeste a 45° acima do horizonte, a convenção da cartografia.
const SUN_AZIMUTH = (315 * Math.PI) / 180
const SUN_ALTITUDE = (45 * Math.PI) / 180
// Opacidade por unidade de desvio do terreno plano; satura em MAX_ALPHA.
const SHADE_GAIN = 6
const MAX_ALPHA = 0.5

/**
 * Hillshade da altitude: sombra preta nas encostas viradas contra o sol e luz
 * branca nas viradas pra ele, com o terreno plano transparente.
 */
export function renderHillshade(land: Landscape & { altitude: Float64Array }): string {
  const { nx, ny, altitude: z, side } = land
  const cell = side / nx
  const lx = Math.sin(SUN_AZIMUTH) * Math.cos(SUN_ALTITUDE)
  const ly = Math.cos(SUN_AZIMUTH) * Math.cos(SUN_ALTITUDE)
  const lz = Math.sin(SUN_ALTITUDE)
  const at = (i: number, j: number): number =>
    z[Math.min(ny - 1, Math.max(0, j)) * nx + Math.min(nx - 1, Math.max(0, i))]

  const canvas = document.createElement('canvas')
  canvas.width = nx
  canvas.height = ny
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(nx, ny)

  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      // Diferença central; y cresce pro norte (linha 0 = sul).
      const dzdx = (at(i + 1, j) - at(i - 1, j)) / (2 * cell)
      const dzdy = (at(i, j + 1) - at(i, j - 1)) / (2 * cell)
      const shade = (-dzdx * lx - dzdy * ly + lz) / Math.hypot(dzdx, dzdy, 1)
      const delta = shade - lz
      const alpha = Math.min(MAX_ALPHA, Math.abs(delta) * SHADE_GAIN)
      const p = ((ny - 1 - j) * nx + i) * 4
      const v = delta > 0 ? 255 : 0
      img.data[p] = v
      img.data[p + 1] = v
      img.data[p + 2] = v
      img.data[p + 3] = alpha * 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas.toDataURL()
}
