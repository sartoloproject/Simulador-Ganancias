import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parseNum } from '../src/parsers/numeros.ts';
import { parseComprobantes } from '../src/parsers/comprobantes.ts';
import { parseLiquidacion } from '../src/parsers/liquidacion.ts';

// Los archivos reales NO se versionan (datos personales). Se apuntan con FIXTURES=/ruta
const FX = process.env.FIXTURES;
const hay = (f: string) => FX && existsSync(`${FX}/${f}`);

test('parseNum soporta formatos de ARCA', () => {
  assert.equal(parseNum('$ 3,554.36'), 3554.36);
  assert.equal(parseNum('$ 0,00'), 0);
  assert.equal(parseNum('47847,20'), 47847.2);
  assert.equal(parseNum('$270.90'), 270.9);
  assert.equal(parseNum('1,244,027.32'), 1244027.32);
});

test('comprobantes: lee el Excel de ARCA', { skip: !hay('comprobantes.json') }, () => {
  const rows = JSON.parse(readFileSync(`${FX}/comprobantes.json`, 'utf8'));
  const { items, errores } = parseComprobantes(rows);
  assert.deepEqual(errores, []);
  assert.equal(items.length, 84);
  assert.equal(new Set(items.map(i => i.cae)).size, 84, 'CAE únicos');
  assert.ok(items.filter(i => i.signo === -1).length === 16, 'notas de crédito restan');
  assert.ok(items.some(i => i.moneda === 'USD' && i.tipo_cambio > 1000));
  const c = items.find(i => i.tipo_codigo === 11)!;           // Factura C: neto = total
  assert.equal(c.neto_ars, c.total);
});

test('liquidación: lee la liquidación primaria (layout y texto plano)', { skip: !hay('liquidacion.txt') }, () => {
  for (const f of ['liquidacion.txt', 'liquidacion_raw.txt']) {
    if (!hay(f)) continue;
    const l = parseLiquidacion(readFileSync(`${FX}/${f}`, 'utf8'), process.env.CUIT_PROPIO ?? '20184558131');
    assert.equal(l.coe, '330232579743');
    assert.equal(l.fecha, '2026-09-25');
    assert.equal(l.grano, 'MAIZ');
    assert.equal(l.kg, 67285);
    assert.equal(l.subtotal, 18227506.5);
    assert.equal(l.comision, 455687.66);
    assert.equal(l.sellos, 3554.36);
    assert.equal(l.registro, 17771.82);
    assert.equal(l.ret_ganancias, 355436.38);
    assert.equal(l.ret_iva, 1244027.32);
    assert.equal(l.neto_a_pagar, 18017069.94);
    assert.deepEqual(l.advertencias, [], `${f}: ${l.advertencias.join(' | ')}`);
  }
});
