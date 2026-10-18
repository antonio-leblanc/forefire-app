// Desenha o combustível como camada opcional do mapa. Barreira fica transparente,
// pra o basemap aparecer por baixo.
import type { Landscape } from '../engine/types'

/** Cor e nome de cada linha do fuels.csv do pipeline. */
export const FUEL_STYLE: Record<number, { label: string; rgb: [number, number, number] }> = {
  5: { label: 'arbusto / mata (0,6 m)', rgb: [67, 140, 80] },
  4: { label: 'capim / cultivo (0,19 m)', rgb: [214, 190, 92] }
}

export function renderFuel(land: Landscape & { fuel: Int32Array }): string {
  const { nx, ny, fuel } = land
  const canvas = document.createElement('canvas')
  canvas.width = nx
  canvas.height = ny
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(nx, ny)

  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const style = FUEL_STYLE[fuel[j * nx + i]]
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
