"""Gera um pacote de paisagem (SPEC §5.2) a partir do ESA WorldCover e do Copernicus DEM.

    uv run build.py --lat -14.14 --lon -47.53 --nome alto-paraiso
    uv run build.py --lat 42.15 --lon 9.10 --lado 8000

Qualquer lugar do mundo; a área pode cruzar tiles. O pacote sai em out/<nome>/.
"""

import argparse
import json
import math
import shutil
from datetime import date
from pathlib import Path

import numpy as np
import rasterio
from rasterio.errors import RasterioIOError
from rasterio.merge import merge
from rasterio.transform import from_origin

LADO_PADRAO = 5000  # metros
CELULA_PADRAO = 20  # metros

# Cada classe do WorldCover vai pra classe S2GLC equivalente; o fuels.csv é a
# tabela do ForeFire indexada pelo código S2GLC. Justificativa em MAPEAMENTO.md.
MAPEAMENTO_VERSAO = "worldcover-s2glc-1"
WORLDCOVER_PARA_FUEL = {
    10: 82,  # árvores → folhosa
    20: 104,  # arbustos → vegetação esclerófila
    30: 102,  # campo → vegetação herbácea
    40: 73,  # cultivo → área cultivada
    50: 62,  # construído → superfície artificial
    60: 121,  # solo exposto / vegetação esparsa → material natural
    70: 123,  # neve e gelo → neve permanente
    80: 162,  # água → corpo d'água
    90: 105,  # área úmida herbácea → pântano
    95: 105,  # mangue → pântano
    100: 106,  # musgo e líquen → turfeira
}
SEM_COMBUSTIVEL = 0

# Nome e cor de cada classe S2GLC, da paleta do próprio ForeFire
# (tools/makeColormapH.py). O Lab do app lê o mesmo arquivo.
S2GLC = {
    int(k): (v["nome"], tuple(v["rgb"]))
    for k, v in json.loads((Path(__file__).parent / "s2glc.json").read_text(encoding="utf-8")).items()
}


def profundidades(fuels_csv: Path) -> dict[int, float]:
    """Profundidade do leito (coluna `e`, m) por índice; zero é barreira."""
    linhas = fuels_csv.read_text().split()
    cab = linhas[0].split(";")
    i_idx, i_e = cab.index("Index"), cab.index("e")
    return {int(c[i_idx]): float(c[i_e]) for c in (l.split(";") for l in linhas[1:])}

# Mesma conversão do app (src/renderer/src/landscape/geo.ts).
M_POR_GRAU_LAT = 111320


def m_por_grau_lon(lat: float) -> float:
    return 111320 * math.cos(math.radians(lat))


def canto_sudoeste(centro: tuple[float, float], lado: float) -> tuple[float, float]:
    lon, lat = centro
    return lon - lado / 2 / m_por_grau_lon(lat), lat - lado / 2 / M_POR_GRAU_LAT


def cantos_de_tiles(lons: np.ndarray, lats: np.ndarray, passo: int) -> list[tuple[int, int]]:
    """Canto sudoeste (lat, lon) de cada tile de `passo` graus que a área toca."""
    la0, la1 = math.floor(lats.min() / passo) * passo, math.floor(lats.max() / passo) * passo
    lo0, lo1 = math.floor(lons.min() / passo) * passo, math.floor(lons.max() / passo) * passo
    return [(la, lo) for la in range(la0, la1 + 1, passo) for lo in range(lo0, lo1 + 1, passo)]


def tiles_worldcover(lons: np.ndarray, lats: np.ndarray) -> list[str]:
    # Tiles de 3°, nomeados pelo canto sudoeste.
    urls = []
    for la, lo in cantos_de_tiles(lons, lats, 3):
        nome = f"{'N' if la >= 0 else 'S'}{abs(la):02d}{'E' if lo >= 0 else 'W'}{abs(lo):03d}"
        urls.append(f"https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_{nome}_Map.tif")
    return urls


def tiles_dem(lons: np.ndarray, lats: np.ndarray) -> list[str]:
    # Tiles de 1°, nomeados pelo canto sudoeste.
    urls = []
    for la, lo in cantos_de_tiles(lons, lats, 1):
        nome = f"Copernicus_DSM_COG_10_{'N' if la >= 0 else 'S'}{abs(la):02d}_00_{'E' if lo >= 0 else 'W'}{abs(lo):03d}_00_DEM"
        urls.append(f"https://copernicus-dem-30m.s3.amazonaws.com/{nome}/{nome}.tif")
    return urls


