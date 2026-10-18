// Contrato entre a UI e o worker do motor (SPEC §3 e §4).

/** Paisagem num plano cartesiano em metros, origem no canto sudoeste. */
export interface Landscape {
  /** Lado do domínio quadrado, em metros. */
  side: number
  nx: number
  ny: number
  /** Índices da fuelsTable, flat em ordem C (y, x), linha 0 = sul. Sem ele, tudo é defaultFuel. */
  fuel?: Int32Array
  /** Altitude em metros, mesma grade do fuel. */
  altitude?: Float64Array
  /** CSV `;` da fuelsTable. Sem ele, o motor roda WindDriven em vez de Rothermel. */
  fuelsTable?: string
  defaultFuel: number
}

export interface Wind {
  /** m/s */
  speed: number
  /** Direção pra onde o vento sopra, graus a partir do leste, sentido anti-horário. */
  angleDeg: number
}

export interface RunConfig {
  landscape: Landscape
  /** Ponto de ignição em metros, no plano do domínio. */
  ignition: [number, number]
  wind: Wind
  steps: number
  /** Segundos simulados por passo. */
  dt: number
}

export interface Frame {
  step: number
  /** Tempo simulado, em segundos. */
  t: number
  /** Um polígono por frente, [x0, y0, x1, y1, ...] em metros. */
  fronts: Float32Array[]
  /** Área queimada, m². */
  area: number
}

export type Outcome = 'burnt-out' | 'left-domain' | 'stalled' | 'never-caught' | 'step-limit'

export interface Timeline {
  frames: Frame[]
  outcome: Outcome
  wallMs: number
  version: string
}

export type ToWorker = { type: 'init'; engineBase: string } | { type: 'run'; id: number; config: RunConfig }

export type FromWorker =
  | { type: 'ready' }
  | { type: 'progress'; id: number; done: number; total: number }
  | { type: 'timeline'; id: number; timeline: Timeline }
  | { type: 'failed'; id: number; message: string }
