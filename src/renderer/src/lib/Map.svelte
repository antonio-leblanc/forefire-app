<script lang="ts">
  import { onMount } from 'svelte'
  import * as maplibregl from 'maplibre-gl'
  // O worker do Maplibre importa módulos vizinhos por caminho relativo, o que
  // o pré-bundle do Vite quebra. ?worker&url gera um worker autocontido.
  import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
  import type { Frame } from '../engine/types'
  import { type Domain, outline, toLngLat, toXY } from '../landscape/geo'

  maplibregl.setWorkerUrl(workerUrl)

  // Basemap sem key e leve (pouco rótulo, sem prédio 3D): a paisagem é que é o
  // assunto. A escolha definitiva está em aberto (SPEC §11).
  const STYLE = 'https://tiles.openfreemap.org/styles/positron'
  // Uma isócrona a cada tantos frames; a frente atual sai sempre.
  const ISO_EVERY = 10

  interface Props {
    domain: Domain
    /** Imagem da paisagem (data URL), esticada sobre o domínio. */
    landscapeImage: string
    ignition: [number, number]
    frames: Frame[]
    /** Frame mostrado como frente atual. */
    current: number
    onignite: (xy: [number, number]) => void
  }
  let { domain, landscapeImage, ignition, frames, current, onignite }: Props = $props()

  let container: HTMLDivElement
  let map: maplibregl.Map | null = $state(null)

  const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

  function frontsToLines(f: Frame): GeoJSON.Feature[] {
    return f.fronts.map((poly) => {
      const coords: [number, number][] = []
      for (let i = 0; i < poly.length; i += 2) coords.push(toLngLat(domain, poly[i], poly[i + 1]))
      coords.push(coords[0])
      return { type: 'Feature', properties: { t: f.t }, geometry: { type: 'LineString', coordinates: coords } }
    })
  }

  onMount(() => {
    const m = new maplibregl.Map({
      container,
      style: STYLE,
      center: toLngLat(domain, domain.side / 2, domain.side / 2),
      zoom: 13
    })
    m.addControl(new maplibregl.NavigationControl(), 'top-right')
    m.addControl(new maplibregl.ScaleControl({ unit: 'metric' }))

    m.on('load', () => {
      for (const id of ['domain', 'isochrones', 'front', 'ignition']) m.addSource(id, { type: 'geojson', data: empty })

      const S = domain.side
      m.addSource('landscape', {
        type: 'image',
        url: landscapeImage,
        // Cantos na ordem do Maplibre: noroeste, nordeste, sudeste, sudoeste.
        coordinates: [toLngLat(domain, 0, S), toLngLat(domain, S, S), toLngLat(domain, S, 0), toLngLat(domain, 0, 0)]
      })
      m.addLayer({
        id: 'landscape',
        type: 'raster',
        source: 'landscape',
        paint: { 'raster-opacity': 0.8, 'raster-resampling': 'nearest' }
      })

      m.addLayer({
        id: 'domain-line',
        type: 'line',
        source: 'domain',
        paint: { 'line-color': '#222', 'line-width': 1.5, 'line-dasharray': [3, 2] }
      })
      m.addLayer({
        id: 'isochrones',
        type: 'line',
        source: 'isochrones',
        paint: {
          'line-width': 1.5,
          'line-opacity': 0.8,
          // Amarelo (começo) → vermelho escuro (1 h), por tempo simulado em segundos.
          'line-color': ['interpolate', ['linear'], ['get', 't'], 0, '#ffd54f', 1800, '#f4511e', 3600, '#7f0000']
        }
      })
      m.addLayer({ id: 'front', type: 'line', source: 'front', paint: { 'line-color': '#d50000', 'line-width': 3 } })
      m.addLayer({
        id: 'ignition',
        type: 'circle',
        source: 'ignition',
        paint: {
          'circle-radius': 6,
          'circle-color': '#ff6d00',
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 2
        }
      })
      map = m
    })

    m.on('click', (e) => onignite(toXY(domain, e.lngLat.lng, e.lngLat.lat)))
    m.getCanvas().style.cursor = 'crosshair'

    return () => m.remove()
  })

  const geo = (id: string): maplibregl.GeoJSONSource | undefined =>
    map?.getSource(id) as maplibregl.GeoJSONSource | undefined

  $effect(() => {
    geo('domain')?.setData({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [outline(domain)] }
    })
  })

  $effect(() => {
    geo('ignition')?.setData({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: toLngLat(domain, ignition[0], ignition[1]) }
    })
  })

  $effect(() => {
    const shown = frames.slice(0, current + 1)
    geo('isochrones')?.setData({
      type: 'FeatureCollection',
      features: shown.filter((f) => f.step > 0 && f.step % ISO_EVERY === 0).flatMap(frontsToLines)
    })
    const f = frames[current]
    geo('front')?.setData({ type: 'FeatureCollection', features: f ? frontsToLines(f) : [] })
  })
</script>

<div class="map" bind:this={container}></div>

<style>
  .map {
    position: absolute;
    inset: 0;
  }
</style>
