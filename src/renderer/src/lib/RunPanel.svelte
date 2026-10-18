<script lang="ts">
  import { onMount } from 'svelte'
  import type { Engine } from '../engine/client'
  import type { Timeline } from '../engine/types'
  import { FUELS_TABLE } from '../landscape/fuels'
  import type { Domain } from '../landscape/geo'

  interface Props {
    engine: Engine
    domain: Domain
    ignition: [number, number]
    timeline: Timeline | null
    current: number
    ontimeline: (t: Timeline | null) => void
  }
  let { engine, domain, ignition, timeline, current = $bindable(), ontimeline }: Props = $props()

  let status = $state('carregando o motor…')
  let running = $state(false)
  let windSpeed = $state(5)
  let windDeg = $state(0)

  onMount(() => {
    engine.ready.then(() => (status = 'clique no mapa pra escolher a ignição'))
    engine.onProgress = (done, total) => (status = `simulando… ${done}/${total}`)
  })

  // Terreno plano e combustível uniforme; a colina sintética é o passo 4.
  async function run(): Promise<void> {
    running = true
    ontimeline(null)
    status = 'simulando…'
    try {
      const t = await engine.run({
        landscape: { side: domain.side, nx: 200, ny: 200, fuelsTable: FUELS_TABLE, defaultFuel: 5 },
        // Proxy do $state não passa pelo postMessage: vai uma cópia simples.
        ignition: $state.snapshot(ignition),
        wind: { speed: windSpeed, angleDeg: windDeg },
        steps: 120,
        dt: 30
      })
      ontimeline(t)
      current = t.frames.length - 1
      status = 'pronto'
    } catch (err) {
      status = `falhou: ${(err as Error).message}`
    } finally {
      running = false
    }
  }

  const frame = $derived(timeline?.frames[current])
  // Vento a partir do leste, anti-horário: 0 = sopra pro leste, 90 = pro norte.
  const COMPASS = ['L', 'NE', 'N', 'NO', 'O', 'SO', 'S', 'SE']
  const toward = $derived(COMPASS[Math.round((((windDeg % 360) + 360) % 360) / 45) % 8])
</script>

<div class="panel">
  <label>
    vento {windSpeed} m/s, soprando pro {toward}
    <input type="range" min="0" max="15" step="0.5" bind:value={windSpeed} />
    <input type="range" min="0" max="359" step="1" bind:value={windDeg} />
  </label>
  <button onclick={run} disabled={running}>Rodar 1 h</button>
  <p>{status}</p>

  {#if timeline && frame}
    <label>
      t = {(frame.t / 60).toFixed(0)} min
      <input type="range" min="0" max={timeline.frames.length - 1} bind:value={current} />
    </label>
    <dl>
      <dt>área queimada</dt>
      <dd>{(frame.area / 10000).toFixed(1)} ha</dd>
      <dt>fim</dt>
      <dd>{timeline.outcome}</dd>
      <dt>solver</dt>
      <dd>{timeline.wallMs.toFixed(0)} ms</dd>
      <dt>motor</dt>
      <dd>ForeFire {timeline.version}</dd>
    </dl>
  {/if}
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
    width: 240px;
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
</style>
