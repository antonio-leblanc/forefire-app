# PLAN — M1: motor no app

Passo a passo do milestone atual. As decisões ficam no [`SPEC.md`](./SPEC.md); aqui fica só a execução. Cada passo termina com algo que dá pra ver rodando.

## 1. WASM buildado do fork
- [x] Clonar `antonio-leblanc/forefire` no WSL (`~/gitrepos/forefire`), branch `feat/wasm-binding`
- [x] Buildar com emsdk (`emcmake cmake -DFOREFIRE_ENABLE_NETCDF=OFF ...`) → `forefire.mjs` + `forefire.wasm`
- [x] Rodar o `bindings/wasm/smoke.mjs` e conferir que passa
- [x] Script `scripts/build-wasm.sh` no app, que faz isso e copia os artefatos pra `src/renderer/public/engine/`
- [x] Teste: duas simulações em dois Modules diferentes não vazam estado (#175)

**Pronto quando:** o app tem um `.wasm` reproduzível a partir de um commit conhecido do fork.

## 2. Esqueleto do app
- [x] electron-vite + Svelte (template oficial)
- [x] `contextIsolation` ligado, sem `nodeIntegration`, preload mínimo
- [x] Janela com Maplibre em tela cheia

**Pronto quando:** `npm run dev` abre uma janela com mapa.

## 3. Motor no worker
- [x] Portar `worker.mjs` da demo (`feat/wasm-on-dev`) pra `src/renderer/src/engine/worker.ts`
- [x] Module novo a cada simulação (reaproveitando o `WebAssembly.Module` compilado)
- [x] Mensagens: `run { landscape, ignition, wind, steps, dt }` → `timeline { frames, outcome }` (`engine/types.ts`)

**Pronto quando:** um botão roda uma simulação em terreno plano e mostra a área queimada.

**Pendente pro build de produção:** com `loadFile` o motor viria de `file://`, e o `fetch` do `.wasm` não funciona assim. Resolver com um protocolo próprio (`app://`) no main antes do M5.

## 4. Paisagem sintética
- [ ] Gerador: colina gaussiana + manchas de combustível (linhas 0, 4 e 5 do `fuels.csv`)
- [ ] Posicionada numa lat/lon fixa, convertida pra metros (contrato do SPEC §4)
- [ ] Desenhada no mapa como raster (combustível) + hillshade simples

**Pronto quando:** a paisagem aparece no mapa no lugar certo.

## 5. Simulação no mapa
- [x] Clique no mapa → ponto de ignição em metros
- [x] Controles de vento (velocidade, direção); duração fixa em 1 h
- [x] Frentes convertidas de metros pra lat/lon e desenhadas, coloridas por tempo (isócronas)
- [x] Área queimada na tela

**Pronto quando:** o fogo sobe a colina mais rápido do que desce.

## 6. Timeline
- [x] Slider sobre os frames já calculados
- [ ] Play/pause

**Pronto quando:** dá pra voltar e avançar o fogo sem rodar o solver de novo.
