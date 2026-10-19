# PLAN — M2: dados reais

**Onde está:** M2 feito, menos o passo 4 (fechar o mapeamento), que depende do Lab. M3 com os passos 1 a 3 feitos e a etapa 1 da trilha de estudo (o Rothermel por dentro); os próximos são o passo 4 (fechar o `MAPEAMENTO.md` com o Lab) e a etapa 2 da trilha.

Passo a passo dos milestones em curso. As decisões ficam no [`SPEC.md`](./SPEC.md) (§5); aqui fica só a execução. Cada passo termina com algo que dá pra ver rodando.

## 1. Pipeline: primeiro pacote
- [x] Projeto `uv` em `pipeline/` (`rasterio`, `numpy`)
- [x] Área de desenvolvimento: 5 km em Alto Paraíso de Goiás (Chapada dos Veadeiros), com mata, arbusto, campo, cultivo, cidade e um pouco de água
- [x] Script com centro e lado na linha de comando (`--lat --lon --lado`), em qualquer lugar do mundo: lê só a janela necessária dos COGs no S3, emendando tiles quando a área cruza a borda de um
- [x] Grade com a mesma conversão do `landscape/geo.ts`; amostra por vizinho mais próximo; célula de 20 m (como no M1), e só desce pra 10 m depois de medir o tempo do solver
- [x] Mapeamento provisório: mata/arbusto → linha 5, campo/cultivo → linha 4, o resto → barreira
- [x] Escreve o pacote (§5.2) numa pasta ignorada pelo git, mais um GeoTIFF de inspeção

**Pronto quando:** o GeoTIFF de inspeção, aberto por cima do WorldCover, bate no lugar e na forma. Conferido pelo centróide: a área construída cai em cima da cidade.

## 2. App abre o pacote
- [x] IPC no main: escolher a pasta, ler `meta.json`, os `.bin` e o `fuels.csv`, devolver ao renderer
- [x] Renderer monta a `Landscape` do pacote no lugar da sintética
- [x] Raster de combustível como camada opcional, desligada por padrão
- [x] Sai a paisagem sintética do M1
- [x] Conferir no app: lugar certo, fogo parando na cidade

**Pronto quando:** a paisagem real aparece no lugar certo e o fogo roda nela, parando nos rios e nas áreas construídas.

## 3. Casca do app
Vem antes do resto do M2: hillshade, legenda e aviso de aproximação já nascem no layout novo (SPEC §7.1, §7.2).
- [x] Tema: cores do SPEC §7.2 como variáveis no `app.css`; IBM Plex Sans e Mono via `@fontsource`
- [x] Layout: o `RunPanel` vira `Header`, `Sidebar` (Paisagem, Ignição, Vento, Simulação), `Timeline` e `StatusBar`; a lógica só muda de lugar
- [x] Cartão flutuante no mapa: área queimada, situação, solver
- [x] Rosa dos ventos: arrastar a direção no lugar do slider de 0–359°
- [x] Ícone a partir do `ff_logo.png` do motor (`.png`, `.ico`, `.icns`, gerados por `scripts/make_icon.py`); título da janela `ForeFire — <paisagem>`

**Pronto quando:** o app faz exatamente o que faz hoje, com a cara do SPEC §7, e aparece com o logo na barra de tarefas.

## 4. Mapeamento WorldCover → S2GLC
- [x] `fuels.csv` vira a tabela S2GLC do ForeFire (SPEC §5.3)
- [x] Cada classe do WorldCover → classe S2GLC, em `pipeline/MAPEAMENTO.md`, com o porquê
- [x] Versão do mapeamento e legenda (nome, cor da paleta do ForeFire, profundidade) no `meta.json`; o app desenha a partir dela
- [ ] Estudar as colunas do Rothermel e fechar as escolhas em aberto do `MAPEAMENTO.md`: sai pelo Lab (M3, passo 4)
- [ ] Conferir no app: Alto Paraíso e Córsega

**Pronto quando:** cada classe tem combustível justificado, e o fogo se comporta como o mapeamento diz que deveria (corre mais rápido no campo do que na floresta, por exemplo).

## 5. Relevo
- [x] Pipeline lê o Copernicus DEM (bilinear) e grava o `altitude.bin` real
- [x] Toggle **Relevo** no app: ligado usa o `altitude.bin`, desligado manda zeros
- [x] Hillshade do relevo real no mapa
- [x] Conferir com e sem relevo: na Córsega, ignição num declive de ~59°, sem vento, 1 h: 3,8 ha plano contra 12,5 ha com relevo, e o centro da área queimada sobe ~100 m encosta acima. Em Alto Paraíso (chapada, ~14°) a diferença é pequena (3,8 contra 4,1 ha)

**Pronto quando:** a mesma ignição, com e sem relevo, dá frentes diferentes num declive visível.

## 6. Atribuição e aviso
- [x] Atribuição do ESA WorldCover (CC-BY 4.0) e do Copernicus DEM na UI (rodapé do mapa, lida do `meta.json`)
- [x] Aviso de que o combustível é aproximação a partir de cobertura do solo, com link pro `MAPEAMENTO.md`

**Pronto quando:** o app mostra de onde vem cada dado e o que é aproximação.

---

# PLAN — M3: Lab

Começa pelo Model Playground (SPEC §6.2). O primeiro uso dele é fechar as escolhas em aberto do `MAPEAMENTO.md` (M2, passo 4): ver na curva o que cada coluna faz com a velocidade, em vez de decidir no olho.

