# ForeFire App — SPEC

**Spec-driven development.** Toda decisão arquitetural, trade-off e milestone mora aqui. O código segue o spec, não o contrário.

Status: em definição. Última atualização: 2026-10-18.

---

## 1. Visão

Projeto pessoal pra estudar o ForeFire: entender na prática como a propagação de fogo funciona, mexendo no motor (WASM) com dados abertos num app desktop. Roda local, sem servidor, e funciona offline depois do download dos dados.

### O que o app faz
- Roda simulações em qualquer região, com dados abertos (WorldCover, SRTM, Open-Meteo)
- **Modo Lab** pra explorar modelos de propagação e combustíveis
- Instalável (.exe/.AppImage/.dmg) e open source

---

## 2. Stack — Decisões

### 2.1 Empacotamento: Electron

**Decisão:** Electron (Chromium + Node.js).

**Por que não Tauri:**
- WASM + WebGL no WebKitGTK (Linux) é incerto. Electron roda o mesmo Chromium em todas as plataformas, sem surpresa.
- O motor ForeFire em WASM já foi testado e funciona em Chromium (demo pública).
- Maturidade do ecossistema (Leaflet, D3.js, SQLite via better-sqlite3).
- Peso (~150MB) é aceitável pra um app que já vai baixar GB de dados geoespaciais.

**Revisitar se:** Tauri resolver WASM/WebGL no Linux de forma comprovada.

### 2.2 UI Framework: Svelte

**Decisão:** Svelte (não React, não Vue, não vanilla).

- Bundle menor que React, runtime mínimo.
- Reatividade por compilação, menos boilerplate.
- Bom pra app desktop com estado complexo (mapa + simulação + timeline).
- Comunidade menor mas suficiente pro escopo.

### 2.3 Mapa: Maplibre GL JS

**Decisão:** Maplibre GL JS (não Leaflet).

- WebGL nativo, melhor performance pra raster tiles.
- Suporte offline via MBTiles.
- Estilo customizável (terrain, hillshade, satélite).
- Leaflet é mais maduro mas Canvas 2D — Maplibre é GPU.

### 2.4 Gráficos: D3.js

- Curvas de ROS, gráficos de parâmetros, comparação lado a lado.
- Chart.js é mais simples mas D3 dá controle total pra visualização científica.

### 2.5 Banco local: SQLite

- Cache de dados geoespaciais (metadados de bounding box, tiles).
- better-sqlite3 (síncrono, rápido; módulo nativo, exige rebuild pro Electron).
- Dados raster (GeoTIFF, netCDF) ficam em arquivos no filesystem.

### 2.6 Motor: WASM

**Base:** branches limpas no fork `antonio-leblanc/forefire`:
- `feat/no-netcdf-build` — PR 1: `#ifdef FF_NO_NETCDF`, +78/-1, não encosta em singleton.
- `feat/wasm-binding` — PR 2 (em cima da PR 1): binding embind + target CMake, 4 arquivos.
- `feat/wasm-on-dev` — demo completa (a que roda em `antonioleblanc.com/projects/forefire`), deriva das duas acima.

**Decisão:** Empacotar `.wasm` junto com o app, buildado a partir das branches limpas.

