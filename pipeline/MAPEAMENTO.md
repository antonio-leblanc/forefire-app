# Mapeamento WorldCover → combustível

Versão `worldcover-s2glc-1` (gravada no `meta.json` de cada pacote).

**Aproximação explícita.** Uma classe de cobertura do solo não é um modelo de combustível: o WorldCover diz *o que* cobre o chão, não quanto material fino e seco existe ali, nem com que umidade. O resultado serve pra estudar o motor, não pra prever incêndio real.

## Método

O WorldCover não tem tabela de combustível. O ForeFire tem uma pra outra classificação, o [S2GLC](http://s2glc.cbk.waw.pl/) (Sentinel-2, Europa, 10 m): `tools/3nestFFCASE/006_runff/ForeFire/fuels.ff`, em que o `Index` de cada linha é o código de pixel do S2GLC (legenda em `tools/makeColormapH.py`, que traz as classes do WorldCover e do S2GLC na mesma paleta).

O mapeamento tem duas partes:
1. **Física:** os parâmetros do Rothermel vêm sem alteração dessa tabela do ForeFire, copiada em [`fuels.csv`](./fuels.csv).
2. **Correspondência de classes:** cada classe do WorldCover vai pra classe S2GLC de definição mais próxima. Essa parte é deste repo.

Os parâmetros foram calibrados pra vegetação mediterrânea (Córsega). Fora desse bioma, a aproximação piora.

## Tabela

| WorldCover | → S2GLC | `e` (m) | Por quê |
|---|---|---|---|
| 10 Tree cover | 82 Broadleaf tree cover | 0,40 | O WorldCover não separa folhosa de conífera; folhosa é a maior parte da cobertura arbórea global. |
| 20 Shrubland | 104 Sclerophyllous vegetation | 0,60 | Arbusto lenhoso < 5 m. 103 (charneca) tem os mesmos parâmetros. |
| 30 Grassland | 102 Herbaceous vegetation | 0,60 | Mesma definição: herbácea natural ou pastagem. |
| 40 Cropland | 73 Cultivated areas | 0,19 | Mesma definição. |
| 50 Built-up | 62 Artificial surfaces | 0 | Barreira. |
| 60 Bare / sparse | 121 Natural material surfaces | 0 | Barreira: ≤ 10 % de vegetação. |
| 70 Snow and ice | 123 Permanent snow | 0 | Barreira. |
| 80 Water | 162 Water bodies | 0 | Barreira. |
| 90 Herbaceous wetland | 105 Marshes | 0 | Barreira, como na tabela do ForeFire. |
| 95 Mangroves | 105 Marshes | 0 | Sem classe S2GLC; alagado pela maré, tratado como pântano. |
| 100 Moss and lichen | 106 Peatbogs | 0 | Sem classe S2GLC direta; a mais próxima é turfeira. |

## Escolhas em aberto

- **Árvore → folhosa ou conífera.** A conífera (83) tem a mesma profundidade, mas combustível morto mais seco (`Md` 0,05 contra 0,10), mais fino (`sd` 6099 contra 4287 1/m) e em menor carga (`Sigmad` 0,76 contra 1,38 kg/m²): queima mais rápido. Boreal e pinhal ficam subestimados com 82.
- **Área úmida como barreira.** Segue a tabela do ForeFire, mas campo alagável queima na seca (Pantanal, por exemplo).
- **Campo com 0,60 m**, a mesma profundidade do arbusto, mais alta que a de muito campo natural.
