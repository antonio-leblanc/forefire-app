import EngineWorker from './worker?worker'
import type { FromWorker, RunConfig, Timeline, ToWorker } from './types'

/** Fala com o worker do motor por promises. Um worker só; cada run cria seu
 *  próprio Module WASM lá dentro. */
export class Engine {
  private worker = new EngineWorker()
  private nextId = 1
  private pending = new Map<number, { resolve: (t: Timeline) => void; reject: (e: Error) => void }>()
  readonly ready: Promise<void>
  onProgress: (done: number, total: number) => void = () => {}

  constructor() {
    this.ready = new Promise((resolve) => {
      this.worker.onmessage = ({ data }: MessageEvent<FromWorker>) => {
        if (data.type === 'ready') return resolve()
        if (data.type === 'progress') return this.onProgress(data.done, data.total)
        const p = this.pending.get(data.id)
        if (!p) return
        this.pending.delete(data.id)
        if (data.type === 'timeline') p.resolve(data.timeline)
        else p.reject(new Error(data.message))
      }
    })
    // engine/ fica em public/: http://localhost:5173/engine/ no dev, file://.../renderer/engine/ no build.
    this.send({ type: 'init', engineBase: new URL('engine/', document.baseURI).href })
  }

  async run(config: RunConfig): Promise<Timeline> {
    await this.ready
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.send({ type: 'run', id, config })
    })
  }

  private send(msg: ToWorker): void {
    this.worker.postMessage(msg)
  }
}
