<script lang="ts">
  import { type Domain, toLngLat } from '../landscape/geo'
  import type { PackMeta } from '../landscape/pack'

  interface Props {
    meta: PackMeta | null
    domain: Domain | null
    ignition: [number, number]
    error: string
    running: boolean
    /** Passos simulados, "feitos/total", enquanto roda. */
    progress: string
    canRun: boolean
    relief: boolean
    showFuel: boolean
    windSpeed: number
    windFrom: number
    onrelief: () => void
    onrun: () => void
    onopen: () => void
  }
  let {
    meta,
    domain,
    ignition,
    error,
    running,
    progress,
    canRun,
    relief = $bindable(),
    showFuel = $bindable(),
    windSpeed = $bindable(),
    windFrom = $bindable(),
    onrelief,
    onrun,
    onopen
  }: Props = $props()

  const COMPASS = [
    'north',
    'northeast',
    'east',
    'southeast',
    'south',
    'southwest',
    'west',
    'northwest'
  ]
  const fromName = $derived(COMPASS[Math.round((((windFrom % 360) + 360) % 360) / 45) % 8])

  const fmt = (v: number, pos: string, neg: string): string =>
    `${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}° ${v < 0 ? neg : pos}`
  const ignitionLabel = $derived.by(() => {
    if (!domain) return '—'
    const [lon, lat] = toLngLat(domain, ignition[0], ignition[1])
    return `${fmt(lat, 'N', 'S')} · ${fmt(lon, 'E', 'W')}`
  })

  // Seta da rosa: aponta pra onde o vento SOPRA (oposto de onde vem).
  const arrow = $derived.by(() => {
    const a = ((windFrom + 180) * Math.PI) / 180
    const tip: [number, number] = [50 + 30 * Math.sin(a), 50 - 30 * Math.cos(a)]
    const tail: [number, number] = [50 - 30 * Math.sin(a), 50 + 30 * Math.cos(a)]
    return { tip, tail, deg: windFrom + 180 }
  })

  // Rosa dos ventos: clicar ou arrastar marca de onde o vento VEM (a cauda da
  // seta vai pro ponto clicado). Passo de 5°.
  let rose: SVGSVGElement
  function aim(e: PointerEvent): void {
    const r = rose.getBoundingClientRect()
    const dx = e.clientX - (r.left + r.width / 2)
    const dy = e.clientY - (r.top + r.height / 2)
    if (dx === 0 && dy === 0) return
    const deg = (Math.atan2(dx, -dy) * 180) / Math.PI
    windFrom = (Math.round(deg / 5) * 5 + 360) % 360
  }
  function onpointerdown(e: PointerEvent): void {
    rose.setPointerCapture(e.pointerId)
    aim(e)
  }
  function onpointermove(e: PointerEvent): void {
    if (rose.hasPointerCapture(e.pointerId)) aim(e)
  }
  function onkeydown(e: KeyboardEvent): void {
    const step = e.shiftKey ? 45 : 5
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') windFrom = (windFrom + step) % 360
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown')
      windFrom = (windFrom - step + 360) % 360
    else return
    e.preventDefault()
  }
</script>

