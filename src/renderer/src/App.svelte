<script lang="ts">
  import { onMount } from 'svelte'
  import Header from './lib/Header.svelte'
  import Map from './lib/Map.svelte'
  import RunStats from './lib/RunStats.svelte'
  import Sidebar from './lib/Sidebar.svelte'
  import StatusBar from './lib/StatusBar.svelte'
  import TimelineBar from './lib/TimelineBar.svelte'
  import { Engine } from './engine/client'
  import type { Landscape, Timeline } from './engine/types'
  import { inside } from './landscape/geo'
  import { type Pack, fromRaw } from './landscape/pack'
  import { renderFuel } from './landscape/render'

  const engine = new Engine()
  // $state.raw: arrays grandes não precisam de reatividade profunda.
  let pack = $state.raw<Pack | null>(null)
  let fuelImage = $state('')
  let error = $state('')
  let ignition = $state<[number, number]>([0, 0])
  let timeline = $state<Timeline | null>(null)
  let current = $state(0)
  let playing = $state(false)
  let relief = $state(false)
  let showFuel = $state(false)
  let windSpeed = $state(4)
  /** Convenção meteorológica: de onde o vento VEM, em graus a partir do norte. */
  let windFrom = $state(180)
  let engineReady = $state(false)
  let running = $state(false)
  let progress = $state('')

  function load(raw: RawPack | null): void {
    if (!raw) return
    try {
      const p = fromRaw(raw)
      fuelImage = renderFuel(p.landscape)
      ignition = [p.meta.lado / 2, p.meta.lado / 2]
      timeline = null
      error = ''
      pack = p
    } catch (err) {
      error = (err as Error).message
    }
  }

  onMount(() => {
    window.api.lastLandscape().then(load)
    engine.ready.then(() => (engineReady = true))
    engine.onProgress = (done, total) => (progress = `${done}/${total}`)
  })

  $effect(() => {
    document.title = pack ? `ForeFire — ${pack.meta.nome}` : 'ForeFire'
  })

  // Relevo desligado = sem camada de altitude: o motor roda no plano (SPEC §5.4).
  const landscape = $derived<Landscape | null>(
    pack && (relief ? pack.landscape : { ...pack.landscape, altitude: undefined })
  )

  const sources = $derived(
    pack
      ? Object.values(pack.meta.fontes).map((f) =>
          f.licenca ? `${f.dado} (${f.licenca})` : f.dado
        )
      : []
  )

  // O motor quer pra ONDE o vento sopra, a partir do leste, anti-horário.
  // Vem de N (0°) → sopra pro sul → -90° no motor.
  const engineAngle = (from: number): number => -90 - from

  async function run(): Promise<void> {
    if (!landscape) return
    running = true
    playing = false
    timeline = null
    progress = ''
    error = ''
    try {
      timeline = await engine.run({
        landscape,
        // Proxy do $state não passa pelo postMessage: vai uma cópia simples.
        ignition: $state.snapshot(ignition),
        wind: { speed: windSpeed, angleDeg: engineAngle(windFrom) },
        steps: 120,
        dt: 30
      })
      current = 0
      playing = true
    } catch (err) {
      error = `simulation failed: ${(err as Error).message}`
    } finally {
      running = false
    }
  }

  function ignite(xy: [number, number]): void {
    if (!pack || !inside(pack.domain, xy)) return
    ignition = xy
    timeline = null
  }
</script>

<div class="app">
  <Header
    name={pack?.meta.nome ?? null}
    side={pack?.meta.lado ?? 0}
    version={timeline?.version ?? null}
    {engineReady}
    onopen={async () => load(await window.api.openLandscape())}
  />
  <div class="body">
    <Sidebar
      meta={pack?.meta ?? null}
      domain={pack?.domain ?? null}
      {ignition}
      {error}
      {running}
      {progress}
      canRun={engineReady && !!landscape}
      bind:relief
      bind:showFuel
      bind:windSpeed
      bind:windFrom
      onrelief={() => (timeline = null)}
      onrun={run}
    />
    <main>
      <div class="map">
        {#if pack}
          {#key pack}
            <Map
              domain={pack.domain}
              {fuelImage}
              {showFuel}
              {ignition}
              frames={timeline?.frames ?? []}
              {current}
              onignite={ignite}
            />
          {/key}
          {#if timeline}
            <RunStats {timeline} {current} />
          {/if}
        {:else}
          <div class="empty">
            <p>No landscape open.</p>
            <p class="hint">
              Build a package with <code>pipeline/</code> and open its folder from the header.
            </p>
          </div>
        {/if}
      </div>
      <TimelineBar {timeline} bind:current bind:playing />
    </main>
  </div>
  <StatusBar {sources} hasPack={!!pack} />
</div>

<style>
  .app {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  .body {
    flex: 1;
    min-height: 0;
    display: flex;
  }
  main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .map {
    position: relative;
    flex: 1;
    min-height: 0;
    background: #e9e6e0;
  }
  .empty {
    position: absolute;
    inset: 0;
    display: grid;
    place-content: center;
    text-align: center;
    background: var(--bg);
    color: var(--text-2);
  }
  .empty p {
    margin: 4px 0;
  }
  .hint {
    color: var(--muted);
    font-size: 13px;
  }
</style>
