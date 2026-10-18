# ForeFire App — SPEC

**Spec-driven development.** Toda decisão arquitetural, trade-off e milestone mora aqui. O código segue o spec, não o contrário. O passo a passo do milestone atual fica em [`PLAN.md`](./PLAN.md).

Status: M1 concluído, M2 em andamento. Última atualização: 2026-10-18.

---

## 1. Visão

Projeto pessoal pra estudar o ForeFire: entender na prática como a propagação de fogo funciona, mexendo no motor (WASM) num app desktop. Roda local, sem servidor, e funciona offline.

### O que o app faz
- Roda o motor ForeFire de verdade, numa paisagem que o usuário controla (sintética primeiro, dados abertos depois)
- **Modo Lab** pra explorar modelos de propagação e combustíveis
- Instalável e open source

---

## 2. Stack — Decisões

### 2.1 Empacotamento: Electron

**Decisão:** Electron, com [electron-vite](https://electron-vite.org/) como build.

**Por quê:**
- **Filesystem.** O app abre pacotes de paisagem do disco (§5), e isso é natural no processo main.
- Mesmo Chromium em todas as plataformas: o WASM do ForeFire já roda em Chromium.
- Peso (~150MB) aceitável pra app desktop.

**Revisitar se:** o app virar só paisagem sintética + Lab (aí uma página web basta).

### 2.2 UI: Svelte

- Runtime mínimo, reatividade por compilação, pouco boilerplate.
- Suficiente pro estado do app (paisagem + simulação + timeline).

### 2.3 Mapa: Maplibre GL JS

- WebGL, bom pra raster e pra desenhar as frentes de fogo.
- Offline, quando chegar a hora: **PMTiles** via `addProtocol` ([exemplo](https://www.maplibre.org/maplibre-gl-js/docs/examples/pmtiles-source-and-protocol/)). O Maplibre não lê MBTiles nativamente.
- Basemap sem imagem de satélite comercial (a Esri World Imagery tem termos restritivos).

### 2.4 Gráficos: adiado pro M3

Curvas de ROS do Modo Lab. D3 ou Observable Plot, decidido quando o Lab começar.

### 2.5 Dados locais: pacotes de paisagem

- Sem banco. Cada paisagem é uma pasta no disco (§5.2), gerada fora do app.
- SQLite só se um dia houver índice grande de paisagens (o `better-sqlite3` é módulo nativo e exige rebuild pro Electron).

### 2.6 Motor: WASM

**Fonte:** fork [`antonio-leblanc/forefire`](https://github.com/antonio-leblanc/forefire):
- `feat/no-netcdf-build`: opção `FOREFIRE_ENABLE_NETCDF` (padrão ON) pra buildar sem netCDF.
- `feat/wasm-binding`: binding embind + target CMake. **É daqui que o `.wasm` do app sai.**
- `feat/wasm-on-dev`: a demo completa. Referência pro worker e pra paisagem (`bindings/wasm/worker.mjs`, `landscape.mjs`), não fonte do build.

**Decisão:**
- `.wasm` buildado da `feat/wasm-binding` e empacotado junto com o app.
- As duas branches são propostas ao upstream `forefireAPI/forefire`, a critério dos mantenedores. Enquanto não houver nada oficial, o app builda do fork.
- Uma instância de Module WASM por simulação: o motor tem estado global no processo (issue #175), e um segundo `new ForeFire()` no mesmo Module herda o fogo anterior.

---

## 3. Arquitetura

```
┌─────────────────────────────────────────────┐
│                Electron Main                 │
│   abre pacotes de paisagem (filesystem)      │
├──────────────────── IPC ────────────────────┤
│               Electron Renderer              │
│   Svelte: mapa (Maplibre) · controles ·      │
│   timeline                                   │
│        │ postMessage                         │
│   ┌────▼─────────────────────────────┐       │
│   │ Web Worker: ForeFire WASM        │       │
│   │ um Module novo por simulação     │       │
│   └──────────────────────────────────┘       │
└─────────────────────────────────────────────┘
```

- Fora do app: `pipeline/` (Python) baixa os dados reais e gera os pacotes de paisagem (§5).
- Renderer não acessa disco: tudo de arquivo passa por IPC (`contextIsolation`, sem `nodeIntegration`).
- O worker recebe a paisagem pronta (arrays + `fuelsTable`) e a config (ignição, vento, duração), calcula a timeline inteira e devolve os frames de uma vez. A UI faz scrub nos frames, sem esperar o solver.

---

## 4. Contrato de dados com o motor

O que a paisagem precisa ser pra entrar no ForeFire, conferido no binding e na demo:

- **Plano cartesiano em metros.** `FireDomain[sw=(0,0,0);ne=(W,H,0);t=0]`. Lat/lon só existe no app, pra posicionar no mapa.
- **Arrays flat em ordem C `(t,z,y,x)`**; o binding transpõe (`forefire_wasm.cpp`). **Linha 0 = lado sul.**
- **Fuel:** `Int32Array` de índices da `fuelsTable`, via `addIndexLayer("table","fuel",...)`.
- **Altitude:** `Float64Array` em metros, via `addScalarLayer("data","altitude",...)`, **registrada antes do modelo de propagação**, senão o declive fica zero pra sempre.
- **Vento:** uniforme na área, por camadas `windU`/`windV` + `trigger[wind;...]`. Não há campo de vento variável no M1/M2.
- **Umidade e temperatura não são layers:** `Md`, `Ml` e `Ta` são colunas da `fuelsTable`. Mudar umidade = mudar a linha do combustível.
- **`fuelsTable`:** CSV com separador `;`. O Rothermel pede 23 colunas por combustível (`Index;Rhod;Rhol;Md;Ml;sd;sl;e;Sigmad;Sigmal;stoch;RhoA;Ta;Tau0;Deltah;DeltaH;Cp;Cpa;Ti;X0;r00;Blai;me`). Fonte das linhas: `tests/runff/fuels.csv` do próprio repo do ForeFire. Combustível com profundidade zero funciona como barreira.

---

## 5. Pipeline de dados reais (M2)

O download e o processamento dos dados reais ficam **fora do app**, num script Python em `pipeline/` (rodado com `uv`). O app só abre o resultado: um pacote de paisagem.

**Por quê:** reprojetar e reamostrar raster é trivial com `rasterio`, e sofrido com `geotiff.js`. O mapeamento de combustível pede iteração rápida (rodar, olhar, ajustar), e isso é mais fácil em Python. E o formato do pacote vira o contrato entre os dois lados.

**Custo:** quem quiser paisagem real precisa de Python. **Revisitar se** isso pesar (no M5, por exemplo): o download migra pro main do Electron e o formato do pacote continua o mesmo.

### 5.1 Fontes
- **Combustível:** [ESA WorldCover](https://registry.opendata.aws/esa-worldcover-vito/) 2021 v200 (10 m, COG no S3, sem key, CC-BY 4.0: **atribuição obrigatória** na UI).
- **Relevo:** [Copernicus DEM GLO-30](https://registry.opendata.aws/copernicus-dem/) (COG no S3, sem key). O OpenTopography exige API key: descartado.
- **Vento:** continua manual no M2. O [Open-Meteo](https://open-meteo.com/) (sem key, vento a 10 m no centro da área) fica pra depois.

### 5.2 Pacote de paisagem
Uma pasta autocontida, já no formato que o motor espera (§4):

```
<nome>/
├── meta.json      # centro, lado, nx/ny, fontes, data, versão do mapeamento
├── fuel.bin       # Int32 little-endian, ordem C (y, x), linha 0 = sul
├── altitude.bin   # Float64 little-endian, mesma grade
└── fuels.csv      # a fuelsTable usada; os índices de fuel.bin apontam pra ela
```

- **Grade quadrada**, definida por centro (lon/lat) e lado em metros, igual à paisagem sintética.
- **Mesma conversão metro ↔ lat/lon do app** (`landscape/geo.ts`: aproximação local pelo canto sudoeste, boa até ~30 km de lado). O script calcula o lat/lon do centro de cada célula com essa fórmula e amostra os rasters ali: vizinho mais próximo pro WorldCover (classe é categórica), bilinear pro DEM. Assim, o que o motor vê bate com o que o mapa desenha.
- **Binário cru em vez de GeoTIFF:** o app lê sem dependência nova e entrega os arrays direto ao motor. Pra inspecionar em QGIS, o script pode gerar um GeoTIFF à parte.
- O `fuels.csv` vai junto porque o pacote não pode quebrar se o mapeamento mudar depois.

### 5.3 Mapeamento WorldCover → combustível
- **Próprio**, feito a partir das classes públicas do WorldCover e da literatura, com cada escolha justificada em `pipeline/MAPEAMENTO.md`. É a parte de estudo de física do M2.
- Toda escolha é uma **aproximação explícita**: uma classe de cobertura do solo não é um modelo de combustível. Isso fica escrito no `MAPEAMENTO.md` e aparece na UI.
- Classes sem combustível (água, área construída, neve, solo exposto) viram barreira (§4: profundidade zero).

### 5.4 Relevo: dois modos
- O pacote traz a altitude real, e o app tem um toggle **Relevo**: ligado usa o `altitude.bin`, desligado manda altitude zero. Mesma ignição e mesmo vento, rodados dos dois jeitos, mostram o efeito do declive.
- O desenvolvimento começa com o relevo desligado, pra isolar o efeito do combustível.
- Relevo 3D *visual* (terrain do Maplibre) é outra coisa e fica pra depois (§6.1).

---

## 6. Modos da aplicação

### 6.1 Modo Simulação
- Paisagem (sintética no M1, real no M2) posicionada no mapa
- Toggle de relevo: plano ou com a altitude real (§5.4)
- Ignição por clique
- Vento (velocidade + direção) e duração
- Rodar → frentes desenhadas no mapa, isócronas coloridas, área queimada
- Timeline com scrub

Depois: múltiplas ignições, pintar combustível, exportar (GeoJSON/GeoTIFF), salvar cenário, relevo 3D no mapa (terrain do Maplibre).

### 6.2 Modo Lab
- **Model Playground:** curvas de ROS (ROS × vento, ROS × declive, ROS × umidade) usando o comando `computeSpeed[...]` do motor
- **Fuel Studio:** ver e editar as colunas de cada combustível, ver o efeito na curva
- Tudo com dados sintéticos

Os modelos estão todos compilados no WASM (Rothermel, variantes Balbi, Farsite...), mas cada um pede colunas diferentes na `fuelsTable`. O Lab começa só com Rothermel.

---

## 7. UX

- **Simples primeiro.** Abrir → paisagem no mapa → clique pra ignição → roda.
- **Avançado acessível**, mas escondido por padrão.
- **Progresso visível.** Nada "clicou e sumiu".
- Atalhos e undo: só onde fizer falta, não "pra tudo".

---

## 8. O que NÃO é

- **Não é SaaS.** App local, sem servidor, sem conta.
- **Não é um fork do ForeFire.** É um consumidor do motor (`forefireAPI/forefire`, de Jean-Baptiste Filippi e da Université de Corse), sempre creditado.
- **Não é ferramenta operacional.** É pra estudar; o resultado não é previsão de incêndio real.
- **Não é mobile.**

---

## 9. Milestones

- **M1 — Motor no app (concluído):** Electron + Svelte + Maplibre, WASM no worker, paisagem sintética (colina + combustíveis do `fuels.csv`), ignição por clique, vento, frentes no mapa, timeline.
- **M2 — Dados reais:** script Python gera pacote de paisagem (WorldCover + Copernicus DEM) com mapeamento de combustível próprio; app abre o pacote, com toggle de relevo e atribuição. Detalhe em [`PLAN.md`](./PLAN.md).
- **M3 — Lab:** curvas de ROS com `computeSpeed`, Fuel Studio.
- **M4 — Cenários:** múltiplas ignições, pintar combustível, salvar/carregar, exportar.
- **M5 — Distribuição:** instaladores, offline completo (PMTiles), i18n (PT-BR, EN, FR).

---

## 10. Riscos

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| Solver lento em grade fina | Média | Alto | Medir tempo × tamanho de célula (não × km²); a demo roda 30 km com grade 256 |
| Mapeamento WorldCover → combustível sem base física | Alta | Médio | Cada escolha justificada em `pipeline/MAPEAMENTO.md` e marcada como aproximação na UI |
| Estado global vazar entre simulações | Baixa | Médio | Module novo por run; teste no M1 |
| Electron pesado demais | Baixa | Baixo | Testar em hardware modesto |

---

## 11. Decisões

- [x] Licença: GPL-3.0 (o motor é GPL-3.0 e o `.wasm` vai empacotado)
- [x] Repo: `antonio-leblanc/forefire-app`, separado do motor
- [x] Fonte do WASM: `feat/wasm-binding` do fork `antonio-leblanc/forefire`
- [x] Dados reais: script Python fora do app gera pacote de paisagem (pasta com `.bin` + `meta.json`), sem SQLite
- [x] Dados sem key: WorldCover (S3) e Copernicus DEM (S3); OpenTopography descartado
- [x] Offline de mapa: PMTiles
- [ ] Nome final
- [ ] Basemap do M1 (sem key e com termos que permitam uso em app)
- [ ] Electron Forge vs electron-builder (decidir no M5)
- [x] Mapeamento WorldCover → combustível: próprio, a partir das classes públicas (conteúdo no M2)

---

## 12. Referências

- Motor: [`forefireAPI/forefire`](https://github.com/forefireAPI/forefire)
- Fork com o binding WASM: [`antonio-leblanc/forefire`](https://github.com/antonio-leblanc/forefire)
- Demo WASM: [antonioleblanc.com/projects/forefire](https://antonioleblanc.com/projects/forefire/)
