# PLAN — M1: motor no app

Passo a passo do milestone atual. As decisões ficam no [`SPEC.md`](./SPEC.md); aqui fica só a execução. Cada passo termina com algo que dá pra ver rodando.

## 1. WASM buildado do fork
- [ ] Clonar `antonio-leblanc/forefire` no WSL (`~/gitrepos/forefire`), branch `feat/wasm-binding`
- [ ] Buildar com emsdk (`emcmake cmake -DFOREFIRE_ENABLE_NETCDF=OFF ...`) → `forefire.mjs` + `forefire.wasm`
- [ ] Rodar o `bindings/wasm/smoke.mjs` e conferir que passa
- [ ] Script `scripts/build-wasm.sh` no app, que faz isso e copia os artefatos pra `src/renderer/public/engine/`
- [ ] Teste: duas simulações em dois Modules diferentes não vazam estado (#175)

**Pronto quando:** o app tem um `.wasm` reproduzível a partir de um commit conhecido do fork.

## 2. Esqueleto do app
- [ ] electron-vite + Svelte (template oficial)
- [ ] `contextIsolation` ligado, sem `nodeIntegration`, preload mínimo
- [ ] Janela com Maplibre em tela cheia

**Pronto quando:** `npm run dev` abre uma janela com mapa.

## 3. Motor no worker
- [ ] Portar `worker.mjs` da demo (`feat/wasm-on-dev`) pra `src/renderer/src/engine/worker.ts`
- [ ] Module novo a cada simulação
- [ ] Mensagens: `run { landscape, ignition, wind, duration }` → `frames { t, fronts, area }[]`

**Pronto quando:** um botão roda uma simulação em terreno plano e o console mostra a área queimada.

## 4. Paisagem sintética
- [ ] Gerador: colina gaussiana + manchas de combustível (linhas 0, 4 e 5 do `fuels.csv`)
- [ ] Posicionada numa lat/lon fixa, convertida pra metros (contrato do SPEC §4)
- [ ] Desenhada no mapa como raster (combustível) + hillshade simples

**Pronto quando:** a paisagem aparece no mapa no lugar certo.

## 5. Simulação no mapa
- [ ] Clique no mapa → ponto de ignição em metros
- [ ] Controles de vento (velocidade, direção) e duração
- [ ] Frentes convertidas de metros pra lat/lon e desenhadas, coloridas por tempo (isócronas)
- [ ] Área queimada na tela

**Pronto quando:** o fogo sobe a colina mais rápido do que desce.

## 6. Timeline
- [ ] Slider sobre os frames já calculados
- [ ] Play/pause

**Pronto quando:** dá pra voltar e avançar o fogo sem rodar o solver de novo.
