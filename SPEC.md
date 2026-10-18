# ForeFire App — SPEC

**Spec-driven development.** Toda decisão arquitetural, trade-off e milestone mora aqui. O código segue o spec, não o contrário. O passo a passo do milestone atual fica em [`PLAN.md`](./PLAN.md).

Status: M1 em andamento. Última atualização: 2026-10-18.

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
- **CORS e filesystem.** O bucket público do WorldCover aceita range request mas não manda `Access-Control-Allow-Origin`, então só o processo main consegue ler direto. Cache em disco também é natural no main.
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

### 2.5 Cache local: arquivos + índice JSON

- Sem banco no M1/M2. Raster em GeoTIFF no disco, metadados num `index.json`.
- SQLite só se o índice ficar grande demais (o `better-sqlite3` é módulo nativo e exige rebuild pro Electron).

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
│   filesystem (cache) · downloads (M2)        │
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

Só entra depois que a paisagem sintética roda de ponta a ponta.

### 5.1 Combustível
- **Fonte:** [ESA WorldCover](https://registry.opendata.aws/esa-worldcover-vito/) (10m, COG no S3, sem key, CC-BY 4.0: **atribuição obrigatória** na UI).
- **Leitura:** `geotiff.js` no main, com range request só na bounding box.
- **Classes WorldCover → combustível:** em aberto, e é decisão de física, não de código. Até lá, o M2 usa poucas classes mapeadas para linhas existentes do `fuels.csv`, de forma explícita e marcada como aproximação.

### 5.2 Elevação
- **Fonte:** [Copernicus DEM GLO-30](https://registry.opendata.aws/copernicus-dem/) (COG no S3, sem key). Alternativa: tiles [Terrarium](https://registry.opendata.aws/terrain-tiles/).
- O OpenTopography exige API key: descartado.

### 5.3 Reprojeção
- WorldCover e Copernicus vêm em EPSG:4326. O motor quer grade métrica: reamostrar pra uma grade local em metros centrada na bounding box. A aproximação local serve até ~30 km de lado.

### 5.4 Vento
- [Open-Meteo](https://open-meteo.com/) (sem key): só velocidade e direção a 10m, no centro da área. O usuário pode sobrescrever.

### 5.5 Cache
```
~/.forefire-app/
├── index.json      # bounding boxes, datas, fontes
├── fuels/          # GeoTIFF recortado
└── elevation/      # GeoTIFF recortado
```
Tamanho esperado: MB, não GB (10 km de WorldCover ≈ 1000×1000 px).

---

## 6. Modos da aplicação

### 6.1 Modo Simulação
- Paisagem (sintética no M1, real no M2) posicionada no mapa
- Ignição por clique
- Vento (velocidade + direção) e duração
- Rodar → frentes desenhadas no mapa, isócronas coloridas, área queimada
- Timeline com scrub

Depois: múltiplas ignições, pintar combustível, exportar (GeoJSON/GeoTIFF), salvar cenário.

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

- **M1 — Motor no app:** Electron + Svelte + Maplibre, WASM no worker, paisagem sintética (colina + combustíveis do `fuels.csv`), ignição por clique, vento, frentes no mapa, timeline. Detalhe em [`PLAN.md`](./PLAN.md).
- **M2 — Dados reais:** WorldCover + Copernicus DEM por bounding box no main, reprojeção, cache, vento do Open-Meteo, atribuição.
- **M3 — Lab:** curvas de ROS com `computeSpeed`, Fuel Studio.
- **M4 — Cenários:** múltiplas ignições, pintar combustível, salvar/carregar, exportar.
- **M5 — Distribuição:** instaladores, offline completo (PMTiles), i18n (PT-BR, EN, FR).

---

## 10. Riscos

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| Solver lento em grade fina | Média | Alto | Medir tempo × tamanho de célula (não × km²); a demo roda 30 km com grade 256 |
| Mapeamento WorldCover → combustível sem base física | Alta | Médio | M1 não depende dele; M2 usa aproximação explícita |
| Estado global vazar entre simulações | Baixa | Médio | Module novo por run; teste no M1 |
| Electron pesado demais | Baixa | Baixo | Testar em hardware modesto |

---

## 11. Decisões

- [x] Licença: GPL-3.0 (o motor é GPL-3.0 e o `.wasm` vai empacotado)
- [x] Repo: `antonio-leblanc/forefire-app`, separado do motor
- [x] Fonte do WASM: `feat/wasm-binding` do fork `antonio-leblanc/forefire`
- [x] Cache: arquivos + `index.json`, sem SQLite
- [x] Dados sem key: WorldCover (S3) e Copernicus DEM (S3); OpenTopography descartado
- [x] Offline de mapa: PMTiles
- [ ] Nome final
- [ ] Basemap do M1 (sem key e com termos que permitam uso em app)
- [ ] Electron Forge vs electron-builder (decidir no M5)
- [ ] Mapeamento WorldCover → combustível

---

## 12. Referências

- Motor: [`forefireAPI/forefire`](https://github.com/forefireAPI/forefire)
- Fork com o binding WASM: [`antonio-leblanc/forefire`](https://github.com/antonio-leblanc/forefire)
- Demo WASM: [antonioleblanc.com/projects/forefire](https://antonioleblanc.com/projects/forefire/)
