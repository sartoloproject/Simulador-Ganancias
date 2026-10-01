import type { Parametros } from '../engine/anual.ts';
// Fuente: tablas ARCA "liquidación anual 2026" (art. 94 y art. 30). Verificar en arca.gob.ar antes de usar.
export const P2026: Parametros = {
  anio: 2026,
  mni: 6019671.36, conyuge: 5669323.06, hijo: 2859060.31, hijoIncap: 5718120.60,
  dedEspecial: { ap1: 21068849.78, ap1Nuevos: 24078685.46, ap2: 28894422.56 },
  escala: [
    { desde: 0, hasta: 2336953.69, fijo: 0, pct: 5 },
    { desde: 2336953.69, hasta: 4673907.36, fijo: 116847.68, pct: 9 },
    { desde: 4673907.36, hasta: 7010861.05, fijo: 327173.52, pct: 12 },
    { desde: 7010861.05, hasta: 10516291.59, fijo: 607607.96, pct: 15 },
    { desde: 10516291.59, hasta: 21032583.18, fijo: 1133422.54, pct: 19 },
    { desde: 21032583.18, hasta: 31548874.77, fijo: 3131517.94, pct: 23 },
    { desde: 31548874.77, hasta: 47323312.16, fijo: 5550265.01, pct: 27 },
    { desde: 47323312.16, hasta: 70984968.25, fijo: 9809363.10, pct: 31 },
    { desde: 70984968.25, hasta: null, fijo: 17144476.49, pct: 35 },
  ],
  // Topes a confirmar con el contador. Los conceptos sin tope no se computan hasta cargarlo.
  topes: {
    salud: { tipo: 'pctNeta', valor: 5 },
    donaciones: { tipo: 'pctNeta', valor: 5 },
    alquiler: { tipo: 'mni', factor: 0.4 },
    servicioDomestico: { tipo: 'mni' },
  },
};
