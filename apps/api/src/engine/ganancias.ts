/**
 * Motor de cálculo (puro, sin base de datos). Criterio: percibido, año fiscal enero-diciembre.
 * Todo parámetro fiscal (escala, deducciones) llega por argumento: NO hay valores legales en el código.
 */
export interface TramoEscala { desde: number; hasta: number | null; fijo: number; porcentaje: number }

export interface EntradaGanancias {
  ingresos3ra: number;            // ventas de granos percibidas (sin IVA)
  gastos3ra: number;              // gastos deducibles pagados (sin IVA)
  amortizaciones: number;         // amortización anual de bienes de uso
  ingresos1ra: number;            // arrendamientos cobrados
  gastos1ra: number;
  quebrantosAnteriores: number;   // quebrantos de 3ª categoría a compensar
  deduccionesPersonales: number;  // mínimo no imponible + cargas + deducción especial (del año)
  pagosACuenta: number;           // retenciones sufridas + anticipos + otros computables
  escala: TramoEscala[];          // escala progresiva del año
}

export interface ResultadoGanancias {
  resultado3ra: number; resultado1ra: number;
  quebrantoUsado: number; gananciaNeta: number; gananciaImponible: number;
  impuestoDeterminado: number; pagosACuenta: number; saldo: number; // saldo > 0 = a pagar
}

export function aplicarEscala(base: number, escala: TramoEscala[]): number {
  if (base <= 0) return 0;
  const t = escala.find(x => base > x.desde && (x.hasta === null || base <= x.hasta));
  if (!t) throw new Error('La escala no cubre la base imponible: revisar parámetros del año.');
  return t.fijo + (base - t.desde) * t.porcentaje / 100;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function calcularGanancias(e: EntradaGanancias): ResultadoGanancias {
  const resultado3ra = e.ingresos3ra - e.gastos3ra - e.amortizaciones;
  const resultado1ra = e.ingresos1ra - e.gastos1ra;
  // el quebranto solo se compensa contra ganancia de 3ª categoría
  const quebrantoUsado = resultado3ra > 0 ? Math.min(resultado3ra, e.quebrantosAnteriores) : 0;
  const gananciaNeta = resultado3ra - quebrantoUsado + resultado1ra;
  const gananciaImponible = Math.max(0, gananciaNeta - e.deduccionesPersonales);
  const impuestoDeterminado = aplicarEscala(gananciaImponible, e.escala);
  return {
    resultado3ra: r2(resultado3ra), resultado1ra: r2(resultado1ra), quebrantoUsado: r2(quebrantoUsado),
    gananciaNeta: r2(gananciaNeta), gananciaImponible: r2(gananciaImponible),
    impuestoDeterminado: r2(impuestoDeterminado), pagosACuenta: r2(e.pagosACuenta),
    saldo: r2(impuestoDeterminado - e.pagosACuenta),
  };
}

/** Escenario: suma ajustes hipotéticos a la entrada real (ej. vender X más, comprar un bien). */
export function simular(base: EntradaGanancias, ajustes: Partial<Record<keyof Omit<EntradaGanancias, 'escala'>, number>>) {
  const mod = { ...base };
  for (const [k, v] of Object.entries(ajustes)) (mod as any)[k] = (mod as any)[k] + (v ?? 0);
  return { real: calcularGanancias(base), simulado: calcularGanancias(mod) };
}