- As duas PRs limpas são o que deve ser mergeado no `forefireAPI/forefire` oficial.
- Até lá, o app referencia o fork do Antonio como fonte do `.wasm`.
- Uma instância WASM por simulação (estado global #175 impede reuse).

---

## 3. Arquitetura

```
┌─────────────────────────────────────────────┐
│                 Electron Main                │
│  ┌──────────┐ ┌──────────┐ ┌─────────────┐ │
│  │  SQLite  │ │  File    │ │  HTTP (data │ │
│  │  (cache) │ │  System  │ │  downloads) │ │
│  └──────────┘ └──────────┘ └─────────────┘ │
├─────────────────────────────────────────────┤
│              Electron Renderer               │
│  ┌──────────────────────────────────────┐   │
│  │            Svelte App                │   │
│  │  ┌──────────┐ ┌────────┐ ┌───────┐  │   │
│  │  │  Mapa    │ │  D3    │ │  UI   │  │   │
│  │  │(Maplibre)│ │(charts)│ │(forms)│  │   │
│  │  └──────────┘ └────────┘ └───────┘  │   │
│  │                                      │   │
│  │  ┌──────────────────────────────┐   │   │
│  │  │     ForeFire WASM Worker      │   │   │
│  │  │  (Web Worker, não main thread)│   │   │
│  │  └──────────────────────────────┘   │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### Comunicação Main ↔ Renderer
- IPC do Electron pra SQLite, filesystem, downloads.
- Renderer não acessa disco diretamente (segurança).

### ForeFire no Web Worker
- Simulação roda em thread separada, não trava UI.
- Comunicação via `postMessage`: renderer manda config (fuels, ignição, weather) → worker devolve frames/resultado.
- Cada simulação = nova instância WASM no worker.

---

## 4. Pipeline de Dados

### 4.1 Fuel (Cobertura do Solo)

**Fonte:** ESA WorldCover 2021 (10m, global, gratuito).

**Classes WorldCover → Fuel Types ForeFire:**
As 11 classes WorldCover precisam de um mapeamento para os fuel types do ForeFire, com parâmetros calibrados. A definir.

**Download:**
1. Usuário seleciona bounding box no mapa
2. App baixa tiles WorldCover via [ESA API](https://esa-worldcover.org/en/data-access) ou Terracotta tile server
3. Cache local em GeoTIFF (COG — Cloud Optimized GeoTIFF)
4. Pré-processamento: reamostragem pra resolução da simulação

### 4.2 Elevação

**Fonte:** SRTM GL1 (30m) ou OpenTopography API.

**Download:** similar ao fuel — bounding box → download → cache COG.

### 4.3 Weather

**Fonte:** Open-Meteo API (gratuito, sem key).

**Dados:** vento (velocidade + direção a 10m), temperatura, umidade relativa.

**Fluxo:**
1. App detecta centro do bounding box → lat/lon
2. Chama Open-Meteo pra forecast ou histórico
3. Usuário pode ajustar parâmetros manualmente (sliders)

### 4.4 Cache

```
~/.forefire-app/
├── cache.sqlite        # metadados: bounding boxes, datas, sources
├── fuels/              # GeoTIFF (COG)
├── elevation/          # GeoTIFF (COG)
└── weather/            # JSON cache por coordenada
```

---

## 5. Modos da Aplicação

### 5.1 Modo Simulação

**MVP — essencial:**
- Selecionar região no mapa (desenhar bounding box)
- Baixar dados (fuel + elevação + weather) — progresso visível
- Configurar ignição (ponto único, linha, ou polígono)
- Escolher modelo ROS (Rothermel, Balbi 2011, Balbi 2015, Balbi 2020)
- Rodar simulação
- Visualizar resultado no mapa (isochronas coloridas)
- Timeline scrub (avançar/retroceder no tempo)
- Salvar/carregar cenário

**Pós-MVP:**
- Múltiplas ignições simultâneas
- Edição de fuel (pintar/recortar patches)
- Exportar resultado (GeoJSON, GeoTIFF)
- Modo offline completo (tudo pré-baixado)

### 5.2 Modo Lab

**MVP — essencial:**
- **Fuel Studio:** visualizar parâmetros de cada fuel type, editar com sliders, criar fuel customizado
- **Model Playground:** curvas de ROS interativas (ROS × vento, ROS × umidade), comparação lado a lado de modelos
- Dados sintéticos (sem precisar baixar nada)

**Pós-MVP:**
- Tutorial passo a passo ("Aula 1: taxa de propagação")
- Exportar fuel customizado

---

## 6. UX Principles

- **Modo simples primeiro.** Abrir o app → mapa → clique pra ignition → vento default → roda.
- **Modo avançado acessível.** Todos os parâmetros acessíveis, mas não visíveis por padrão.
- **Progresso visível.** Download de dado mostra barra, simulação mostra progresso, nada "clicou e sumiu".
- **Desfazer.** Toda ação tem undo.
- **Teclado.** Atalhos pra tudo (espaço = run/stop, R = modo ROS, etc.).

---

## 7. O que NÃO é

- **Não é SaaS.** App local, sem servidor, sem conta, sem login.
- **Não é um fork do ForeFire.** O app é um consumidor do motor oficial (`forefireAPI/forefire`, de Jean-Baptiste Filippi e da Université de Corse), sempre creditado.
- **Não é mobile.** Desktop primeiro. Talvez tablet depois, mas não phone.

---

## 8. MVP — Milestone 1

O mínimo que prova que o conceito funciona:

1. **App Electron com Svelte + Maplibre** — janela com mapa, sem simulação ainda
2. **Download de WorldCover** pra uma bounding box — visualizar no mapa
3. **Motor WASM carregado** — comunicação renderer ↔ worker
4. **Simulação única** — ponto de ignição + Rothermel + vento fixo + fuel do WorldCover
5. **Resultado no mapa** — isochronas coloridas
6. **Timeline simples** — slider de tempo

**Não entra no MVP:**
- Modo Lab (Fuel Studio, Model Playground)
- Múltiplas ignições
- Edição de fuel
- Cache offline inteligente
- Exportação
- Tutoriais

---

## 9. Milestones Futuros

- **M2:** Modo Lab básico (Fuel Studio + curvas ROS)
- **M3:** Múltiplas ignições, edição de fuel no mapa
- **M4:** Modo offline completo, exportação
- **M5:** Tutorial interativo, i18n (PT-BR, EN, FR)

---

## 10. Riscos

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| WASM não tanka cenário >10km² | Média | Alto | Testar cedo com bounding box progressivamente maior |
| Mapeamento WorldCover→Fuel insuficiente | Média | Médio | Validar o mapeamento antes do MVP |
| Electron pesado demais | Baixa | Baixo | Testar em hardware modesto |

---

## 11. Decisões Pendentes

- [ ] Nome final: "ForeFire App", "ForeFire Lab", "ForeFire Desktop", outro?
- [x] Licença: GPL-3.0 (o motor é GPL-3.0 e o `.wasm` vai empacotado junto)
- [x] Onde hospedar o repo: `antonio-leblanc/forefire-app` (repo separado, app é consumidor do motor)
- [x] Fonte do WASM: branches limpas `feat/no-netcdf-build` + `feat/wasm-binding` no fork do Antonio (não mexem em singleton)
- [ ] Electron Forge vs electron-builder pra empacotamento?
- [ ] Tile server offline: MBTiles ou servir COG localmente?
- [ ] Autenticação/API key necessária pra WorldCover? (provavelmente não, mas verificar)

---

## 12. Referências

- ForeFire motor: `forefireAPI/forefire` (GitHub)
- WASM demo: `antonioleblanc.com/projects/forefire`
- Branch WASM: `antonio-leblanc/forefire` → `feat/wasm-on-dev`
