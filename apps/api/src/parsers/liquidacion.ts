import { parseNum, fechaISO, r2 } from './numeros.ts';

export interface Liquidacion {
  coe: string; fecha: string; tipo_operacion: string;
  comprador_cuit: string; comprador_nombre: string;
  grano: string; grado: string; kg: number; precio_kg: number;
  subtotal: number; iva: number; iva_alicuota: number;
  comision: number; comision_iva: number; sellos: number; registro: number; deducciones_total: number;
  ret_ganancias: number; ret_iva: number;
  total_operacion: number; neto_a_pagar: number; pago_segun_condiciones: number;
  advertencias: string[];
}

const M = (t: string, re: RegExp, what: string): RegExpMatchArray => {
  const m = t.match(re);
  if (!m) throw new Error(`Liquidación: no se encontró ${what}`);
  return m;
};

/**
 * Lee el texto de una Liquidación Primaria de Granos (ARCA). Usa solo la primera copia (página 1).
 * cuitPropio permite distinguir comprador de vendedor sin depender del orden del texto.
 */
export function parseLiquidacion(textoCompleto: string, cuitPropio: string): Liquidacion {
  const adv: string[] = [];
  const t = textoCompleto.split('\f')[0];
  const coe = M(t, /C\.O\.E\.:\s*(\d+)/, 'C.O.E.')[1];
  const fecha = fechaISO(M(t, /Fecha:\s*(\d{2}\/\d{2}\/\d{4})/, 'fecha')[0]);
  const tipo_operacion = M(t, /Tipo de operaci[oó]n:\s*(.+)/, 'tipo de operación')[1].trim();

  const cuits = [...t.matchAll(/C\.U\.I\.T\.:\s*(\d{11})/g)].map(m => m[1]);
  const otro = cuits.find(c => c !== cuitPropio);
  if (!cuits.includes(cuitPropio)) adv.push('El CUIT propio no figura en la liquidación: revisar que sea tuya.');
  const comprador_cuit = otro ?? '';
  const nombres = [...t.matchAll(/Raz[oó]n Social:\s*([^\n]+?)(?:\s{2,}|\n|$)/g)].map(m => m[1].trim());
  const comprador_nombre = /ASOCIACION DE COOPERATIVAS/.test(t) && comprador_cuit === '30500120882'
    ? 'ASOCIACION DE COOPERATIVAS ARGENTINAS - COOP. LTDA.' : (nombres[0] ?? '');

  const gm = M(t, /\b(\d{1,2})\s*-\s*(MAIZ|MAÍZ|SOJA|TRIGO|GIRASOL|SORGO|CEBADA|AVENA|COLZA)\b/i, 'grano');
  const grano = gm[2].toUpperCase().replace('MAÍZ', 'MAIZ');
  const grado = (t.match(/\bG(\d)\b/) ?? [, ''])[0] || '';

  // Fila OPERACIÓN: kg, precio/kg, subtotal, % IVA, importe IVA, total c/IVA
  const op = M(t, /(\d+)\s*Kg\s+\$\s*([\d.,]+)\s+\$\s*([\d.,]+)\s+([\d.,]+)\s+\$\s*([\d.,]+)\s+\$\s*([\d.,]+)/, 'fila de operación');
  const [kg, precio_kg, subtotal, iva_alicuota, iva, total_operacion] = op.slice(1).map(parseNum);

  // DEDUCCIONES: filas "$ base  alic%  $ iva  $ importe", clasificadas por el texto que las precede
  const secDed = t.slice(t.search(/DEDUCCIONES/), t.search(/RETENCIONES/));
  let sellos = 0, registro = 0, comision = 0, comision_iva = 0, dedSuma = 0;
  let cursor = 0;
  const reDed = /\$\s*([\d.,]+)\s+(\d+(?:\.\d+)?)%\s+\$\s*([\d.,]+)\s+\$\s*([\d.,]+)/g;
  for (const m of secDed.matchAll(reDed)) {
    const previo = secDed.slice(cursor, m.index);
    cursor = (m.index ?? 0) + m[0].length;
    const importe = parseNum(m[4]);
    dedSuma += importe;
    if (/SELLOS/i.test(previo)) sellos += importe;
    else if (/Registro/i.test(previo)) registro += importe;
    else if (/Comisi/i.test(previo)) { comision += importe - parseNum(m[3]); comision_iva += parseNum(m[3]); }
    else adv.push(`Deducción sin clasificar por $${importe}`);
  }

  // Totales
  const tot = (re: RegExp, n: string) => parseNum(M(t, re, n)[1]);
  const deducciones_total = tot(/Total Deducciones:\s*\$\s*([\d.,]+)/, 'Total Deducciones');
  const totRetAfip = tot(/Total Retenciones Afip:\s*\$\s*([\d.,]+)/, 'Total Retenciones Afip');
  const neto_a_pagar = tot(/Importe Neto a Pagar:\s*\$\s*([\d.,]+)/, 'Importe Neto a Pagar');
  const pago_segun_condiciones = tot(/Pago seg[uú]n condiciones:\s*\$\s*([\d.,]+)/, 'Pago según condiciones');
  if (Math.abs(dedSuma - deducciones_total) > 0.05) adv.push(`Deducciones leídas (${r2(dedSuma)}) no coinciden con el total (${deducciones_total}).`);

  // RETENCIONES: el orden del texto varía según el extractor de PDF, así que se identifican
  // pares (base, retención) que cumplan base × alícuota = retención.
  const secRet = t.slice(t.search(/RETENCIONES\s*\n/), t.search(/IMPORTES TOTALES/));
  const alic = [...secRet.matchAll(/(\d+(?:\.\d+)?)%/g)].map(m => Number(m[1]));
  const nums = [...secRet.matchAll(/\d{1,3}(?:,\d{3})+\.\d{2}/g)].map(m => parseNum(m[0]));
  const buscar = (a: number) => {
    for (const base of nums) for (const ret of nums)
      if (ret !== base && Math.abs(base * a / 100 - ret) < 0.02) return ret;
    return 0;
  };
  const ret_ganancias = alic[0] !== undefined ? buscar(alic[0]) : 0;
  const ret_iva = alic[1] !== undefined ? buscar(alic[1]) : 0;
  if (Math.abs(ret_ganancias + ret_iva - totRetAfip) > 0.05)
    adv.push(`Retenciones leídas (${r2(ret_ganancias + ret_iva)}) no coinciden con Total Retenciones Afip (${totRetAfip}).`);

  return {
    coe, fecha, tipo_operacion, comprador_cuit, comprador_nombre, grano, grado, kg, precio_kg,
    subtotal, iva, iva_alicuota, comision: r2(comision), comision_iva: r2(comision_iva),
    sellos, registro, deducciones_total, ret_ganancias, ret_iva,
    total_operacion, neto_a_pagar, pago_segun_condiciones, advertencias: adv,
  };
}
