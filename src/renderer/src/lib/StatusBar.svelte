<script lang="ts">
  interface Props {
    /** Fontes dos dados da paisagem, com licença (atribuição obrigatória, SPEC §5.1). */
    sources: string[]
    hasPack: boolean
  }
  let { sources, hasPack }: Props = $props()

  const MAPPING_URL =
    'https://github.com/antonio-leblanc/forefire-app/blob/master/pipeline/MAPEAMENTO.md'
</script>

<footer>
  <span>{sources.join(' · ')}</span>
  <span class="grow"></span>
  {#if hasPack}
    <!-- target=_blank: o main abre no navegador (setWindowOpenHandler) -->
    <a href={MAPPING_URL} target="_blank" rel="noreferrer">Fuel approximated from land cover</a>
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
  a {
    color: inherit;
    text-decoration: underline dotted;
  }
  a:hover {
    color: var(--text);
  }
</style>
