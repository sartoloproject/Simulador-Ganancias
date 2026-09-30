import { fechaISO, r2 } from './numeros.ts';

export interface Comprobante {
  cae: string; fecha: string; tipo_codigo: number; tipo_desc: string;
  punto_venta: number; numero: number;
  emisor_cuit: string; emisor_nombre: string;
  moneda: 'ARS' | 'USD'; tipo_cambio: number;
  neto_gravado: number; neto_no_gravado: number; exento: number; otros_tributos: number;
  iva: number; total: number; signo: 1 | -1; total_ars: number; neto_ars: number;
}

const num = (v: unknown): number => {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isNaN(n) ? 0 : n;
};

/**
 * Recibe las filas del Excel "Mis Comprobantes Recibidos" (array de arrays, ej. SheetJS sheet_to_json({header:1})).
 * Detecta la fila de encabezados buscando "Fecha" + "Imp. Total", así tolera filas de título.
 */
export function parseComprobantes(rows: unknown[][]): { items: Comprobante[]; errores: string[] } {
  const h = rows.findIndex(r => r?.includes('Fecha') && r?.includes('Imp. Total'));
  if (h < 0) throw new Error('No se encontró la fila de encabezados (Fecha / Imp. Total).');
  const cols = rows[h].map(c => String(c ?? '').trim());
  const idx = (name: string) => {
    const i = cols.indexOf(name);
    if (i < 0) throw new Error(`Falta la columna "${name}"`);
    return i;
  };
  const C = {
    fecha: idx('Fecha'), tipo: idx('Tipo'), pv: idx('Punto de Venta'), nro: idx('Número Desde'),
    cae: idx('Cód. Autorización'), cuit: idx('Nro. Doc. Emisor'), nombre: idx('Denominación Emisor'),
    tc: idx('Tipo Cambio'), mon: idx('Moneda'), netoGrav: idx('Neto Gravado Total'),
    noGrav: idx('Neto No Gravado'), exento: idx('Op. Exentas'), otros: idx('Otros Tributos'),
    iva: idx('Total IVA'), total: idx('Imp. Total'),
  };
  const items: Comprobante[] = [];
  const errores: string[] = [];
  rows.slice(h + 1).forEach((r, i) => {
    if (!r || !r[C.fecha]) return;
    try {
      const tipoTxt = String(r[C.tipo]);
      const tipo_codigo = Number(tipoTxt.split('-')[0].trim());
      const signo: 1 | -1 = /cr[eé]dito/i.test(tipoTxt) ? -1 : 1;
      const moneda = String(r[C.mon]).trim() === '$' ? 'ARS' : 'USD';
      const tipo_cambio = num(r[C.tc]) || 1;
      const neto_gravado = num(r[C.netoGrav]), neto_no_gravado = num(r[C.noGrav]), exento = num(r[C.exento]);
      const total = num(r[C.total]);
      items.push({
        cae: String(r[C.cae]), fecha: fechaISO(String(r[C.fecha])), tipo_codigo,
        tipo_desc: tipoTxt.split('-').slice(1).join('-').trim(),
        punto_venta: num(r[C.pv]), numero: num(r[C.nro]),
        emisor_cuit: String(r[C.cuit]), emisor_nombre: String(r[C.nombre]).trim(),
        moneda, tipo_cambio, neto_gravado, neto_no_gravado, exento,
        otros_tributos: num(r[C.otros]), iva: num(r[C.iva]), total, signo,
        total_ars: r2(total * tipo_cambio * signo),
        // Factura C / monotributo: no discrimina IVA, el neto es el total
        neto_ars: r2((neto_gravado + neto_no_gravado + exento || (num(r[C.iva]) === 0 ? total : 0)) * tipo_cambio * signo),
      });
    } catch (e) {
      errores.push(`Fila ${h + 2 + i}: ${(e as Error).message}`);
    }
  });
  return { items, errores };
}
