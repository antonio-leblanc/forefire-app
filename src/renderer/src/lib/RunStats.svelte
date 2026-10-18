<script lang="ts">
  import type { Timeline } from '../engine/types'

  interface Props {
    timeline: Timeline
    current: number
  }
  let { timeline, current }: Props = $props()

  const OUTCOME: Record<string, string> = {
    'step-limit': 'ainda queimando',
    'burnt-out': 'apagou',
    'left-domain': 'saiu da área',
    stalled: 'parou de crescer',
    'never-caught': 'não pegou'
  }

  const frame = $derived(timeline.frames[current])
</script>

<div class="stats">
  <div>
    <span class="label">Área queimada</span>
    <span class="value mono"
      >{((frame?.area ?? 0) / 10000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ha</span
    >
  </div>
  <div>
    <span class="label">Situação</span>
    <span class="value small">{OUTCOME[timeline.outcome] ?? timeline.outcome}</span>
  </div>
  <div>
    <span class="label">Solver</span>
    <span class="value small mono">{timeline.wallMs.toFixed(0)} ms</span>
  </div>
</div>

<style>
  .stats {
    position: absolute;
    top: 12px;
    left: 12px;
    z-index: 1;
    display: flex;
    gap: 20px;
    padding: 12px 16px;
    background: rgba(28, 25, 22, 0.92);
    border: 1px solid var(--border);
    border-radius: 8px;
  }
  .stats div {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .label {
    font-size: 11px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .value {
    font-size: 20px;
  }
  .small {
    font-size: 15px;
    padding-top: 4px;
  }
  .mono {
    font-family: var(--mono);
  }
</style>
