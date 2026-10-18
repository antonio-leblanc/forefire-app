<script lang="ts">
  import { onMount } from 'svelte'
  import type { Engine } from '../engine/client'
  import type { Landscape, Timeline } from '../engine/types'
  import { FUELS } from '../landscape/fuels'

  interface Props {
    engine: Engine
    landscape: Landscape
    ignition: [number, number]
    timeline: Timeline | null
    current: number
    ontimeline: (t: Timeline | null) => void
  }
  let { engine, landscape, ignition, timeline, current = $bindable(), ontimeline }: Props = $props()

  let status = $state('carregando o motor…')
  let running = $state(false)
  let windSpeed = $state(4)
  /** Convenção meteorológica: de onde o vento VEM, em graus a partir do norte. */
  let windFrom = $state(180)
  let playing = $state(false)

  onMount(() => {
    engine.ready.then(() => (status = 'clique no mapa pra escolher a ignição'))
    engine.onProgress = (done, total) => (status = `simulando… ${done}/${total}`)
  })

  // O motor quer pra ONDE o vento sopra, a partir do leste, anti-horário.
  // Vem de N (0°) → sopra pro sul → -90° no motor.
  const engineAngle = (from: number): number => -90 - from

  async function run(): Promise<void> {
    running = true
    playing = false
    ontimeline(null)
    status = 'simulando…'
    try {
      const t = await engine.run({
        landscape,
        // Proxy do $state não passa pelo postMessage: vai uma cópia simples.
        ignition: $state.snapshot(ignition),
        wind: { speed: windSpeed, angleDeg: engineAngle(windFrom) },
        steps: 120,
        dt: 30
      })
      ontimeline(t)
      current = 0
      playing = true
      status = 'pronto'
    } catch (err) {
      status = `falhou: ${(err as Error).message}`
    } finally {
      running = false
    }
  }

  // Play: avança um frame a cada 50 ms, para no fim.
  $effect(() => {
    if (!playing || !timeline) return undefined
    const n = timeline.frames.length
    const id = setInterval(() => {
      if (current >= n - 1) playing = false
      else current += 1
    }, 50)
    return () => clearInterval(id)
  })

  function togglePlay(): void {
    if (!timeline) return
    if (!playing && current >= timeline.frames.length - 1) current = 0
    playing = !playing
  }

  const frame = $derived(timeline?.frames[current])
  const COMPASS = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO']
  const fromName = $derived(COMPASS[Math.round((((windFrom % 360) + 360) % 360) / 45) % 8])
  const OUTCOME: Record<string, string> = {
    'step-limit': 'ainda queimando',
    'burnt-out': 'apagou',
    'left-domain': 'saiu da área',
    stalled: 'parou de crescer',
    'never-caught': 'não pegou'
  }
</script>

<div class="panel">
  <label>
    vento de {fromName}, {windSpeed} m/s
    <input type="range" min="0" max="15" step="0.5" bind:value={windSpeed} />
    <input type="range" min="0" max="359" step="1" bind:value={windFrom} />
  </label>
  <button onclick={run} disabled={running}>Rodar 1 h</button>
  <p>{status}</p>

  {#if timeline && frame}
    <div class="row">
      <button class="play" onclick={togglePlay}>{playing ? '❚❚' : '▶'}</button>
      <label class="grow">
        t = {(frame.t / 60).toFixed(0)} min
        <input
          type="range"
          min="0"
          max={timeline.frames.length - 1}
          bind:value={current}
          oninput={() => (playing = false)}
        />
      </label>
    </div>
    <dl>
      <dt>área queimada</dt>
      <dd>{(frame.area / 10000).toFixed(1)} ha</dd>
      <dt>situação</dt>
      <dd>{OUTCOME[timeline.outcome] ?? timeline.outcome}</dd>
      <dt>solver</dt>
      <dd>{timeline.wallMs.toFixed(0)} ms</dd>
      <dt>motor</dt>
      <dd>ForeFire {timeline.version}</dd>
    </dl>
  {/if}

  <ul class="legend">
    {#each FUELS as f (f.index)}
      <li><span style:background={`rgb(${f.rgb.join(',')})`}></span>{f.label}</li>
    {/each}
    <li class="note">colina de 400 m ao norte do centro (sombreada)</li>
  </ul>
</div>

<style>
  .panel {
    position: absolute;
    top: 12px;
    left: 12px;
    z-index: 1;
    background: rgba(27, 27, 27, 0.9);
    padding: 12px 14px;
    border-radius: 8px;
    width: 250px;
    font-size: 13px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .row {
    display: flex;
    align-items: flex-end;
    gap: 8px;
  }
  .grow {
    flex: 1;
  }
  .play {
    width: 32px;
  }
  p {
    margin: 0;
    color: #bbb;
  }
  dl {
    display: grid;
    grid-template-columns: auto auto;
    gap: 2px 12px;
    margin: 0;
  }
  dt {
    color: #999;
  }
  dd {
    margin: 0;
    text-align: right;
  }
  .legend {
    list-style: none;
    margin: 4px 0 0;
    padding: 8px 0 0;
    border-top: 1px solid #333;
    display: flex;
    flex-direction: column;
    gap: 3px;
    color: #ccc;
  }
  .legend span {
    display: inline-block;
    width: 10px;
    height: 10px;
    margin-right: 6px;
    border-radius: 2px;
  }
  .note {
    color: #888;
  }
</style>
