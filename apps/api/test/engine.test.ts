import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularGanancias, aplicarEscala, simular } from '../src/engine/ganancias.ts';

// ESCALA DE PRUEBA, inventada: solo verifica la mecánica. La real sale de parametros_fiscales.
const escala = [
  { desde: 0, hasta: 1000, fijo: 0, porcentaje: 10 },
  { desde: 1000, hasta: 5000, fijo: 100, porcentaje: 20 },
  { desde: 5000, hasta: null, fijo: 900, porcentaje: 30 },
];
const base = { ingresos3ra: 10000, gastos3ra: 3000, amortizaciones: 500, ingresos1ra: 1000, gastos1ra: 0,
  quebrantosAnteriores: 0, deduccionesPersonales: 1500, pagosACuenta: 500, escala };

test('escala progresiva', () => {
  assert.equal(aplicarEscala(500, escala), 50);
  assert.equal(aplicarEscala(3000, escala), 500);
  assert.equal(aplicarEscala(6000, escala), 1200);
  assert.equal(aplicarEscala(-5, escala), 0);
});

test('liquidación completa', () => {
  const r = calcularGanancias(base);
  assert.equal(r.resultado3ra, 6500);
  assert.equal(r.gananciaImponible, 6000);       // 6500 + 1000 - 1500
  assert.equal(r.impuestoDeterminado, 1200);
  assert.equal(r.saldo, 700);
});

test('quebranto solo contra 3ª categoría y hasta el resultado', () => {
  const r = calcularGanancias({ ...base, quebrantosAnteriores: 9000 });
  assert.equal(r.quebrantoUsado, 6500);
});

test('simulación: vender más sube el impuesto sin tocar lo real', () => {
  const s = simular(base, { ingresos3ra: 2000 });
  assert.equal(s.real.impuestoDeterminado, 1200);
  assert.equal(s.simulado.impuestoDeterminado, 1800);
});
