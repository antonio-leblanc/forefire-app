<script lang="ts">
  interface Props {
    /** Fontes dos dados da paisagem, com licença (atribuição obrigatória, SPEC §5.1). */
    sources: string[]
    hasPack: boolean
  }
  let { sources, hasPack }: Props = $props()
</script>

<footer>
  <span>{sources.join(' · ')}</span>
  <span class="grow"></span>
  {#if hasPack}
    <span>Fuel approximated from land cover</span>
  {/if}
</footer>

<style>
  footer {
    flex-shrink: 0;
    display: flex;
    gap: 16px;
    padding: 5px 12px;
    background: var(--bg);
    border-top: 1px solid var(--border);
    font-size: 11px;
    color: var(--muted);
  }
  .grow {
    flex: 1;
  }
</style>
