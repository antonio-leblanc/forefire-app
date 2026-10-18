# PLAN — M2: dados reais

Passo a passo do milestone atual. As decisões ficam no [`SPEC.md`](./SPEC.md) (§5); aqui fica só a execução. Cada passo termina com algo que dá pra ver rodando.

## 1. Pipeline: primeiro pacote
- [x] Projeto `uv` em `pipeline/` (`rasterio`, `numpy`)
- [x] Área de desenvolvimento: 5 km em Alto Paraíso de Goiás (Chapada dos Veadeiros), com mata, arbusto, campo, cultivo, cidade e um pouco de água
- [x] Script com centro e lado no topo do arquivo: lê só a janela necessária do COG do WorldCover no S3
- [x] Grade com a mesma conversão do `landscape/geo.ts`; amostra por vizinho mais próximo; célula de 20 m (como no M1), e só desce pra 10 m depois de medir o tempo do solver
- [x] Mapeamento provisório: mata/arbusto → linha 5, campo/cultivo → linha 4, o resto → barreira
- [x] Escreve o pacote (§5.2) numa pasta ignorada pelo git, mais um GeoTIFF de inspeção

**Pronto quando:** o GeoTIFF de inspeção, aberto por cima do WorldCover, bate no lugar e na forma. Conferido pelo centróide: a área construída cai em cima da cidade.

## 2. App abre o pacote
- [x] IPC no main: escolher a pasta, ler `meta.json`, os `.bin` e o `fuels.csv`, devolver ao renderer
- [x] Renderer monta a `Landscape` do pacote no lugar da sintética
- [x] Raster de combustível como camada opcional, desligada por padrão
- [x] Sai a paisagem sintética do M1
- [ ] Conferir no app: lugar certo, fogo parando na cidade

**Pronto quando:** a paisagem real aparece no lugar certo e o fogo roda nela, parando nos rios e nas áreas construídas.

## 3. Mapeamento próprio
- [ ] Estudar as classes do WorldCover e as colunas do Rothermel no `fuels.csv` (o que `sd`, `Md`, `Sigmad`, `e` significam)
- [ ] Escolher uma linha (ou criar uma, a partir da literatura) pra cada classe
- [ ] `pipeline/MAPEAMENTO.md`: classe → combustível, com a justificativa e a fonte de cada escolha
- [ ] Versão do mapeamento no `meta.json`

**Pronto quando:** cada classe tem combustível justificado, e o fogo se comporta como o mapeamento diz que deveria (corre mais rápido no campo do que na floresta, por exemplo).

## 4. Relevo
- [x] Pipeline lê o Copernicus DEM (bilinear) e grava o `altitude.bin` real
- [x] Toggle **Relevo** no app: ligado usa o `altitude.bin`, desligado manda zeros
- [ ] Hillshade do relevo real no mapa

**Pronto quando:** a mesma ignição, com e sem relevo, dá frentes diferentes num declive visível.

## 5. Atribuição e aviso
- [x] Atribuição do ESA WorldCover (CC-BY 4.0) e do Copernicus DEM na UI (rodapé do mapa, lida do `meta.json`)
- [ ] Aviso de que o combustível é aproximação a partir de cobertura do solo, com link pro `MAPEAMENTO.md`

**Pronto quando:** o app mostra de onde vem cada dado e o que é aproximação.
