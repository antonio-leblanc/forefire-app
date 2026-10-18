# ForeFire App

App desktop pra estudar o [ForeFire](https://github.com/forefireAPI/forefire), simulador open source de propagação de incêndio florestal de Jean-Baptiste Filippi e da Université de Corse. O motor roda compilado pra WebAssembly, dentro do app.

Projeto pessoal e experimental. Não é ferramenta operacional: os resultados não são previsão de incêndio real.

As decisões ficam no [`SPEC.md`](./SPEC.md), e o milestone atual no [`PLAN.md`](./PLAN.md).

## Rodando

```sh
npm install
npm run dev
```

O motor já vem buildado em `src/renderer/public/engine/` (o commit de origem está em `FOREFIRE_REF`). Pra rebuildar, precisa de Linux ou WSL com [emsdk](https://emscripten.org):

```sh
npm run build:wasm   # no Windows, roda via WSL
```

## Licença

GPL-3.0, a mesma do motor.
