<script lang="ts">
  import { onMount } from 'svelte'
  import Map from './lib/Map.svelte'
  import RunPanel from './lib/RunPanel.svelte'
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
  let relief = $state(false)
  let showFuel = $state(false)

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
  })

  // Relevo desligado = sem camada de altitude: o motor roda no plano (SPEC §5.4).
  const landscape = $derived<Landscape | null>(
    pack && (relief ? pack.landscape : { ...pack.landscape, altitude: undefined })
  )

  const attribution = $derived(
    pack ? Object.values(pack.meta.fontes).map((f) => (f.licenca ? `${f.dado} (${f.licenca})` : f.dado)) : []
  )

  function ignite(xy: [number, number]): void {
    if (!pack || !inside(pack.domain, xy)) return
    ignition = xy
    timeline = null
  }
</script>

{#if pack}
  {#key pack}
    <Map
      domain={pack.domain}
      {fuelImage}
      {showFuel}
      attribution={attribution.join(' · ')}
      {ignition}
      frames={timeline?.frames ?? []}
      {current}
      onignite={ignite}
    />
  {/key}
{/if}
<RunPanel
  {engine}
  {landscape}
  meta={pack?.meta ?? null}
  {error}
  {ignition}
  {timeline}
  bind:current
  bind:relief
  bind:showFuel
  ontimeline={(t) => (timeline = t)}
  onopen={async () => load(await window.api.openLandscape())}
/>
