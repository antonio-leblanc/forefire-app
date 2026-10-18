/**
 * Worker do motor. Portado do bindings/wasm/worker.mjs da demo (fork
 * antonio-leblanc/forefire, feat/wasm-on-dev), com uma diferença de propósito:
 * cada simulação ganha um Module WASM novo, porque o ForeFire guarda a sessão
 * em estado global (#175) e um segundo `new ForeFire()` no mesmo Module herda o
 * fogo anterior. O WebAssembly.Module compilado é reaproveitado, então o custo
 * de um Module novo fica em milissegundos.
 *
 * A timeline inteira é calculada de uma vez e devolvida junta: a UI faz scrub
 * nos frames sem esperar o solver.
 */
import { MODEL, SOLVER } from './solver'
import type {
  Frame,
  FromWorker,
  Outcome,
  RunConfig,
  SpeedRequest,
  Timeline,
  ToWorker
} from './types'

/* eslint-disable @typescript-eslint/no-explicit-any */
type ForeFireModule = any
type Factory = (opts?: Record<string, unknown>) => Promise<ForeFireModule>

let factory: Factory | null = null
let compiled: WebAssembly.Module | null = null

const post = (msg: FromWorker, transfer: Transferable[] = []): void =>
  (self as unknown as Worker).postMessage(msg, transfer)

async function init(engineBase: string): Promise<void> {
  const mod = await import(/* @vite-ignore */ new URL('forefire.mjs', engineBase).href)
  factory = mod.default as Factory
  compiled = await WebAssembly.compileStreaming(fetch(new URL('forefire.wasm', engineBase)))
}

async function freshModule(): Promise<ForeFireModule> {
  return factory!({
    instantiateWasm(
      imports: WebAssembly.Imports,
      receive: (i: WebAssembly.Instance, m: WebAssembly.Module) => void
    ) {
      WebAssembly.instantiate(compiled!, imports).then((instance) => receive(instance, compiled!))
      return {}
    }
  })
}

function build(Module: ForeFireModule, cfg: RunConfig): any {
  const land = cfg.landscape
  const { side: S, nx, ny } = land
  const ff = new Module.ForeFire()
  const model = land.fuelsTable ? MODEL : 'WindDriven'

  ff.setString('fuelsTable', land.fuelsTable ?? 'Index;vv_coeff;Kcurv;beta\n1;1.0;1.0;1.0')
  ff.setDouble('defaultFuelType', land.defaultFuel)
  for (const [k, v] of Object.entries(SOLVER)) ff.setDouble(k, v)
  ff.setString('propagationModel', model)
  ff.execute(`FireDomain[sw=(0,0,0);ne=(${S},${S},0);t=0]`)

  const fuel = land.fuel ?? new Int32Array(nx * ny).fill(land.defaultFuel)
  // Duas camadas de vento: plano 0 carrega a resposta em u, plano 1 em v.
  const windU = new Float64Array(2 * nx * ny)
  windU.fill(1, 0, nx * ny)
  const windV = new Float64Array(2 * nx * ny)
  windV.fill(1, nx * ny)

  // Altitude antes do modelo de propagação: é registrar "altitude" que faz o
  // DataBroker derivar o declive. Depois disso o declive fica zero pra sempre.
  if (land.altitude)
    ff.addScalarLayer('data', 'altitude', 0, 0, 0, S, S, 0, nx, ny, 1, 1, land.altitude)

  const ok = [
    ff.addLayer('propagation', model, 'propagationModel'),
    ff.addIndexLayer('table', 'fuel', 0, 0, 0, S, S, 0, nx, ny, 1, 1, fuel),
    ff.addScalarLayer('windScalDir', 'windU', 0, 0, 0, S, S, 0, nx, ny, 2, 1, windU),
    ff.addScalarLayer('windScalDir', 'windV', 0, 0, 0, S, S, 0, nx, ny, 2, 1, windV)
  ]
  if (ok.some((v) => !v)) throw new Error('a layer failed to register in the engine')
  return ff
}

/** Separa o print[] em um polígono por frente. Frentes internas vêm aninhadas,
 *  então cada linha FireFront começa um polígono novo. */
