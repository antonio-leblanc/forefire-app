<script lang="ts">
  import type { Timeline } from '../engine/types'

  interface Props {
    timeline: Timeline | null
    current: number
    playing: boolean
  }
  let { timeline, current = $bindable(), playing = $bindable() }: Props = $props()

  // Play: avança um frame a cada 50 ms, para no fim.
  $effect(() => {
    if (!playing || !timeline) return undefined
    const n = timeline.frames.length
    const id = setInterval(() => {
      if (current >= n - 1) playing = false
      else current += 1
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
    aria-label={playing ? 'Pausar' : 'Reproduzir'}
  >
    {#if playing}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <rect x="5" y="4" width="5" height="16" /><rect x="14" y="4" width="5" height="16" />
      </svg>
    {:else}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"
        ><path d="M6 4l14 8-14 8z" /></svg
      >
    {/if}
  </button>
  <span class="time">t = {minutes} min <span class="muted">/ {total}</span></span>
  <input
    type="range"
    aria-label="Tempo da simulação"
    min="0"
    max={timeline ? timeline.frames.length - 1 : 0}
    disabled={!timeline}
    bind:value={current}
    oninput={() => (playing = false)}
  />
  {#if !timeline}
    <span class="muted hint">Rode uma simulação pra ver a frente avançar.</span>
  {/if}
</div>

<style>
  .bar {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 10px 16px;
    background: var(--surface);
    border-top: 1px solid var(--border);
  }
  .play {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 50%;
    background: var(--accent);
    color: var(--on-accent);
    cursor: pointer;
  }
  .play:disabled {
    background: var(--surface-2);
    color: var(--muted);
    cursor: default;
  }
  .time {
    font-family: var(--mono);
    font-size: 15px;
    min-width: 130px;
  }
  input {
    flex: 1;
    margin: 0;
  }
  .muted {
    color: var(--muted);
  }
  .hint {
    font-size: 13px;
  }
</style>
