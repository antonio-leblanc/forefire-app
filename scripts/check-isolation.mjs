// Duas simulações em dois Modules não podem se enxergar (SPEC §2.6, #175).
// Se isto falhar, o app não pode mais criar um Module novo por run e achar
// que está isolado. Com --same-module roda o controle: os dois fogos no mesmo
// Module, que tem que vazar (prova que o teste detecta o problema).
//
// Uso: node scripts/check-isolation.mjs path/to/forefire.mjs [--same-module]
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const modPath = process.argv[2];
if (!modPath) {
	console.error("uso: node check-isolation.mjs path/to/forefire.mjs [--same-module]");
	process.exit(2);
}
const sameModule = process.argv.includes("--same-module");
const { default: createForeFire } = await import(pathToFileURL(resolve(modPath)).href);

const L = 4000;
const N = 200;

// Mesmo setup do bindings/wasm/smoke.mjs do motor.
function run(Module, x) {
	const ff = new Module.ForeFire();
	ff.setString("fuelsTable", "Index;vv_coeff;Kcurv;beta\n1;1.0;1.0;1.0");
	ff.setDouble("defaultFuelType", 1.0);
	const solver = {
		spatialIncrement: 0.5,
		minimalPropagativeFrontDepth: 10,
		perimeterResolution: 10,
		initialFrontDepth: 0.1,
		relax: 1.0,
		smoothing: 0,
		minSpeed: 0.0,
		bmapLayer: 1,
		windReductionFactor: 1.0,
	};
	for (const [k, v] of Object.entries(solver)) ff.setDouble(k, v);
	ff.setString("propagationModel", "WindDriven");
	ff.execute(`FireDomain[sw=(0,0,0);ne=(${L},${L},0);t=0]`);

	const windU = new Float64Array(2 * N * N);
	windU.fill(1.0, 0, N * N);
	const windV = new Float64Array(2 * N * N);
	windV.fill(1.0, N * N);
	ff.addLayer("propagation", "WindDriven", "propagationModel");
	ff.addIndexLayer("table", "fuel", 0, 0, 0, L, L, 0, N, N, 1, 1, new Int32Array(N * N).fill(1));
	ff.addScalarLayer("windScalDir", "windU", 0, 0, 0, L, L, 0, N, N, 2, 1, windU);
	ff.addScalarLayer("windScalDir", "windV", 0, 0, 0, L, L, 0, N, N, 2, 1, windV);

	ff.execute(`startFire[loc=(${x},2000,0.);t=0]`);
	for (let t = 0; t < 120; t += 30) {
		ff.execute(`trigger[wind;loc=(0.,0.,0.);vel=(8,0,0);t=${t}]`);
		ff.execute("step[dt=30]");
	}
	return [...ff.execute("print[]").matchAll(/loc=\(([-\d.eE+]+),/g)].map((m) => parseFloat(m[1]));
}

// Fogo A perto de x=1000, fogo B perto de x=3000: qualquer nó de B com x < 2000
// só pode ter vindo de A.
const first = await createForeFire();
const a = run(first, 1000);
const b = run(sameModule ? first : await createForeFire(), 3000);
const leaked = b.filter((x) => x < 2000).length;

if (a.length === 0 || b.length === 0) {
	console.error("FALHOU: simulação sem frente");
	process.exit(1);
}
if (leaked > 0) {
	console.error(`FALHOU: ${leaked} nó(s) do primeiro fogo aparecem na segunda simulação`);
	process.exit(1);
}
console.log(`isolamento OK (${b.length} nós, nenhum do fogo anterior)`);
