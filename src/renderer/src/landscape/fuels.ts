// Combustíveis do Rothermel, linhas tiradas do tests/runff/fuels.csv do próprio
// ForeFire (SPEC §4), não números inventados. Profundidade zero (índice 0) faz
// a célula funcionar como barreira.

const HEADER =
  'Index;Rhod;Rhol;Md;Ml;sd;sl;e;Sigmad;Sigmal;stoch;RhoA;Ta;Tau0;Deltah;DeltaH;Cp;Cpa;Ti;X0;r00;Blai;me'

export interface Fuel {
  index: number
  label: string
  rgb: [number, number, number]
  row: string
}

export const FUELS: Fuel[] = [
  {
    index: 5,
    label: 'arbusto / maquis (0,6 m)',
    rgb: [46, 125, 50],
    row: '5;626.0;600.0;0.1;1.0;4325.0;5844.0;0.6;1.393;0.201;8.3;1.0;300;70000;18802000.0;18802000.0;1800;1000;600;0.3;2.5e-05;4.0;0.3'
  },
  {
    index: 4,
    label: 'capim / esparso (0,19 m)',
    rgb: [190, 180, 70],
    row: '4;613.0;538.0;0.1;1.0;4357.0;6524.0;0.19;1.286;0.085;8.3;1.0;300;70000;18677000.0;18677000.0;1800;1000;600;0.3;2.5e-05;4.0;0.3'
  },
  {
    index: 0,
    label: 'sem combustível',
    rgb: [110, 100, 95],
    row: '0;563.0;522.0;0.1;1.0;6099.0;7273.0;0;0.764;0.352;8.3;1.0;300;70000;18169000.0;18167000.0;1800;1000;600;0.3;2.5e-05;4.0;0.3'
  }
]

export const FUELS_TABLE = [HEADER, ...FUELS.map((f) => f.row)].join('\n')
