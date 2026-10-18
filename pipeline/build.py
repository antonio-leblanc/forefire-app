"""Gera um pacote de paisagem (SPEC §5.2) a partir do ESA WorldCover e do Copernicus DEM.

    uv run build.py

Área e resolução ficam nas constantes abaixo. O pacote sai em out/<NOME>/.
"""

import json
import math
import shutil
from datetime import date
from pathlib import Path

import numpy as np
import rasterio
from rasterio.transform import from_origin
from rasterio.windows import from_bounds

NOME = "alto-paraiso"
CENTRO = (-47.53, -14.14)  # lon, lat: Alto Paraíso de Goiás, Chapada dos Veadeiros
LADO = 5000  # metros
CELULA = 20  # metros

# Mapeamento provisório (PLAN passo 1): só separa o que queima do que não queima,
# com duas linhas do fuels.csv. O mapeamento de verdade é o passo 3.
MAPEAMENTO_VERSAO = "provisorio-0"
WORLDCOVER_PARA_FUEL = {
    10: 5,  # árvores
    20: 5,  # arbustos
    30: 4,  # campo
    40: 4,  # cultivo
    50: 0,  # construído
    60: 0,  # solo exposto / vegetação esparsa
    70: 0,  # neve e gelo
    80: 0,  # água
    90: 4,  # área úmida herbácea
    95: 5,  # mangue
    100: 4,  # musgo e líquen
}
SEM_COMBUSTIVEL = 0

# Mesma conversão do app (src/renderer/src/landscape/geo.ts).
M_POR_GRAU_LAT = 111320


def m_por_grau_lon(lat: float) -> float:
    return 111320 * math.cos(math.radians(lat))


def canto_sudoeste(centro: tuple[float, float], lado: float) -> tuple[float, float]:
    lon, lat = centro
    return lon - lado / 2 / m_por_grau_lon(lat), lat - lado / 2 / M_POR_GRAU_LAT


def tile_worldcover(lon: float, lat: float) -> str:
    # Tiles de 3°, nomeados pelo canto sudoeste.
    la, lo = math.floor(lat / 3) * 3, math.floor(lon / 3) * 3
    nome = f"{'N' if la >= 0 else 'S'}{abs(la):02d}{'E' if lo >= 0 else 'W'}{abs(lo):03d}"
    return f"https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_{nome}_Map.tif"


def tile_dem(lon: float, lat: float) -> str:
    # Tiles de 1°, nomeados pelo canto sudoeste.
    la, lo = math.floor(lat), math.floor(lon)
    nome = f"Copernicus_DSM_COG_10_{'N' if la >= 0 else 'S'}{abs(la):02d}_00_{'E' if lo >= 0 else 'W'}{abs(lo):03d}_00_DEM"
    return f"https://copernicus-dem-30m.s3.amazonaws.com/{nome}/{nome}.tif"


def ler_janela(url: str, lons: np.ndarray, lats: np.ndarray) -> tuple[np.ndarray, rasterio.Affine]:
    """Lê do COG só o retângulo que cobre os pontos, com uma margem de 2 pixels."""
    with rasterio.open(url) as src:
        b = src.bounds
        assert b.left <= lons.min() and lons.max() <= b.right and b.bottom <= lats.min() and lats.max() <= b.top, (
            f"área fora do tile {url}: área em mais de um tile ainda não é suportada"
        )
        dx, dy = src.res
        win = from_bounds(lons.min() - 2 * dx, lats.min() - 2 * dy, lons.max() + 2 * dx, lats.max() + 2 * dy, src.transform)
        win = win.round_offsets().round_lengths()
        return src.read(1, window=win), src.window_transform(win)


def amostrar_vizinho(dados: np.ndarray, t: rasterio.Affine, lons: np.ndarray, lats: np.ndarray) -> np.ndarray:
    col, lin = ~t * (lons, lats)
    return dados[np.floor(lin).astype(int), np.floor(col).astype(int)]