<aside>
  <section>
    <h2>Landscape</h2>
    <button class="open" onclick={onopen} title="Open another landscape folder">
      <span
        >{meta
          ? `${meta.nome} · ${(meta.lado / 1000).toLocaleString('en-US')} km`
          : 'Open landscape…'}</span
      >
      <span class="note">{meta ? 'change' : ''}</span>
    </button>
    {#if meta}
      <dl>
        <dt>Grid</dt>
        <dd class="mono">{meta.nx} × {meta.ny} · {meta.lado / meta.nx} m</dd>
      </dl>
      <label class="check">
        <input type="checkbox" bind:checked={relief} onchange={onrelief} />
        Use real terrain
      </label>
      <label class="check">
        <input type="checkbox" bind:checked={showFuel} />
        Show fuel on map
      </label>
      {#if showFuel}
        <ul class="legend">
          {#each Object.entries(meta.legenda ?? {}) as [index, f] (index)}
            <li>
              <span style:background={`rgb(${f.rgb.join(',')})`}></span>{f.nome}
              <em class="mono">{f.profundidade} m</em>
            </li>
          {/each}
          <li class="note">transparent: no fuel (barrier)</li>
        </ul>
      {/if}
    {/if}
  </section>

  <section>
    <h2>Ignition</h2>
    <div class="ignition">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--accent)"
        stroke-width="1.8"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
      </svg>
      <span class="mono">{ignitionLabel}</span>
    </div>
    <p class="note">Click the map to move it.</p>
  </section>

  <section>
    <h2>Wind</h2>
    <div class="wind">
      <svg
        class="rose"
        bind:this={rose}
        width="76"
        height="76"
        viewBox="0 0 100 100"
        role="slider"
        tabindex="0"
        aria-label="Wind direction (blowing from)"
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={windFrom}
        aria-valuetext={`from the ${fromName}, ${windFrom}°`}
        {onpointerdown}
        {onpointermove}
        {onkeydown}
      >
        <circle cx="50" cy="50" r="44" fill="none" stroke="var(--border)" />
        <text x="50" y="14">N</text>
        <text x="90" y="53">E</text>
        <text x="50" y="94">S</text>
        <text x="10" y="53">W</text>
        <line
          x1={arrow.tail[0]}
          y1={arrow.tail[1]}
          x2={arrow.tip[0]}
          y2={arrow.tip[1]}
          stroke="var(--accent)"
          stroke-width="2"
          stroke-linecap="round"
        />
        <path
          d="M0 0 L-5 9 L5 9 Z"
          fill="var(--accent)"
          transform={`translate(${arrow.tip[0]} ${arrow.tip[1]}) rotate(${arrow.deg})`}
        />
        <circle cx={arrow.tail[0]} cy={arrow.tail[1]} r="4" fill="var(--text)" />
      </svg>
      <div class="wind-read">
        <span class="mono big">{windSpeed.toLocaleString('en-US')} <small>m/s</small></span>
        <span class="note">from the {fromName} · {windFrom}°</span>
        <span class="note hint">drag on the rose</span>
      </div>
    </div>
    <label>
      Speed
      <input type="range" min="0" max="15" step="0.5" bind:value={windSpeed} />
    </label>
  </section>

  <section>
    <h2>Simulation <span class="note">· 1 h, 30 s steps</span></h2>
    <button class="run" onclick={onrun} disabled={running || !canRun}>
      {#if running}
        Simulating… {progress}
      {:else}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--accent)" aria-hidden="true"
          ><path d="M6 4l14 8-14 8z" /></svg
        >
        Run simulation
      {/if}
    </button>
    {#if error}<p class="error">{error}</p>{/if}
  </section>
</aside>

<style>
  .open {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    padding: 6px 8px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font: inherit;
    font-size: 12px;
    color: var(--text);
    text-align: left;
    cursor: pointer;
  }
  .open:hover {
    background: var(--surface-2);
  }
  aside {
    width: 288px;
    flex-shrink: 0;
    overflow-y: auto;
    background: var(--bg);
    border-right: 1px solid var(--border);
  }
  section {
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  section:last-child {
    border-bottom: 0;
  }
  h2 {
    margin: 0 0 2px;
    font-size: 11px;
    font-weight: 500;
    color: var(--muted);
  }
  h2 .note {
    font-size: 11px;
    opacity: 0.7;
  }
  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 6px 12px;
    margin: 0;
    font-size: 12px;
  }
  dt {
    color: var(--muted);
  }
  dd {
    margin: 0;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12px;
    color: var(--muted);
  }
  .check {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    min-height: 22px;
    font-size: 12px;
    color: var(--text-2);
    cursor: pointer;
  }
  .check input {
    order: 1;
    width: 13px;
    height: 13px;
    margin: 0;
    cursor: pointer;
  }
  input[type='range'] {
    width: 100%;
    margin: 0;
  }
  .mono {
    font-family: var(--mono);
  }
  .note {
    margin: 0;
    font-size: 11px;
    color: var(--muted);
  }
  .error {
    margin: 0;
    font-size: 12px;
    color: var(--danger);
  }
  .legend {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 12px;
    color: var(--text-2);
  }
  .legend li {
    display: flex;
    align-items: center;
  }
  .legend em {
    margin-left: auto;
    font-style: normal;
    font-size: 11px;
    color: var(--muted);
  }
  .legend span {
    display: inline-block;
    flex-shrink: 0;
    width: 8px;
    height: 8px;
    margin-right: 8px;
    border-radius: 2px;
  }
  .ignition {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
  }
  .wind {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .wind text {
    fill: var(--muted);
    font-family: var(--mono);
    font-size: 9px;
    text-anchor: middle;
  }
  .rose {
    flex-shrink: 0;
    cursor: crosshair;
    touch-action: none;
    border-radius: 50%;
  }
  .rose:focus-visible {
    outline: 2px solid var(--accent-text);
    outline-offset: 2px;
  }
  .hint {
    opacity: 0.7;
  }
  .wind-read {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .big {
    font-size: 16px;
  }
  .big small {
    font-size: 11px;
    color: var(--muted);
  }
  .run {
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface-2);
    color: var(--text);
    font-weight: 500;
    font-size: 12px;
    cursor: pointer;
    transition:
      background 0.15s,
      border-color 0.15s;
  }
  .run:hover:not(:disabled) {
    background: #2c2722;
    border-color: #4a423b;
  }
  .run:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