function parseFronts(text: string): Float32Array[] {
  const fronts: number[][] = []
  let current: number[] | null = null
  for (const line of text.split('\n')) {
    if (line.includes('FireFront[')) {
      current = []
      fronts.push(current)
    } else if (current && line.includes('FireNode[')) {
      const m = /loc=\(([-\d.eE+]+),([-\d.eE+]+),/.exec(line)
      if (m) current.push(parseFloat(m[1]), parseFloat(m[2]))
    }
  }
  // Frente com um ou dois nós é lasca degenerada, não perímetro.
  return fronts.filter((f) => f.length >= 6).map((f) => Float32Array.from(f))
}

/** Shoelace somado nas frentes. As internas giram ao contrário, então os
 *  buracos se subtraem sozinhos. */
function burntArea(fronts: Float32Array[]): number {
  let total = 0
  for (const f of fronts) {
    let a = 0
    for (let i = 0, n = f.length; i < n; i += 2) {
      const j = (i + 2) % n
      a += f[i] * f[j + 1] - f[j] * f[i + 1]
    }
    total += a / 2
  }
  return Math.abs(total)
}

function touchesEdge(fronts: Float32Array[], side: number, margin: number): boolean {
  for (const f of fronts)
    for (let i = 0; i < f.length; i += 2)
      if (f[i] < margin || f[i] > side - margin || f[i + 1] < margin || f[i + 1] > side - margin)
        return true
  return false
}

async function simulate(id: number, cfg: RunConfig): Promise<Timeline> {
  const Module = await freshModule()
  const ff = build(Module, cfg)
  const { side, nx } = cfg.landscape
  const cell = (side / nx) ** 2
  const [ix, iy] = cfg.ignition
  const rad = (cfg.wind.angleDeg * Math.PI) / 180
  const vx = (cfg.wind.speed * Math.cos(rad)).toFixed(4)
  const vy = (cfg.wind.speed * Math.sin(rad)).toFixed(4)

  ff.execute(`startFire[loc=(${ix},${iy},0.);t=0]`)

  const frames: Frame[] = []
  const started = performance.now()
  const push = (step: number): void => {
    const fronts = parseFronts(ff.execute('print[]'))
    frames.push({ step, t: ff.getTime(), fronts, area: burntArea(fronts) })
  }
  push(0)

  // Platô julgado numa janela, não passo a passo: um Rothermel jovem cresce
  // poucas centenas de m² por passo, o que é ruído olhando um passo só.
  const WINDOW = 12
  let outcome: Outcome = 'step-limit'

  for (let step = 1; step <= cfg.steps; step++) {
    ff.execute(`trigger[wind;loc=(0.,0.,0.);vel=(${vx},${vy},0)]`)
    ff.execute(`step[dt=${cfg.dt}]`)
    push(step)

    // Fogo que para some do print[]: o frame vazio sai e a causa é reportada.
    if (frames.at(-1)!.fronts.length === 0) {
      frames.pop()
      const last = frames.at(-1)
      outcome =
        last && touchesEdge(last.fronts, side, 3 * SOLVER.perimeterResolution)
          ? 'left-domain'
          : 'burnt-out'
      break
    }
    if (frames.length > WINDOW) {
      const now = frames.at(-1)!.area
      const then = frames.at(-1 - WINDOW)!.area
      if (now - then < Math.max(cell, 0.005 * then)) {
        outcome = 'stalled'
        break
      }
    }
    if (step % 25 === 0) post({ type: 'progress', id, done: step, total: cfg.steps })
  }

  const peak = Math.max(...frames.map((f) => f.area))
  if (outcome === 'stalled' && peak < 10 * cell) outcome = 'never-caught'

  return { frames, outcome, wallMs: performance.now() - started, version: Module.version() }
}

// Module do Lab: sem fogo no domínio, o estado global não vaza entre pedidos,
// então um Module só serve pra sempre. Refeito só quando a fuelsTable muda.
// Guardado como promise: pedidos que chegam juntos esperam o mesmo Module.
let lab: { table: string; ff: Promise<any> } | null = null

async function labEngine(table: string): Promise<any> {
  const Module = await freshModule()
  const ff = new Module.ForeFire()
  ff.setString('fuelsTable', table)
  for (const [k, v] of Object.entries(SOLVER)) ff.setDouble(k, v)
  ff.setString('propagationModel', MODEL)
  ff.execute('FireDomain[sw=(0,0,0);ne=(100,100,0);t=0]')
  if (!ff.addLayer('propagation', MODEL, 'propagationModel'))
    throw new Error('propagation model failed to register')
  return ff
}

async function speeds(req: SpeedRequest): Promise<Float64Array> {
  if (lab?.table !== req.fuelsTable) lab = { table: req.fuelsTable, ff: labEngine(req.fuelsTable) }
  const ff = await lab.ff
  return Float64Array.from(req.queries, (q) => parseFloat(ff.execute(`computeSpeed[${q}]`)))
}

self.onmessage = async ({ data: msg }: MessageEvent<ToWorker>) => {
  if (msg.type === 'init') {
    await init(msg.engineBase)
    post({ type: 'ready' })
    return
  }
  if (msg.type === 'speeds') {
    try {
      const result = await speeds(msg.request)
      post({ type: 'speeds', id: msg.id, speeds: result }, [result.buffer])
    } catch (err) {
      post({ type: 'failed', id: msg.id, message: String((err as Error)?.message ?? err) })
    }
    return
  }
  try {
    const timeline = await simulate(msg.id, msg.config)
    post(
      { type: 'timeline', id: msg.id, timeline },
      timeline.frames.flatMap((f) => f.fronts.map((c) => c.buffer))
    )
  } catch (err) {
    post({ type: 'failed', id: msg.id, message: String((err as Error)?.message ?? err) })
  }
}