def amostrar_bilinear(dados: np.ndarray, t: rasterio.Affine, lons: np.ndarray, lats: np.ndarray) -> np.ndarray:
    # Centro do pixel em coordenada inteira, por isso o -0.5.
    col, lin = ~t * (lons, lats)
    col, lin = col - 0.5, lin - 0.5
    c0, l0 = np.floor(col).astype(int), np.floor(lin).astype(int)
    fc, fl = col - c0, lin - l0
    d = dados.astype(np.float64)
    topo = d[l0, c0] * (1 - fc) + d[l0, c0 + 1] * fc
    baixo = d[l0 + 1, c0] * (1 - fc) + d[l0 + 1, c0 + 1] * fc
    return topo * (1 - fl) + baixo * fl


def main() -> None:
    n = LADO // CELULA
    sw_lon, sw_lat = canto_sudoeste(CENTRO, LADO)

    # Centro de cada célula, em ordem C (y, x), linha 0 = sul (SPEC §4).
    xy = (np.arange(n) + 0.5) * CELULA
    lons = sw_lon + xy[np.newaxis, :] / m_por_grau_lon(sw_lat) + 0 * xy[:, np.newaxis]
    lats = sw_lat + xy[:, np.newaxis] / M_POR_GRAU_LAT + 0 * xy[np.newaxis, :]

    url_wc = tile_worldcover(*CENTRO)
    print(f"WorldCover: {url_wc}")
    wc, t_wc = ler_janela(url_wc, lons, lats)
    classes = amostrar_vizinho(wc, t_wc, lons, lats)
    fuel = np.full(classes.shape, SEM_COMBUSTIVEL, dtype="<i4")
    for classe, indice in WORLDCOVER_PARA_FUEL.items():
        fuel[classes == classe] = indice

    url_dem = tile_dem(*CENTRO)
    print(f"Copernicus DEM: {url_dem}")
    dem, t_dem = ler_janela(url_dem, lons, lats)
    altitude = amostrar_bilinear(dem, t_dem, lons, lats).astype("<f8")

    saida = Path(__file__).parent / "out" / NOME
    saida.mkdir(parents=True, exist_ok=True)
    fuel.tofile(saida / "fuel.bin")
    altitude.tofile(saida / "altitude.bin")
    shutil.copy(Path(__file__).parent / "fuels.csv", saida / "fuels.csv")

    contagem = {int(c): int((classes == c).sum()) for c in np.unique(classes)}
    meta = {
        "nome": NOME,
        "centro": list(CENTRO),
        "lado": LADO,
        "nx": n,
        "ny": n,
        "mapeamento": MAPEAMENTO_VERSAO,
        "fuelPadrao": SEM_COMBUSTIVEL,
        "gerado": date.today().isoformat(),
        "fontes": {
            "combustivel": {"dado": "ESA WorldCover 10m 2021 v200", "licenca": "CC-BY 4.0", "url": url_wc},
            "relevo": {"dado": "Copernicus DEM GLO-30", "url": url_dem},
        },
        "classesWorldCover": contagem,
    }
    (saida / "meta.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")

    # GeoTIFF de inspeção em EPSG:4326. A grade é linear em lon/lat (mesma
    # aproximação do app), então a transformação afim é exata. Linha 0 do GeoTIFF = norte.
    t = from_origin(sw_lon, sw_lat + LADO / M_POR_GRAU_LAT, CELULA / m_por_grau_lon(sw_lat), CELULA / M_POR_GRAU_LAT)
    perfil = dict(driver="GTiff", width=n, height=n, crs="EPSG:4326", transform=t)
    with rasterio.open(saida / "inspecao.tif", "w", count=3, dtype="float64", **perfil) as dst:
        dst.write(classes[::-1].astype("float64"), 1)
        dst.write(fuel[::-1].astype("float64"), 2)
        dst.write(altitude[::-1], 3)
        dst.descriptions = ("classe WorldCover", "fuel", "altitude (m)")

    print(f"Pacote em {saida}: {n}x{n} células de {CELULA} m")
    print(f"Classes WorldCover (células): {contagem}")
    print(f"Altitude: {altitude.min():.0f} a {altitude.max():.0f} m")


if __name__ == "__main__":
    main()
