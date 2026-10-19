<script lang="ts">
  // O Rothermel por dentro (PLAN M3, trilha de estudo, etapa 1): um combustível,
  // a fórmula aberta em três parcelas, e a velocidade conferida contra o motor.
  import type { Engine } from '../engine/client'
  import { SOLVER } from '../engine/solver'
  import { inside } from './inside'
  import { FUELS_TABLE, GROUPS, type FuelGroup, query, value } from './rothermel'

  interface Props {
    engine: Engine
    wind: number
    /** Graus. */
    slope: number
    /** Índices da fuelsTable que aparecem na paisagem aberta. */
    present: number[]
  }
  let { engine, wind, slope, present }: Props = $props()

  const initial = (): FuelGroup =>
    GROUPS.find((g) => g.fuels.some((f) => present.includes(f.index))) ?? GROUPS[0]
  let group = $state(initial())
  let md = $state(value(initial(), 'Md'))
  const pick = (label: string): void => {
    group = GROUPS.find((g) => g.label === label)!
    md = value(group, 'Md')
  }

  const tan = $derived(Math.tan((slope * Math.PI) / 180))
  const x = $derived(inside(group, tan, wind, SOLVER.windReductionFactor, md))
  const me = $derived(value(group, 'me'))

  // A mesma conta pelo motor: se o espelho divergir, a tela mente.
  let engineR = $state<number | null>(null)
  let latest = 0
  $effect(() => {
    const id = ++latest
    engine
      .speeds({ fuelsTable: FUELS_TABLE, queries: [query(group, slope, wind, md)] })
      .then(([s]) => id === latest && (engineR = s * 60))
      .catch(() => id === latest && (engineR = null))
  })
  const agrees = $derived(engineR !== null && Math.abs(engineR - x.r) <= 1e-4 * Math.max(1, x.r))

  const f = (v: number, d = 2): string =>
    v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
  const source = $derived(x.ir * x.xi)
  const sink = $derived(x.rhoBulk * x.epsilon * x.qig)
  // Fatia de cada parcela no multiplicador (1 + φw + φs).
  const total = $derived(1 + x.phiW + x.phiS)
</script>

