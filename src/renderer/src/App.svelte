<script lang="ts">
  import Map from './lib/Map.svelte'
  import RunPanel from './lib/RunPanel.svelte'
  import { Engine } from './engine/client'
  import type { Timeline } from './engine/types'
  import { domainAround, inside } from './landscape/geo'
  import { synthetic } from './landscape/synthetic'
  import { renderLandscape } from './landscape/render'

  const engine = new Engine()
  // 4 km de lado em Ostriconi, Córsega: o mesmo lugar da demo WASM.
  const domain = domainAround([9.08, 42.66], 4000)
  // Gerada uma vez e fora do $state: arrays grandes não precisam de reatividade.
  const { landscape } = synthetic(domain.side)
  const landscapeImage = renderLandscape(landscape)

  // Ao pé da colina, pelo lado sul.
  let ignition = $state<[number, number]>([domain.side / 2, domain.side * 0.375])
  let timeline = $state<Timeline | null>(null)
  let current = $state(0)

  function ignite(xy: [number, number]): void {
    if (!inside(domain, xy)) return
    ignition = xy
    timeline = null
  }
</script>

<Map {domain} {landscapeImage} {ignition} frames={timeline?.frames ?? []} {current} onignite={ignite} />
<RunPanel {engine} {landscape} {ignition} {timeline} bind:current ontimeline={(t) => (timeline = t)} />
