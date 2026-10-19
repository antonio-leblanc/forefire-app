// O Rothermel aberto por dentro (PLAN M3, trilha de estudo, etapa 1): o mesmo
// cálculo do `Rothermel::getSpeed` do motor, linha a linha, devolvendo cada
// termo em vez de só a velocidade. Serve pra ler a fórmula, não pra simular: a
// velocidade final é conferida contra o `computeSpeed` do WASM na tela.
import { value } from './rothermel'

// Conversões do `Rothermel.cpp`, com os mesmos fatores (o modelo calcula em
// unidades inglesas). As inversas servem só pra mostrar os termos em SI.
const KGM3_TO_LBFT3 = 0.06
const PER_M_TO_PER_FT = 1 / 3.2808399
const M_TO_FT = 3.2808399
const KGM2_TO_LBFT2 = 0.2048
const JKG_TO_BTULB = 1 / 2326
const MS_TO_FTMIN = 196.850394
const FTMIN_TO_MS = 0.00508
// BTU/(ft²·min) → kW/m², composto das conversões acima e não do fator exato
// (~0,189): o motor arredonda lb/ft³ pra 0,06, e só assim R0 = IR·ξ / (ρb·ε·Qig)
// fecha em SI com os números da tela.
const IR_TO_KWM2 = FTMIN_TO_MS / KGM3_TO_LBFT3 / JKG_TO_BTULB / 1000

export interface Inside {
  /** Md / me: a 1, a reação para. */
  moistureRatio: number
  /** Amortecimento da umidade, ηM (1 seco, 0 na extinção). */
  etaM: number
  /** Densidade do leito, ρb = Sigmad / e, kg/m³. */
  rhoBulk: number
  /** Compactação β = ρb / Rhod e o ótimo βop, que só depende de `sd`. */
  beta: number
  betaOp: number
  /** Velocidade de reação Γ' (1/min): quão rápido o combustível queima. */
  reactionVelocity: number
  /** Intensidade de reação IR, kW/m²: calor liberado pela frente. */
  ir: number
  /** Fração do IR que chega ao combustível à frente, ξ. */
  xi: number
  /** Fração de cada partícula que precisa esquentar até ignitar, ε. */
  epsilon: number
  /** Calor pra ignitar 1 kg (aquecer + evaporar a água), Qig, kJ/kg. */
  qig: number
  /** Velocidade sem vento e sem declive, R0, m/min. */
  r0: number
  /** Vento na altura da chama, depois do `windReductionFactor`, m/s. */
  windMidflame: number
  /** Teto de vento de Andrews/Cruz/Rothermel (2013), m/s, e se foi atingido. */
  windCap: number
  capped: boolean
  /** Fatores de vento e declive: R = R0 · (1 + φw + φs). */
  phiW: number
  phiS: number
  /** Velocidade final, m/min. */
  r: number
}

/** `Rothermel::getSpeed` com os termos à mostra. `slopeTan` é a tangente do
 *  declive e `wind` o vento normal à frente, em m/s, como no `computeSpeed`. */
export function inside(
  row: { values: number[] },
  slopeTan: number,
  wind: number,
  windReductionFactor: number,
  md = value(row, 'Md')
): Inside {
  const rhod = value(row, 'Rhod') * KGM3_TO_LBFT3
  const sd = value(row, 'sd') * PER_M_TO_PER_FT
  const e = value(row, 'e') * M_TO_FT
  const sigmad = value(row, 'Sigmad') * KGM2_TO_LBFT2
  const deltaH = value(row, 'DeltaH') * JKG_TO_BTULB
  const me = value(row, 'me')

  let u = Math.max(0, wind * MS_TO_FTMIN * windReductionFactor)
  const tan = Math.max(0, slopeTan)

  const ratio = md / me
  const etaM = 1 + ratio * (-2.59 + ratio * (5.11 - 3.52 * ratio))
  const A = 1 / (4.774 * sd ** 0.1 - 7.27)
  const rhoBulk = sigmad / e
  const beta = rhoBulk / rhod
  const betaOp = 3.348 * sd ** -0.8189
  const gammaMax = sd ** 1.5 / (495 + 0.0594 * sd ** 1.5)
  const gamma = gammaMax * (beta / betaOp) ** A * Math.exp(A * (1 - beta / betaOp))
  const xi = Math.exp((0.792 + 0.681 * sd ** 0.5) * (beta + 0.1)) / (192 + 0.259 * sd)
  const epsilon = Math.exp(-138 / sd)
  const qig = 250 + 1116 * md
  const C = 7.47 * Math.exp(-0.133 * sd ** 0.55)
  const B = 0.02526 * sd ** 0.54
  const E = 0.715 * Math.exp(-3.59 * (10e-4 * sd))
  const ir = gamma * sigmad * deltaH * etaM
  const cap = windReductionFactor < 1 ? 96.81 * Math.cbrt(ir) : 0.9 * ir
  const capped = u > cap
  if (capped) u = cap
  const phiW = C * (beta / betaOp) ** -E * u ** B
  const phiS = 5.275 * beta ** -0.3 * tan ** 2
  const r0 = (ir * xi) / (rhoBulk * epsilon * qig)
  let r = Math.max(r0 * (1 + phiW + phiS), r0)
  if (!(r > 0)) r = 0

  const toMmin = (ftmin: number): number => ftmin * FTMIN_TO_MS * 60
  return {
    moistureRatio: ratio,
    etaM,
    rhoBulk: rhoBulk / KGM3_TO_LBFT3,
    beta,
    betaOp,
    reactionVelocity: gamma,
    ir: ir * IR_TO_KWM2,
    xi,
    epsilon,
    qig: qig / JKG_TO_BTULB / 1000,
    r0: toMmin(r0),
    windMidflame: u / MS_TO_FTMIN,
    windCap: cap / MS_TO_FTMIN,
    capped,
    phiW,
    phiS,
    r: toMmin(r)
  }
}
