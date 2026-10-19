<script lang="ts" module>
  export type Mode = 'simulation' | 'lab'
</script>

<script lang="ts">
  import logo from '../assets/logo.png'

  interface Props {
    /** Versão do motor, conhecida depois do primeiro run. */
    version: string | null
    engineReady: boolean
    mode: Mode
  }
  let { version, engineReady, mode = $bindable() }: Props = $props()

  const MODES: [Mode, string][] = [
    ['simulation', 'Simulation'],
    ['lab', 'Lab']
  ]

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
  <div class="sep"></div>
  <nav>
    {#each MODES as [key, label] (key)}
      <button class:active={mode === key} onclick={() => (mode = key)}>{label}</button>
    {/each}
  </nav>
  <div class="grow"></div>
  <span class="engine">{engineLabel}</span>
</header>

<style>
  header {
    height: 44px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 12px;
    background: var(--bg);
    border-bottom: 1px solid var(--border);
    user-select: none;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    font-size: 14px;
  }
  .brand img {
    width: 18px;
    height: 20px;
    object-fit: contain;
  }
  .sep {
    width: 1px;
    height: 16px;
    background: var(--border);
  }
  nav {
    display: flex;
    gap: 2px;
  }
  nav button {
    height: 28px;
    padding: 0 10px;
    background: none;
    border: 0;
    border-radius: var(--radius);
    font-size: 12px;
    color: var(--muted);
    cursor: pointer;
  }
  nav button:hover {
    color: var(--text);
  }
  nav button.active {
    background: var(--surface-2);
    color: var(--text);
  }
  .grow {
    flex: 1;
  }
  .engine {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--muted);
  }
</style>
