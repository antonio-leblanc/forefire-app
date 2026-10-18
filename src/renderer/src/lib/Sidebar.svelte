<script lang="ts">
  import { type Domain, toLngLat } from '../landscape/geo'
  import type { PackMeta } from '../landscape/pack'
  import { FUEL_STYLE } from '../landscape/render'

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
    onrun
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
</script>

<aside>
  <section>
    <h2>Landscape</h2>
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
          {#each Object.entries(FUEL_STYLE) as [index, f] (index)}
            <li><span style:background={`rgb(${f.rgb.join(',')})`}></span>{f.label}</li>
          {/each}
          <li class="note">transparent: no fuel (barrier)</li>
        </ul>
      {/if}
    {:else}
      <p class="note">No landscape open.</p>
    {/if}
  </section>

  <section>
    <h2>Ignition</h2>
    <div class="ignition">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--accent)"
        stroke-width="2"
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
        width="80"
        height="80"
        viewBox="0 0 100 100"
        role="img"
        aria-label={`Wind from the ${fromName}`}
      >
        <circle cx="50" cy="50" r="44" fill="var(--surface-2)" stroke="#3a342e" />
        <circle cx="50" cy="50" r="28" fill="none" stroke="var(--border)" />
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
          stroke-width="3"
          stroke-linecap="round"
        />
        <path
          d="M0 0 L-6 10 L6 10 Z"
          fill="var(--accent)"
          transform={`translate(${arrow.tip[0]} ${arrow.tip[1]}) rotate(${arrow.deg})`}
        />
      </svg>
      <div class="wind-read">
        <span class="mono big">{windSpeed.toLocaleString('en-US')} <small>m/s</small></span>
        <span class="note">from the {fromName} · {windFrom}°</span>
      </div>
    </div>
    <label>
      Speed
      <input type="range" min="0" max="15" step="0.5" bind:value={windSpeed} />
    </label>
    <label>
      Direction (blowing from)
      <input type="range" min="0" max="359" step="1" bind:value={windFrom} />
    </label>
  </section>

  <section>
    <h2>Simulation <span class="note">· 1 h, 30 s steps</span></h2>
    <button class="run" onclick={onrun} disabled={running || !canRun}>
      {#if running}
        Simulating… {progress}
      {:else}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"
          ><path d="M6 4l14 8-14 8z" /></svg
        >
        Run simulation
      {/if}
    </button>
    {#if error}<p class="error">{error}</p>{/if}
  </section>
</aside>

<style>
  aside {
    width: 300px;
    flex-shrink: 0;
    overflow-y: auto;
    background: var(--surface);
    border-right: 1px solid var(--border);
  }
  section {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  section:last-child {
    border-bottom: 0;
  }
  h2 {
    margin: 0;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--accent-text);
  }
  h2 .note {
    font-size: 11px;
    font-weight: 400;
    letter-spacing: normal;
    text-transform: none;
  }
  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 6px 12px;
    margin: 0;
    font-size: 13px;
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
    gap: 10px;
    min-height: 24px;
    font-size: 14px;
    color: var(--text);
    cursor: pointer;
  }
  .check input {
    width: 16px;
    height: 16px;
    margin: 0;
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
    font-size: 12px;
    color: var(--muted);
  }
  .error {
    margin: 0;
    font-size: 13px;
    color: var(--danger);
  }
  .legend {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 13px;
    color: var(--text-2);
  }
  .legend span {
    display: inline-block;
    width: 10px;
    height: 10px;
    margin-right: 8px;
    border-radius: 2px;
  }
  .ignition {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    background: var(--surface-2);
    border-radius: var(--radius);
    font-size: 13px;
  }
  .wind {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .wind text {
    fill: var(--muted);
    font-family: var(--mono);
    font-size: 9px;
    text-anchor: middle;
  }
  .wind-read {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .big {
    font-size: 22px;
  }
  .big small {
    font-size: 13px;
    color: var(--muted);
  }
  .run {
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 0;
    border-radius: 8px;
    background: var(--accent);
    color: var(--on-accent);
    font-weight: 600;
    font-size: 15px;
    cursor: pointer;
  }
  .run:hover:not(:disabled) {
    background: #f07a40;
  }
  .run:disabled {
    opacity: 0.55;
    cursor: default;
  }
</style>
