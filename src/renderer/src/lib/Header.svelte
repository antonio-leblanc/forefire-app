<script lang="ts">
  import logo from '../assets/logo.png'

  interface Props {
    /** Nome da paisagem aberta, ou null. */
    name: string | null
    /** Lado do domínio, em metros. */
    side: number
    /** Versão do motor, conhecida depois do primeiro run. */
    version: string | null
    engineReady: boolean
    onopen: () => void
  }
  let { name, side, version, engineReady, onopen }: Props = $props()

  const engineLabel = $derived(
    version
      ? `ForeFire engine ${version} · WASM`
      : engineReady
        ? 'ForeFire engine · WASM'
        : 'loading engine…'
  )
</script>

<header>
  <div class="brand">
    <img src={logo} alt="" />
    <span>ForeFire</span>
  </div>
  <div class="sep"></div>
  <button class="landscape" onclick={onopen} title="Open another landscape">
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      aria-hidden="true"
    >
      <path d="M3 20l6-12 4 7 3-4 5 9z" />
    </svg>
    {#if name}
      {name} · {(side / 1000).toLocaleString('en-US')} km
    {:else}
      Open landscape…
    {/if}
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  </button>
  <div class="grow"></div>
  <span class="engine">{engineLabel}</span>
</header>

<style>
  header {
    height: 52px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 0 16px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 600;
    font-size: 16px;
  }
  .brand img {
    width: 24px;
    height: 26px;
    object-fit: contain;
  }
  .sep {
    width: 1px;
    height: 24px;
    background: var(--border);
  }
  .landscape {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 34px;
    padding: 0 12px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
  }
  .landscape:hover {
    border-color: #4a423b;
  }
  .grow {
    flex: 1;
  }
  .engine {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--muted);
  }
</style>