def ler_mosaico(urls: list[str], lons: np.ndarray, lats: np.ndarray, vazio: float) -> tuple[np.ndarray, rasterio.Affine, list[str]]:
    """Lê dos COGs só o retângulo que cobre os pontos, com margem de 2 pixels, emendando os tiles.

    Tile inexistente (mar aberto, nos dois datasets) é pulado; o buraco sai com `vazio`.
    """
    fontes = []
    for url in urls:
        try:
            fontes.append(rasterio.open(url))
        except RasterioIOError:
            print(f"  sem tile (mar?): {url}")
    if not fontes:
        raise SystemExit("nenhum tile com dado nessa área")
    try:
        dx, dy = fontes[0].res
        limites = (lons.min() - 2 * dx, lats.min() - 2 * dy, lons.max() + 2 * dx, lats.max() + 2 * dy)
        dados, t = merge(fontes, bounds=limites, nodata=vazio)
        return dados[0], t, [f.name for f in fontes]
    finally:
        for f in fontes:
            f.close()


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
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--lat", type=float, required=True, help="latitude do centro, graus decimais")
    p.add_argument("--lon", type=float, required=True, help="longitude do centro, graus decimais")
    p.add_argument("--lado", type=int, default=LADO_PADRAO, help=f"lado do quadrado, m (padrão {LADO_PADRAO})")
    p.add_argument("--celula", type=int, default=CELULA_PADRAO, help=f"tamanho da célula, m (padrão {CELULA_PADRAO})")
    p.add_argument("--nome", help="nome do pacote (padrão: lat_lon)")
    a = p.parse_args()

    centro = (a.lon, a.lat)
    nome = a.nome or f"{a.lat:.3f}_{a.lon:.3f}"
    lado, celula = a.lado, a.celula
    n = lado // celula
    sw_lon, sw_lat = canto_sudoeste(centro, lado)

    # Centro de cada célula, em ordem C (y, x), linha 0 = sul (SPEC §4).
    xy = (np.arange(n) + 0.5) * celula
    lons = sw_lon + xy[np.newaxis, :] / m_por_grau_lon(sw_lat) + 0 * xy[:, np.newaxis]
    lats = sw_lat + xy[:, np.newaxis] / M_POR_GRAU_LAT + 0 * xy[np.newaxis, :]

    print("WorldCover:")
    # 0 é o nodata do WorldCover: sem classe, vira barreira.
    wc, t_wc, urls_wc = ler_mosaico(tiles_worldcover(lons, lats), lons, lats, vazio=0)
    classes = amostrar_vizinho(wc, t_wc, lons, lats)
    fuel = np.full(classes.shape, SEM_COMBUSTIVEL, dtype="<i4")
    for classe, indice in WORLDCOVER_PARA_FUEL.items():
        fuel[classes == classe] = indice

    print("Copernicus DEM:")
    # Sem tile de DEM é mar: altitude zero.
    dem, t_dem, urls_dem = ler_mosaico(tiles_dem(lons, lats), lons, lats, vazio=0)
    altitude = amostrar_bilinear(dem, t_dem, lons, lats).astype("<f8")

    saida = Path(__file__).parent / "out" / nome
    saida.mkdir(parents=True, exist_ok=True)
    fuel.tofile(saida / "fuel.bin")
    altitude.tofile(saida / "altitude.bin")
    shutil.copy(Path(__file__).parent / "fuels.csv", saida / "fuels.csv")

    contagem = {int(c): int((classes == c).sum()) for c in np.unique(classes)}
    # Legenda só do que queima e aparece na área; barreira fica transparente no mapa.
    e = profundidades(Path(__file__).parent / "fuels.csv")
    legenda = {
        int(i): {"nome": S2GLC[int(i)][0], "rgb": list(S2GLC[int(i)][1]), "profundidade": e[int(i)]}
        for i in np.unique(fuel)
        if e.get(int(i), 0) > 0
    }
    meta = {
        "nome": nome,
        "centro": list(centro),
        "lado": lado,
        "nx": n,
        "ny": n,
        "mapeamento": MAPEAMENTO_VERSAO,
        "fuelPadrao": SEM_COMBUSTIVEL,
        "gerado": date.today().isoformat(),
        "fontes": {
            "combustivel": {"dado": "ESA WorldCover 10m 2021 v200", "licenca": "CC-BY 4.0", "url": urls_wc},
            "relevo": {"dado": "Copernicus DEM GLO-30", "url": urls_dem},
        },
        "classesWorldCover": contagem,
        "legenda": legenda,
    }
    (saida / "meta.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")

    # GeoTIFF de inspeção em EPSG:4326. A grade é linear em lon/lat (mesma
    # aproximação do app), então a transformação afim é exata. Linha 0 do GeoTIFF = norte.
    t = from_origin(sw_lon, sw_lat + lado / M_POR_GRAU_LAT, celula / m_por_grau_lon(sw_lat), celula / M_POR_GRAU_LAT)
    perfil = dict(driver="GTiff", width=n, height=n, crs="EPSG:4326", transform=t)
    with rasterio.open(saida / "inspecao.tif", "w", count=3, dtype="float64", **perfil) as dst:
        dst.write(classes[::-1].astype("float64"), 1)
        dst.write(fuel[::-1].astype("float64"), 2)
        dst.write(altitude[::-1], 3)
        dst.descriptions = ("classe WorldCover", "fuel", "altitude (m)")

    print(f"Pacote em {saida}: {n}x{n} células de {celula} m")
    print(f"Classes WorldCover (células): {contagem}")
    print(f"Altitude: {altitude.min():.0f} a {altitude.max():.0f} m")


if __name__ == "__main__":
    main()
