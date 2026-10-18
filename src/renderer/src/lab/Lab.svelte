<script lang="ts">
  import * as Plot from '@observablehq/plot'
  import type { Engine } from '../engine/client'
  import { SOLVER } from '../engine/solver'
  import {
    FUELS_TABLE,
    GROUPS,
    type FuelGroup,
    HEADER,
    ROWS,
    USED,
    burns,
    groupOf,
    packing,
    query,
    value
  } from './rothermel'

  interface Props {
    engine: Engine
    /** Índices da fuelsTable que aparecem na paisagem aberta. */
    present: number[]
  }
  let { engine, present }: Props = $props()

  let wind = $state(5)
  let slope = $state(0)
  let hidden = $state<string[]>([])
  let error = $state('')
  let width = $state(0)

  interface Point {
    label: string
    color: string
    x: number
    /** m/min */
    y: number
  }
  interface Curves {
    wind: Point[]
    slope: Point[]
    moisture: Point[]
    /** Cada combustível na umidade da tabela. */
    tableMd: Point[]
  }
  let curves = $state.raw<Curves | null>(null)

  const range = (from: number, to: number, step: number): number[] =>
    Array.from(
      { length: Math.round((to - from) / step) + 1 },
      (_, i) => +(from + i * step).toFixed(4)
    )

  const WINDS = range(0, 15, 0.5)
  const SLOPES = range(0, 40, 1)
  const md = (g: FuelGroup): number[] => range(0.02, value(g, 'me') + 0.04, 0.01)

  // Pedidos em sequência rápida (arrastando o slider): só o último vale.
  let latest = 0
  $effect(() => {
    const w = wind
    const s = slope
    const plan: { curve: keyof Curves; g: FuelGroup; x: number; q: string }[] = []
    for (const g of GROUPS) {
      for (const x of WINDS) plan.push({ curve: 'wind', g, x, q: query(g, s, x) })
      for (const x of SLOPES) plan.push({ curve: 'slope', g, x, q: query(g, x, w) })
      for (const x of md(g)) plan.push({ curve: 'moisture', g, x, q: query(g, s, w, x) })
      plan.push({ curve: 'tableMd', g, x: value(g, 'Md'), q: query(g, s, w) })
    }
    const id = ++latest
    engine
      .speeds({ fuelsTable: FUELS_TABLE, queries: plan.map((p) => p.q) })
      .then((speeds) => {
        if (id !== latest) return
        const out: Curves = { wind: [], slope: [], moisture: [], tableMd: [] }
        plan.forEach((p, i) =>
          out[p.curve].push({ label: p.g.label, color: p.g.color, x: p.x, y: speeds[i] * 60 })
        )
        curves = out
        error = ''
      })
      .catch((err) => (error = String(err?.message ?? err)))
  })

  const visible = (pts: Point[]): Point[] => pts.filter((p) => !hidden.includes(p.label))

  function chart(
    pts: Point[],
    xLabel: string,
    marks: Plot.Markish[],
    w: number
  ): SVGElement | HTMLElement {
    return Plot.plot({
      width: w,
      height: 240,
      marginLeft: 44,
      style: {
        background: 'transparent',
        color: 'var(--paper-text-2)',
        fontFamily: 'var(--mono)',
        fontSize: '10px'
      },
      x: { label: xLabel, labelAnchor: 'center', labelArrow: 'none' },
      y: { label: 'Rate of spread (m/min)', grid: true, zero: true, labelArrow: 'none' },
      color: { type: 'identity' },
      marks: [
        Plot.ruleY([0], { stroke: 'var(--paper-border)' }),
        Plot.line(visible(pts), { x: 'x', y: 'y', z: 'label', stroke: 'color', strokeWidth: 2 }),
        ...marks,
        Plot.tip(
          visible(pts),
          Plot.pointer({
            x: 'x',
            y: 'y',
            fill: 'var(--paper)',
            title: (p: Point) => `${p.label}\n${p.x} → ${p.y.toFixed(1)} m/min`
          })
        )
      ]
    })
  }

  // Cada gráfico desenha num <div>; o Plot devolve o SVG pronto.
  function render(
    node: HTMLElement,
    make: () => SVGElement | HTMLElement | null
  ): { destroy: () => void } {
    const stop = $effect.root(() => {
      $effect(() => {
        const el = make()
        node.replaceChildren(...(el ? [el] : []))
      })
    })
    return { destroy: stop }
  }

  const chartWidth = $derived(Math.max(240, Math.floor((width - 2 * 24 - 2 * 24) / 3)))
  const dashed = { stroke: 'var(--paper-text-2)', strokeDasharray: '3,3' }

  const toggle = (label: string): void => {
    hidden = hidden.includes(label) ? hidden.filter((l) => l !== label) : [...hidden, label]
  }
  const inLandscape = (g: FuelGroup): boolean => g.fuels.some((f) => present.includes(f.index))

  const used = (key: string): string | undefined => {
    const c = USED.find((u) => u.key === key)
    return c && `${c.key} (${c.unit}): ${c.what}`
  }
  const faded = (f: (typeof ROWS)[number]): boolean => {
    const g = groupOf(f)
    return !g || hidden.includes(g.label)
  }
  const num = (v: number): string =>
    Math.abs(v) >= 1e5
      ? v.toExponential(2)
      : v.toLocaleString('en-US', { maximumFractionDigits: 3 })
