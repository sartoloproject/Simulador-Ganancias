/** Convierte importes de ARCA a número. Soporta "3,554.36", "47847,20", "270.90", "$ 1,244,027.32". */
export function parseNum(raw: string): number {
  let s = raw.replace(/[$\s]/g, '');
  if (!s) return 0;
  const tieneComa = s.includes(',');
  const tienePunto = s.includes('.');
  if (tieneComa && tienePunto) {
    // el último separador es el decimal
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (tieneComa) {
    // "0,00" / "47847,20" → decimal; "1,244" → miles
    s = /,\d{2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '');
  }
  const n = Number(s);
  if (Number.isNaN(n)) throw new Error(`Importe inválido: "${raw}"`);
  return n;
}

export function fechaISO(dmy: string): string {
  const m = dmy.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) throw new Error(`Fecha inválida: "${dmy}"`);
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export const r2 = (n: number) => Math.round(n * 100) / 100;