**O que o motor oferece**, conferido em `Command.cpp` e `Rothermel.cpp`:
- `computeSpeed[slope;normalWind;<22 colunas>]` devolve a velocidade do modelo de propagação ativo, em m/s, sem fogo nenhum no domínio.
- `slope` é a tangente do declive; `normalWind` é o vento normal à frente, em m/s. As 22 colunas são a linha da `fuelsTable` sem o `Index`, na ordem do SPEC §4.
- A curva já inclui o `windReductionFactor` (0,4) e o teto de vento de Andrews/Cruz/Rothermel (2013). O `propagationSpeedAdjustmentFactor` não entra: a frente no mapa anda mais devagar que a curva.

## 1. Gráficos e aba
- [x] Biblioteca decidida no SPEC §2.4: Observable Plot
- [x] Abas **Simulation · Lab** no header (SPEC §7.1); o mapa e a simulação ficam montados ao trocar de aba

## 2. Velocidade no worker
- [x] Mensagem `speeds` no worker: recebe a `fuelsTable` e uma lista de pontos (fuel, declive, vento, `Md`), devolve as velocidades. Um Module só pro Lab, já que não há fogo e o estado global não vaza
- [x] Conferir contra o protótipo em Node: Rothermel sem declive, linha 82, vento 5 m/s ≈ 26 m/min (26,1)

## 3. Model Playground
- [x] Três curvas: ROS × vento (0–15 m/s), ROS × declive (0–40°), ROS × umidade do morto `Md` (0,02 até a umidade de extinção `me`)
- [x] Uma linha por combustível que queima (`e` > 0) da tabela S2GLC inteira (`pipeline/fuels.csv`), não só os da paisagem aberta: a Córsega não tem conífera, e sem ela não há como comparar 82 com 83. Os da paisagem aparecem marcados. Nome e cor vêm de `pipeline/s2glc.json`, o mesmo que o pipeline usa
- [x] As duas variáveis fora do eixo ficam em controles (vento e declive fixos na curva de umidade, e assim por diante)
- [x] Combustíveis com a mesma linha de parâmetros desenham uma curva só, com os nomes juntos na legenda
- [x] Tabela no formato do `fuels.csv`: uma linha por `Index`, as 22 colunas na ordem do arquivo. As 7 que o `getSpeed` lê (`e`, `Sigmad`, `Rhod`, `sd`, `Md`, `me`, `DeltaH`) em destaque, com o significado no cabeçalho e num glossário; β/βop como coluna derivada

**Pronto quando:** dá pra apontar na tela por que a conífera (83) corre mais que a folhosa (82), e qual coluna responde por isso.

## 4. Fechar o mapeamento com o Lab
- [ ] Folhosa ou conífera pra classe 10 do WorldCover
- [ ] Campo (30): o que a profundidade de 0,60 m faz com a velocidade, e se outra linha da tabela do ForeFire representa melhor o campo baixo
- [ ] Área úmida (90): a curva de umidade mostra onde a herbácea para de queimar; decidir entre barreira e herbácea, sabendo que a segunda pede um `Md` fora da tabela do ForeFire (SPEC §5.3 diz que a física vem sem alteração)
- [ ] Cada decisão no `MAPEAMENTO.md` com o porquê e o gráfico que a sustenta; se a tabela mudar, versão `worldcover-s2glc-2`

**Pronto quando:** o `MAPEAMENTO.md` não tem mais escolha em aberto, e o passo 4 do M2 fecha.

## 4b. Trilha de estudo do motor
Quatro etapas pra entender o ForeFire, não só o modelo de ROS: o modelo é uma peça trocável, e o que é do ForeFire está em volta dela (SPEC §6.2). Cada etapa é uma seção do Lab que explica a peça com ela rodando.

1. **O Rothermel por dentro**
   - [x] Espelho do `Rothermel::getSpeed` em `lab/inside.ts`, mesmas conversões, devolvendo cada termo. Conferido em Node contra o `computeSpeed`: 504 casos (7 combustíveis × vento × declive × umidade, inclusive acima da extinção), diferença máxima de 4·10⁻⁶, que é o arredondamento do texto que o motor imprime
   - [x] Seção no Lab: um combustível, `Md` num slider, vento e declive da sidebar. A equação `R = R0 × (1 + φw + φs)` com os números, a barra com o peso de cada parcela, e as três parcelas abertas: R0 como fonte de calor (IR, ηM, ξ) sobre sumidouro (ρb, ε, Qig), φw com o vento na altura da chama e o teto de 2013, φs com o declive
   - [x] A velocidade do espelho conferida na tela contra o `computeSpeed`
2. **A frente andando:** os nós do perímetro, a normal de cada um, o vento projetado nela e o ROS que o modelo devolve pra aquele nó. Detalhar quando começar
3. **As camadas:** de onde cada nó tira combustível, altitude e vento, e o mesmo fogo com o mapa trocado por baixo
4. **O avanço no tempo:** cada nó agenda o próprio próximo passo; o estado global da #175 aparece aqui

**Pronto quando:** dá pra explicar, olhando a tela, por que um nó da frente anda na velocidade que anda.

## 5. Fuel Studio
Detalhado quando o Playground estiver de pé: editar as colunas de um combustível e ver a curva mudar junto, com a linha original de referência.
