<script lang="ts">
  import { onMount } from 'svelte'
  import * as maplibregl from 'maplibre-gl'
  // O worker do Maplibre importa módulos vizinhos por caminho relativo, o que
  // o pré-bundle do Vite quebra. ?worker&url gera um worker autocontido.
  import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

  maplibregl.setWorkerUrl(workerUrl)

  // Basemap sem key; a escolha definitiva está em aberto (SPEC §11).
  const STYLE = 'https://tiles.openfreemap.org/styles/liberty'
  // Ostriconi, Córsega: o mesmo lugar da demo WASM.
  const CENTER: [number, number] = [9.08, 42.66]

  let container: HTMLDivElement

  onMount(() => {
    const map = new maplibregl.Map({ container, style: STYLE, center: CENTER, zoom: 12 })
    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }))
    return () => map.remove()
  })
</script>

<div class="map" bind:this={container}></div>

<style>
  .map {
    position: absolute;
    inset: 0;
  }
</style>
