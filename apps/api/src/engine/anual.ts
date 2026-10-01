// Motor anual de Ganancias para persona humana (percibido). Puro: todo valor legal llega en `Parametros`.
export interface Tramo { desde: number; hasta: number | null; fijo: number; pct: number }
export interface Tope { tipo: 'pctNeta' | 'pctMni' | 'mni' | 'fijo'; valor?: number; factor?: number }
export interface Parametros {
  anio: number; escala: Tramo[]; mni: number; conyuge: number; hijo: number; hijoIncap: number;
  dedEspecial: { ap1: number; ap1Nuevos: number; ap2: number }; topes: Record<string, Tope>;
}
export interface Entrada {
  c3: { ingresos: number; gastos: number; amortizaciones: number; ajusteExistencias: number; ajusteInflacion: number; quebrantos: number };
  c1: { ingresos: number; gastos: number; presuncionPct?: number };
  c2: number; c4: number;                               // netos de 2ª (a escala) y 4ª
  generales: Record<string, number>;                    // monto pagado por concepto (salud, donaciones, alquiler...)
  personales: { conyuge: boolean; hijos: number; hijosIncap: number; dedEspecial: 'ap1' | 'ap1Nuevos' | 'ap2' | 'ninguna' };
  cedular: number;                                      // impuesto de rentas con alícuota fija, calculado aparte
  pagos: { retenciones: number; anticipos: number; debCred: number; saldoFavor: number };
}
const r2 = (n: number) => Math.round(n * 100) / 100;

export function escala(base: number, t: Tramo[]): number {
  if (base <= 0) return 0;
  const x = t.find(r => base > r.desde && (r.hasta === null || base <= r.hasta));
  if (!x) throw new Error('La escala no cubre la base imponible');
  return x.fijo + (base - x.desde) * x.pct / 100;
}

function topeDe(t: Tope | undefined, neta: number, p: Parametros): number | null {
  if (!t) return null;
  if (t.tipo === 'pctNeta') return Math.max(0, neta) * (t.valor ?? 0) / 100;
  if (t.tipo === 'pctMni') return p.mni * (t.valor ?? 0) / 100;
  if (t.tipo === 'mni') return p.mni;
  return t.valor ?? null;
}

export function calcularAnual(e: Entrada, p: Parametros) {
  const adv: string[] = [];
  // 3ª categoría: el resultado negativo del año es un quebranto, no resta a otras categorías
  const res3 = e.c3.ingresos - e.c3.gastos - e.c3.amortizaciones + e.c3.ajusteExistencias + e.c3.ajusteInflacion;
  const quebrantoUsado = res3 > 0 ? Math.min(res3, e.c3.quebrantos) : 0;
  const quebrantoGenerado = res3 < 0 ? -res3 : 0;
  const net3 = Math.max(0, res3) - quebrantoUsado;
  const res1 = e.c1.ingresos - (e.c1.presuncionPct !== undefined ? e.c1.ingresos * e.c1.presuncionPct / 100 : e.c1.gastos);
  const neta = net3 + res1 + e.c2 + e.c4;

  // Deducciones generales con tope; sin tope cargado NO se computan (criterio conservador)
  const generales: Record<string, { monto: number; tope: number | null; computado: number }> = {};
  let totalGenerales = 0;
  for (const [k, monto] of Object.entries(e.generales)) {
    const t = p.topes[k];
    const tope = topeDe(t, neta, p);
    const base = monto * (t?.factor ?? 1);
    const computado = tope === null ? 0 : Math.min(base, tope);
    if (tope === null && monto > 0) adv.push(`"${k}": no hay tope cargado en los parámetros ${p.anio}; no se computó.`);
    generales[k] = { monto, tope: tope === null ? null : r2(tope), computado: r2(computado) };
    totalGenerales += computado;
  }

  // Deducciones personales
  const de = e.personales.dedEspecial === 'ninguna' ? 0 : p.dedEspecial[e.personales.dedEspecial];
  const personales = p.mni + (e.personales.conyuge ? p.conyuge : 0) + e.personales.hijos * p.hijo
    + e.personales.hijosIncap * p.hijoIncap + de;

  const netaSujeta = Math.max(0, neta - totalGenerales - personales); // las deducciones no generan quebranto
  const impuestoEscala = escala(netaSujeta, p.escala);
  const impuestoTotal = impuestoEscala + e.cedular;
  const pagos = e.pagos.retenciones + e.pagos.anticipos + e.pagos.debCred + e.pagos.saldoFavor;
  return {
    res3: r2(res3), quebrantoUsado: r2(quebrantoUsado), quebrantoGenerado: r2(quebrantoGenerado), res1: r2(res1),
    gananciaNeta: r2(neta), generales, totalGenerales: r2(totalGenerales), personales: r2(personales),
    netaSujeta: r2(netaSujeta), impuestoEscala: r2(impuestoEscala), cedular: r2(e.cedular),
    impuestoTotal: r2(impuestoTotal), pagos: r2(pagos), saldo: r2(impuestoTotal - pagos), advertencias: adv,
  };
}
