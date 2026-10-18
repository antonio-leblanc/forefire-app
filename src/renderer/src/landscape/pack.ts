// Pacote de paisagem aberto pelo main (SPEC §5.2) → domínio no mapa + paisagem pro motor.
import type { Landscape } from '../engine/types'
import { type Domain, domainAround } from './geo'

export interface PackMeta {
  nome: string
  centro: [number, number]
  lado: number
  nx: number
  ny: number
  mapeamento: string
  fuelPadrao: number
  fontes: Record<string, { dado: string; licenca?: string; url: string[] }>
}

export interface Pack {
  meta: PackMeta
  domain: Domain
  landscape: Landscape & { fuel: Int32Array; altitude: Float64Array }
}

// Cópia antes de reinterpretar: o Uint8Array do IPC pode vir com offset desalinhado.
const bytes = (u8: Uint8Array): ArrayBuffer => u8.slice().buffer

export function fromRaw(raw: RawPack): Pack {
  const meta = raw.meta as PackMeta
  const { nx, ny } = meta
  const fuel = new Int32Array(bytes(raw.fuel))
  const altitude = new Float64Array(bytes(raw.altitude))
  if (fuel.length !== nx * ny || altitude.length !== nx * ny) {
    throw new Error(`package ${meta.nome}: ${nx}x${ny} grid does not match the .bin files`)
  }
  return {
    meta,
    domain: domainAround(meta.centro, meta.lado),
    landscape: { side: meta.lado, nx, ny, fuel, altitude, fuelsTable: raw.fuelsTable, defaultFuel: meta.fuelPadrao }
  }
}
