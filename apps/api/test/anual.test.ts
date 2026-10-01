import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularAnual, escala, type Entrada } from '../src/engine/anual.ts';
import { P2026 } from '../src/parametros/2026.ts';

const base: Entrada = {
  c3: { ingresos: 100e6, gastos: 55e6, amortizaciones: 5e6, ajusteExistencias: 0, ajusteInflacion: 0, quebrantos: 0 },
  c1: { ingresos: 6e6, gastos: 1e6 }, c2: 0, c4: 0,
  generales: { salud: 3e6 },
  personales: { conyuge: false, hijos: 0, hijosIncap: 0, dedEspecial: 'ap1' },
  cedular: 0, pagos: { retenciones: 355436.38, anticipos: 1e6, debCred: 0, saldoFavor: 0 },
};

test('escala ARCA 2026: continuidad entre tramos', () => {
  for (let i = 0; i < P2026.escala.length - 1; i++) {
    const t = P2026.escala[i];
    assert.ok(Math.abs(escala(t.hasta!, P2026.escala) - P2026.escala[i + 1].fijo) < 0.05, `tramo ${i + 1}`);
  }
});
test('caso completo con cálculo a mano', () => {
  const r = calcularAnual(base, P2026);
  assert.equal(r.res3, 40e6); assert.equal(r.res1, 5e6); assert.equal(r.gananciaNeta, 45e6);
  assert.equal(r.generales.salud.computado, 2250000);            // tope 5% de 45M
  assert.equal(r.personales, 27088521.14);                       // MNI + deducción especial ap.1
  assert.equal(r.netaSujeta, 15661478.86);
  assert.equal(r.impuestoEscala, 2111008.12);                    // 1.133.422,54 + 19% del excedente
  assert.equal(r.saldo, 755571.74);
});
test('quebranto: se usa hasta el resultado y uno nuevo no resta a otras categorías', () => {
  assert.equal(calcularAnual({ ...base, c3: { ...base.c3, quebrantos: 99e6 } }, P2026).quebrantoUsado, 40e6);
  const r = calcularAnual({ ...base, c3: { ...base.c3, ingresos: 10e6 } }, P2026);
  assert.equal(r.quebrantoGenerado, 50e6); assert.equal(r.gananciaNeta, 5e6);
});
test('deducciones no generan quebranto y concepto sin tope no se computa', () => {
  const r = calcularAnual({ ...base, generales: { hipotecarios: 1e6 } }, P2026);
  assert.equal(r.totalGenerales, 0); assert.equal(r.advertencias.length, 1);
  const chico = calcularAnual({ ...base, c3: { ...base.c3, ingresos: 60e6 }, c1: { ingresos: 0, gastos: 0 } }, P2026);
  assert.equal(chico.netaSujeta, 0); assert.equal(chico.impuestoTotal, 0);
});
