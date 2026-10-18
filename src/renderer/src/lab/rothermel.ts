// Tabela de combustível do Lab (SPEC §6.2): a tabela S2GLC do ForeFire, a mesma
// que o pipeline copia em cada pacote, e o que cada coluna faz no Rothermel.
import fuelsCsv from '../../../../pipeline/fuels.csv?raw'
import s2glc from '../../../../pipeline/s2glc.json'

export const FUELS_TABLE = fuelsCsv

export interface Column {
  key: string
  unit: string
  /** O que a coluna é, em uma linha. */
  what: string
}

/** As colunas que o `Rothermel::getSpeed` do motor lê, na ordem do cálculo. */
export const USED: Column[] = [
  { key: 'e', unit: 'm', what: 'Fuel bed depth. Zero means no fuel: the cell is a barrier.' },
  { key: 'Sigmad', unit: 'kg/m²', what: 'Dead fuel load: dry mass of dead fuel per ground area.' },
  {
    key: 'Rhod',
    unit: 'kg/m³',
    what: 'Particle density of the dead fuel (the wood itself, not the bed).'
  },
  {
    key: 'sd',
    unit: '1/m',
    what: 'Surface-to-volume ratio of dead particles: higher means finer, faster to heat.'
  },
  {
    key: 'Md',
    unit: 'kg/kg',
    what: 'Dead fuel moisture, as a fraction of dry mass. Water costs heat to ignite.'
  },
  {
    key: 'me',
    unit: 'kg/kg',
    what: 'Moisture of extinction: at this moisture the reaction stops.'
  },
  { key: 'DeltaH', unit: 'J/kg', what: 'Heat of combustion: energy released per kg burnt.' }
]

export interface Fuel {
  index: number
  name: string
  color: string
  /** As 22 colunas sem o Index, na ordem do cabeçalho. */
  values: number[]
}

export interface FuelGroup {
  /** Combustíveis com a mesma linha de parâmetros: para o motor, são um só. */
  fuels: Fuel[]
  label: string
  color: string
  values: number[]
}

const lines = fuelsCsv.trim().split(/\r?\n/)
/** Cabeçalho sem o Index: a ordem que o `computeSpeed` espera depois de slope e vento. */
export const HEADER = lines[0].split(';').slice(1)
const col = (key: string): number => HEADER.indexOf(key)

/** Colunas da tabela que o Rothermel não lê (modelos de Balbi, combustível vivo...). */
export const UNUSED = HEADER.filter((k) => !USED.some((c) => c.key === k))

const names: Record<string, { nome: string; rgb: number[] }> = s2glc

// Linhas da tabela sem classe S2GLC: 0 é o combustível padrão do pacote (sem
// combustível), 255 é nuvem/sem dado no S2GLC.
const NO_CLASS: Record<string, string> = { '0': 'no fuel', '255': 'no data' }

/** Todas as linhas da tabela, na ordem do arquivo; as de `e` = 0 são barreira. */
export const ROWS: Fuel[] = lines.slice(1).map((line) => {
  const [index, ...rest] = line.split(';')
  const s = names[index]
  return {
    index: +index,
    name: s?.nome ?? NO_CLASS[index] ?? `fuel ${index}`,
    color: s ? `rgb(${s.rgb})` : '#888',
    values: rest.map(Number)
  }
})

export const burns = (f: Fuel): boolean => f.values[col('e')] > 0

/** Linhas que queimam, agrupadas quando os parâmetros são idênticos. */
export const GROUPS: FuelGroup[] = (() => {
  const byRow = new Map<string, Fuel[]>()
  for (const fuel of ROWS.filter(burns)) {
    const key = fuel.values.join(';')
    byRow.set(key, [...(byRow.get(key) ?? []), fuel])
  }
  return [...byRow.values()].map((fuels) => ({
    fuels,
    label: fuels.map((f) => f.name).join(' · '),
    color: fuels[0].color,
    values: fuels[0].values
  }))
})()

/** Grupo de curva a que a linha pertence (nenhum, se é barreira). */
export const groupOf = (f: Fuel): FuelGroup | undefined => GROUPS.find((g) => g.fuels.includes(f))

export const value = (g: { values: number[] }, key: string): number => g.values[col(key)]

/** Argumento do `computeSpeed[...]`: declive em graus vira tangente. */
export function query(g: FuelGroup, slopeDeg: number, wind: number, md?: number): string {
  const values = md === undefined ? g.values : g.values.map((v, i) => (i === col('Md') ? md : v))
  return [Math.tan((slopeDeg * Math.PI) / 180), wind, ...values].join(';')
}

/** Compactação do leito em relação ao ótimo do Rothermel (β/βop), com as
 *  mesmas conversões pra unidades inglesas do `Rothermel.cpp`. Abaixo de 1, o
 *  leito é aerado demais; acima, compacto demais. */
export function packing(g: { values: number[] }): number {
  const sd = value(g, 'sd') / 3.2808399
  const beta =
    (value(g, 'Sigmad') * 0.2048) / (value(g, 'e') * 3.2808399) / (value(g, 'Rhod') * 0.06)
  return beta / (3.348 * sd ** -0.8189)
}
