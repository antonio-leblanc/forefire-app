<script lang="ts">
  import Map from './lib/Map.svelte'
  import RunPanel from './lib/RunPanel.svelte'
  import { Engine } from './engine/client'
  import type { Timeline } from './engine/types'
  import { domainAround, inside } from './landscape/geo'

  const engine = new Engine()
  // 4 km de lado em Ostriconi, Córsega: o mesmo lugar da demo WASM.
  const domain = domainAround([9.08, 42.66], 4000)

  let ignition = $state<[number, number]>([domain.side / 2, domain.side / 2])
  let timeline = $state<Timeline | null>(null)
  let current = $state(0)

  function ignite(xy: [number, number]): void {
    if (!inside(domain, xy)) return
    ignition = xy
    timeline = null
  }
</script>

<Map {domain} {ignition} frames={timeline?.frames ?? []} {current} onignite={ignite} />
<RunPanel {engine} {domain} {ignition} {timeline} bind:current ontimeline={(t) => (timeline = t)} />
