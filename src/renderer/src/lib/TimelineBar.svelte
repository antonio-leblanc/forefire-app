<script lang="ts">
  import type { Timeline } from '../engine/types'

  interface Props {
    timeline: Timeline | null
    current: number
    playing: boolean
  }
  let { timeline, current = $bindable(), playing = $bindable() }: Props = $props()

  // Play: um tique a cada 50 ms, para no fim. Run longo pula frames, pra 6 h não
  // levar meio minuto (1 h = 120 frames = 6 s).
  $effect(() => {
    if (!playing || !timeline) return undefined
    const n = timeline.frames.length
    const stride = Math.max(1, Math.round(n / 240))
    const id = setInterval(() => {
      if (current >= n - 1) playing = false
      else current = Math.min(n - 1, current + stride)
    }, 50)
    return () => clearInterval(id)
  })

  function togglePlay(): void {
    if (!timeline) return
    if (!playing && current >= timeline.frames.length - 1) current = 0
    playing = !playing
  }

  const minutes = $derived(Math.round((timeline?.frames[current]?.t ?? 0) / 60))
  const total = $derived(Math.round((timeline?.frames.at(-1)?.t ?? 3600) / 60))
</script>

<div class="bar">
  <button
    class="play"
    onclick={togglePlay}
    disabled={!timeline}
    aria-label={playing ? 'Pause' : 'Play'}
  >
    {#if playing}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <rect x="5" y="4" width="5" height="16" /><rect x="14" y="4" width="5" height="16" />
      </svg>
    {:else}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"
        ><path d="M6 4l14 8-14 8z" /></svg
      >
    {/if}
  </button>
  <span class="time">t = {minutes} min <span class="muted">/ {total}</span></span>
  <input
    type="range"
    aria-label="Simulation time"
    min="0"
    max={timeline ? timeline.frames.length - 1 : 0}
    disabled={!timeline}
    bind:value={current}
    oninput={() => (playing = false)}
  />
  {#if !timeline}
    <span class="muted hint">Run a simulation to watch the fire front spread.</span>
  {/if}
</div>

<style>
  .bar {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    height: 40px;
    padding: 0 12px;
    background: var(--bg);
    border-top: 1px solid var(--border);
  }
  .play {
    width: 28px;
    height: 28px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: var(--radius);
    background: none;
    color: var(--accent-text);
    cursor: pointer;
    transition: background 0.15s;
  }
  .play:hover:not(:disabled) {
    background: var(--surface-2);
  }
  .play:disabled {
    color: var(--muted);
    opacity: 0.5;
    cursor: default;
  }
  .time {
    font-family: var(--mono);
    font-size: 12px;
    min-width: 110px;
  }
  input {
    flex: 1;
    margin: 0;
  }
  .muted {
    color: var(--muted);
  }
  .hint {
    font-size: 11px;
  }
</style>