</script>

<div class="lab">
  <aside>
    <section>
      <h2>Conditions</h2>
      <label>
        <span class="row">Wind <span class="mono">{wind.toFixed(1)} m/s</span></span>
        <input type="range" min="0" max="15" step="0.5" bind:value={wind} />
      </label>
      <label>
        <span class="row">Slope <span class="mono">{slope}°</span></span>
        <input type="range" min="0" max="40" step="1" bind:value={slope} />
      </label>
      <p class="note">Each chart sweeps one variable; the other two stay at these values.</p>
    </section>
    <section>
      <h2>Fuels <span class="note">ForeFire S2GLC table</span></h2>
      <ul class="fuels">
        {#each GROUPS as g (g.label)}
          <li>
            <label class="check">
              <input
                type="checkbox"
                checked={!hidden.includes(g.label)}
                onchange={() => toggle(g.label)}
              />
              <span class="swatch" style:background={g.color}></span>
              <span class="name">
                {#each g.fuels as f, i (f.index)}{i ? ' · ' : ''}{f.name} <em>{f.index}</em>{/each}
              </span>
            </label>
            {#if inLandscape(g)}<span class="here" title="Present in the open landscape"
                >in landscape</span
              >{/if}
          </li>
        {/each}
      </ul>
      <p class="note">
        Fuels with identical parameters are the same fuel to the engine and share one curve.
      </p>
    </section>
    {#if error}
      <section><p class="error">{error}</p></section>
    {/if}
  </aside>

  <main bind:clientWidth={width}>
    <div class="charts">
      <figure>
        <figcaption>Rate of spread × wind</figcaption>
        <div
          use:render={() =>
            curves && chart(curves.wind, 'Wind (m/s)', [Plot.ruleX([wind], dashed)], chartWidth)}
        ></div>
      </figure>
      <figure>
        <figcaption>Rate of spread × slope</figcaption>
        <div
          use:render={() =>
            curves && chart(curves.slope, 'Slope (°)', [Plot.ruleX([slope], dashed)], chartWidth)}
        ></div>
      </figure>
      <figure>
        <figcaption>Rate of spread × dead fuel moisture</figcaption>
        <div
          use:render={() =>
            curves &&
            chart(
              curves.moisture,
              'Dead fuel moisture Md (kg/kg)',
              [
                Plot.dot(visible(curves.tableMd), {
                  x: 'x',
                  y: 'y',
                  fill: 'color',
                  r: 4,
                  stroke: 'var(--paper)'
                })
              ],
              chartWidth
            )}
        ></div>
      </figure>
    </div>
    <p class="caption">
      Rothermel as compiled in the engine, through <code>computeSpeed</code>: wind reduced by
      {SOLVER.windReductionFactor} and capped by the wind limit of Andrews, Cruz & Rothermel (2013). Dots
      on the moisture chart are each fuel's own <code>Md</code> from the table. Simulations on the
      map scale these speeds by {SOLVER.propagationSpeedAdjustmentFactor}.
    </p>

    <h3>
      Fuel table <span class="sub">fuels.csv, one row per Index, as the engine reads it</span>
    </h3>
    <div class="table">
      <table>
        <thead>
          <tr>
            <th class="pin">Index</th>
            <th class="pin name">Class</th>
            {#each HEADER as key (key)}
              <th
                class="mono num"
                class:used={used(key)}
                title={used(key) ?? 'Not read by Rothermel'}>{key}</th
              >
            {/each}
            <th
              class="mono num derived"
              title="Derived, not in the file: Sigmad ÷ e ÷ Rhod against Rothermel's optimum packing ratio. Far from 1 either way, the fire slows."
              >β/βop</th
            >
          </tr>
        </thead>
        <tbody>
          {#each ROWS as f (f.index)}
            <tr class:faded={faded(f)}>
              <td class="pin mono">{f.index}</td>
              <td class="pin name"
                ><span class="swatch" style:background={burns(f) ? f.color : 'transparent'}
                ></span>{f.name}{#if !burns(f)}
                  <em>barrier</em>{/if}</td
              >
              {#each HEADER as key, i (key)}
                <td class="mono num" class:used={used(key)}>{num(f.values[i])}</td>
              {/each}
              <td class="mono num derived">{burns(f) ? packing(f).toFixed(2) : '—'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <dl class="glossary">
      {#each USED as c (c.key)}
        <dt class="mono">{c.key} <span>{c.unit}</span></dt>
        <dd>{c.what}</dd>
      {/each}
      <dt class="mono">β/βop</dt>
      <dd>
        Derived, not in the file: how packed the bed is against Rothermel's optimum (Sigmad ÷ e ÷
        Rhod). Far from 1 either way, the fire slows.
      </dd>
    </dl>
    <p class="caption">
      Columns in full color are the seven that Rothermel reads; the others belong to other models in
      the engine. Hover a column for its meaning. Rows of fuels hidden in the sidebar, and barriers
      (<code>e</code> = 0), are faded.
    </p>
  </main>
</div>

<style>
  /* O assunto do Lab é o gráfico, como o mapa é o da simulação: papel claro
     dentro da moldura escura (SPEC §7.2). */
  .lab {
    --paper: #f4f1ec;
    --paper-border: #d9d3ca;
    --paper-text: #241f1b;
    --paper-text-2: #5f5750;
    flex: 1;
    min-height: 0;
    display: flex;
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
    gap: 10px;
  }
  h2 {
    margin: 0 0 2px;
    font-size: 11px;
    font-weight: 500;
    color: var(--muted);
  }
  h2 .note {
    opacity: 0.7;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12px;
    color: var(--muted);
  }
  .row {
    display: flex;
    justify-content: space-between;
  }
  .row .mono {
    color: var(--text);
  }
  input[type='range'] {
    width: 100%;
    margin: 0;
  }
  .fuels {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .fuels li {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .check {
    flex: 1;
    flex-direction: row;
    align-items: baseline;
    gap: 8px;
    color: var(--text-2);
    cursor: pointer;
  }
  .check input {
    margin: 0;
    width: 13px;
    height: 13px;
    align-self: center;
    cursor: pointer;
  }
  .name em {
    font-style: normal;
    font-family: var(--mono);
    font-size: 10px;
    color: var(--muted);
  }
  .here {
    flex-shrink: 0;
    font-size: 10px;
    color: var(--muted);
  }
  .swatch {
    display: inline-block;
    flex-shrink: 0;
    width: 8px;
    height: 8px;
    border-radius: 2px;
    align-self: center;
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
  main {
    flex: 1;
    min-width: 0;
    overflow: auto;
    padding: 20px 24px;
    background: var(--paper);
    color: var(--paper-text);
  }
  .charts {
    display: grid;
    grid-template-columns: repeat(3, minmax(240px, 1fr));
    gap: 24px;
  }
  figure {
    margin: 0;
  }
  figcaption,
  h3 {
    margin: 0 0 8px;
    font-size: 12px;
    font-weight: 600;
  }
  h3 {
    margin-top: 28px;
  }
  .caption {
    max-width: 80ch;
    margin: 10px 0 0;
    font-size: 11px;
    line-height: 1.5;
    color: var(--paper-text-2);
  }
  .sub {
    font-weight: 400;
    color: var(--paper-text-2);
  }
  .table {
    overflow-x: auto;
    max-width: 100%;
  }
  table {
    border-collapse: separate;
    border-spacing: 0;
    font-size: 12px;
  }
  th,
  td {
    padding: 5px 10px;
    border-bottom: 1px solid var(--paper-border);
    text-align: left;
    white-space: nowrap;
    color: #a39a91;
  }
  th {
    font-weight: 500;
    cursor: help;
  }
  .num {
    text-align: right;
  }
  .used,
  .derived {
    color: var(--paper-text);
  }
  th.used {
    font-weight: 600;
  }
  .derived {
    border-left: 1px solid var(--paper-border);
  }
  /* Index e nome ficam fixos enquanto as 22 colunas rolam. */
  .pin {
    position: sticky;
    left: 0;
    z-index: 1;
    background: var(--paper);
    color: var(--paper-text);
  }
  .pin.name {
    left: 44px;
    border-right: 1px solid var(--paper-border);
  }
  td.pin:first-child,
  th.pin:first-child {
    min-width: 24px;
  }
  .name .swatch {
    margin-right: 8px;
  }
  .name em {
    font-style: normal;
    font-size: 10px;
    color: var(--paper-text-2);
  }
  /* Opacidade não, nas fixas: o fundo delas precisa cobrir o que rola por baixo. */
  tr.faded td:not(.pin) {
    opacity: 0.45;
  }
  tr.faded .pin {
    color: #a39a91;
  }
  .glossary {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 4px 16px;
    max-width: 80ch;
    margin: 14px 0 0;
    font-size: 12px;
  }
  .glossary dt span {
    font-size: 10px;
    color: var(--paper-text-2);
  }
  .glossary dd {
    margin: 0;
    color: var(--paper-text-2);
  }
  .mono,
  code {
    font-family: var(--mono);
  }
</style>