<section class="inside">
  <h3>Inside Rothermel <span class="sub">one fuel, the formula opened up</span></h3>

  <div class="controls">
    <label>
      Fuel
      <select value={group.label} onchange={(e) => pick(e.currentTarget.value)}>
        {#each GROUPS as g (g.label)}
          <option value={g.label}>{g.fuels.map((fu) => fu.index).join('/')} {g.label}</option>
        {/each}
      </select>
    </label>
    <label class="md">
      <span class="row"
        >Dead moisture Md <span class="mono"
          >{f(md)}
          <span class="dim">· table {f(value(group, 'Md'))} · extinction {f(me)}</span></span
        ></span
      >
      <input type="range" min="0.02" max={+(me + 0.05).toFixed(2)} step="0.01" bind:value={md} />
    </label>
    <p class="dim">Wind {f(wind, 1)} m/s and slope {slope}° come from the sidebar.</p>
  </div>

  <div class="equation mono">
    <span class="big">R = R0 × (1 + φw + φs)</span>
    <span class="big"
      >{f(x.r, 1)} = {f(x.r0)} × (1 + {f(x.phiW)} + {f(x.phiS)})
      <span class="unit">m/min</span></span
    >
    <span class="check" class:bad={!agrees}>
      {#if engineR === null}engine: —{:else if agrees}engine computeSpeed: {f(engineR, 1)} m/min, same
      {:else}engine computeSpeed: {f(engineR, 1)} m/min, the mirror is off{/if}
    </span>
  </div>

  <div class="bar" title="Share of each part in the multiplier (1 + φw + φs)">
    <span class="base" style:flex-grow={1 / total}>base</span>
    <span class="wind" style:flex-grow={x.phiW / total}>{x.phiW / total > 0.08 ? 'wind' : ''}</span>
    <span class="slope" style:flex-grow={x.phiS / total}
      >{x.phiS / total > 0.08 ? 'slope' : ''}</span
    >
  </div>

  <div class="parts">
    <article>
      <h4>
        <span class="mono">R0</span> the fire alone <span class="mono val">{f(x.r0)} m/min</span>
      </h4>
      <p>
        No wind, no slope: how fast the heat the front releases can bring the fuel ahead to
        ignition. A ratio of what reaches the fuel to what the fuel needs.
      </p>
      <p class="mono formula">
        R0 = IR·ξ / (ρb·ε·Qig) = {f(source, 1)} kW/m² / {f(sink, 0)} kJ/m³
      </p>
      <dl>
        <dt class="group">heat source</dt>
        <dd></dd>
        <dt><span class="mono">IR</span> {f(x.ir, 0)} kW/m²</dt>
        <dd>
          Reaction intensity: heat released by the burning zone. Load <code>Sigmad</code> × heat
          <code>DeltaH</code> × reaction velocity Γ' ({f(x.reactionVelocity, 1)} /min, peaks when the
          bed is at its optimum packing) × moisture damping ηM.
        </dd>
        <dt><span class="mono">ηM</span> {f(x.etaM)}</dt>
        <dd>
          Moisture damping, from Md / me = {f(x.moistureRatio)}. 1 when dry, 0 at extinction:
          {#if x.etaM <= 0}<strong>the reaction has stopped, nothing spreads.</strong>{:else}water
            in the fuel quenches the reaction.{/if}
        </dd>
        <dt><span class="mono">ξ</span> {f(x.xi, 3)}</dt>
        <dd>
          Propagating flux ratio: the share of IR that actually reaches the unburnt fuel. Grows with
          finer particles (<code>sd</code>) and a denser bed.
        </dd>
        <dt class="group">heat sink</dt>
        <dd></dd>
        <dt><span class="mono">ρb</span> {f(x.rhoBulk)} kg/m³</dt>
        <dd>
          Bulk density, <code>Sigmad</code> / <code>e</code>: fuel mass per volume of bed that has
          to be heated.
        </dd>
        <dt><span class="mono">ε</span> {f(x.epsilon)}</dt>
        <dd>
          Effective heating number: the part of each particle that heats before it ignites. Near 1
          for fine fuel (<code>sd</code> high), small for logs.
        </dd>
        <dt><span class="mono">Qig</span> {f(x.qig, 0)} kJ/kg</dt>
        <dd>
          Heat of preignition: warm 1 kg of fuel and boil its water off. Only Md moves it: wetter
          fuel costs more.
        </dd>
      </dl>
    </article>

    <article>
      <h4><span class="mono">φw</span> wind <span class="mono val">× {f(1 + x.phiW)}</span></h4>
      <p>
        Wind tilts the flame over the fuel ahead and pushes heat into it. The engine first brings
        the wind down to flame height, then caps it.
      </p>
      <dl>
        <dt><span class="mono">U</span> {f(x.windMidflame)} m/s</dt>
        <dd>
          Midflame wind: {f(wind, 1)} m/s × windReductionFactor {SOLVER.windReductionFactor}.
        </dd>
        <dt><span class="mono">Umax</span> {f(x.windCap, 1)} m/s</dt>
        <dd>
          Wind limit of Andrews, Cruz & Rothermel (2013), from IR: past it, more wind adds nothing.
          {#if x.capped}<strong>Capped now.</strong>{/if}
        </dd>
        <dt><span class="mono">β/βop</span> {f(x.beta / x.betaOp)}</dt>
        <dd>
          Packing against the optimum. A looser bed (below 1) lets wind through and gets a bigger φw
          for the same U.
        </dd>
      </dl>
    </article>

    <article>
      <h4><span class="mono">φs</span> slope <span class="mono val">× {f(1 + x.phiS)}</span></h4>
      <p>
        Upslope, the fuel ahead leans into the flame and preheats. Grows with the square of the
        slope's tangent, so 30° does far more than twice 15°.
      </p>
      <p class="mono formula">φs = 5.275 · β^−0.3 · tan²({slope}°)</p>
      <dl>
        <dt><span class="mono">tan</span> {f(tan)}</dt>
        <dd>Slope as the engine reads it. Downslope counts as flat.</dd>
        <dt><span class="mono">β</span> {f(x.beta, 4)}</dt>
        <dd>Packing ratio: the looser the bed, the more the slope helps.</dd>
      </dl>
    </article>
  </div>
  <p class="caption">
    Same computation as <code>Rothermel::getSpeed</code> in the engine, term by term, shown in SI.
    The engine works in imperial units inside; the final speed above is checked against its
    <code>computeSpeed</code>.
  </p>
</section>

<style>
  .inside {
    margin-top: 28px;
  }
  h3 {
    margin: 0 0 10px;
    font-size: 12px;
    font-weight: 600;
  }
  h4 {
    margin: 0 0 6px;
    font-size: 12px;
    font-weight: 600;
    display: flex;
    gap: 8px;
    align-items: baseline;
  }
  h4 .val {
    margin-left: auto;
    font-weight: 500;
  }
  .sub,
  .dim {
    font-weight: 400;
    color: var(--paper-text-2);
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 28px;
    align-items: end;
    font-size: 12px;
  }
  .controls label {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .controls .md {
    min-width: 320px;
  }
  .controls p {
    margin: 0;
  }
  .row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }
  select {
    font: inherit;
    padding: 3px 6px;
    background: var(--paper);
    color: var(--paper-text);
    border: 1px solid var(--paper-border);
    border-radius: 4px;
  }
  .equation {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 16px 0 10px;
  }
  .big {
    font-size: 15px;
  }
  .unit {
    font-size: 11px;
    color: var(--paper-text-2);
  }
  .check {
    font-size: 11px;
    color: var(--paper-text-2);
  }
  .check.bad {
    color: #b3261e;
  }
  .bar {
    display: flex;
    height: 18px;
    max-width: 720px;
    border-radius: 3px;
    overflow: hidden;
    font-size: 10px;
    color: #fff;
  }
  .bar span {
    flex-basis: 0;
    display: flex;
    align-items: center;
    padding-left: 6px;
    overflow: hidden;
    white-space: nowrap;
  }
  .base {
    background: #8a7f75;
  }
  .wind {
    background: #c2571f;
  }
  .slope {
    background: #6b4f3a;
  }
  .parts {
    display: grid;
    grid-template-columns: repeat(3, minmax(240px, 1fr));
    gap: 24px;
    margin-top: 18px;
  }
  article {
    font-size: 12px;
    line-height: 1.5;
  }
  article > p {
    margin: 0 0 8px;
    color: var(--paper-text-2);
  }
  .formula {
    color: var(--paper-text);
    font-size: 11px;
  }
  dl {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 6px 12px;
    margin: 0;
  }
  dt {
    white-space: nowrap;
  }
  dt.group {
    grid-column: 1 / -1;
    margin-top: 4px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--paper-text-2);
  }
  dt.group + dd {
    display: none;
  }
  dd {
    margin: 0;
    color: var(--paper-text-2);
  }
  .caption {
    max-width: 80ch;
    margin: 14px 0 0;
    font-size: 11px;
    line-height: 1.5;
    color: var(--paper-text-2);
  }
  .mono,
  code {
    font-family: var(--mono);
  }
</style>
