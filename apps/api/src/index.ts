import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { parseComprobantes } from './parsers/comprobantes.ts';
import { parseLiquidacion } from './parsers/liquidacion.ts';
import { calcularAnual, type Entrada, type Parametros } from './engine/anual.ts';
import { P2026 } from './parametros/2026.ts';
import { calcularGanancias, simular, type EntradaGanancias } from './engine/ganancias.ts';

type Env = { Bindings: { DB: D1Database; CUIT_PROPIO: string } };
const app = new Hono<Env>();
app.use('/api/*', cors());

const rango = (anio: number) => [`${anio}-01-01`, `${anio}-12-31`] as const;
const anioQ = (v: string | undefined) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 2000 || n > 2100) throw new Error('Parámetro anio inválido');
  return n;
};

// ---------- Importadores ----------
app.post('/api/import/comprobantes', async c => {
  const { rows } = await c.req.json<{ rows: unknown[][] }>();
  const { items, errores } = parseComprobantes(rows);
  const stmt = c.env.DB.prepare(`INSERT OR IGNORE INTO comprobantes
    (cae,fecha,tipo_codigo,tipo_desc,punto_venta,numero,emisor_cuit,emisor_nombre,moneda,tipo_cambio,
     neto_gravado,neto_no_gravado,exento,otros_tributos,iva,total,signo,total_ars,neto_ars)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const res = await c.env.DB.batch(items.map(i => stmt.bind(
    i.cae, i.fecha, i.tipo_codigo, i.tipo_desc, i.punto_venta, i.numero, i.emisor_cuit, i.emisor_nombre,
    i.moneda, i.tipo_cambio, i.neto_gravado, i.neto_no_gravado, i.exento, i.otros_tributos, i.iva, i.total,
    i.signo, i.total_ars, i.neto_ars)));
  const nuevos = res.reduce((a, r) => a + (r.meta.changes ?? 0), 0);
  return c.json({ leidos: items.length, nuevos, duplicados: items.length - nuevos, errores });
});

// El navegador extrae el texto del PDF (pdf.js) y lo envía acá.
app.post('/api/import/liquidacion', async c => {
  const { text, fecha_cobro, ubicacion } = await c.req.json<{ text: string; fecha_cobro?: string; ubicacion?: string }>();
  const l = parseLiquidacion(text, c.env.CUIT_PROPIO);
  if (l.advertencias.length) return c.json({ ok: false, advertencias: l.advertencias, leido: l }, 422);
  const r = await c.env.DB.prepare(`INSERT OR IGNORE INTO liquidaciones_granos
    (coe,fecha,tipo_operacion,comprador_cuit,comprador_nombre,grano,grado,kg,precio_kg,subtotal,iva,iva_alicuota,
     comision,comision_iva,sellos,registro,deducciones_total,ret_ganancias,ret_iva,total_operacion,neto_a_pagar,
     pago_segun_condiciones,fecha_cobro,ubicacion) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(l.coe, l.fecha, l.tipo_operacion, l.comprador_cuit, l.comprador_nombre, l.grano, l.grado, l.kg, l.precio_kg,
      l.subtotal, l.iva, l.iva_alicuota, l.comision, l.comision_iva, l.sellos, l.registro, l.deducciones_total,
      l.ret_ganancias, l.ret_iva, l.total_operacion, l.neto_a_pagar, l.pago_segun_condiciones,
      fecha_cobro ?? null, ubicacion ?? null).run();
  return c.json({ ok: true, duplicada: (r.meta.changes ?? 0) === 0, liquidacion: l });
});

// ---------- Clasificación (pantalla de revisión) ----------
app.get('/api/comprobantes', async c => {
  const [d, h] = rango(anioQ(c.req.query('anio')));
  const solo = c.req.query('sin_clasificar') === '1' ? 'AND deducible IS NULL' : '';
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM comprobantes WHERE fecha BETWEEN ? AND ? ${solo} ORDER BY fecha`).bind(d, h).all();
  return c.json(results);
});

app.patch('/api/comprobantes/:id', async c => {
  const b = await c.req.json<{ categoria_id?: number; deducible?: boolean; fecha_pago?: string | null; notas?: string }>();
  await c.env.DB.prepare(`UPDATE comprobantes SET categoria_id=COALESCE(?,categoria_id),
    deducible=COALESCE(?,deducible), fecha_pago=COALESCE(?,fecha_pago), notas=COALESCE(?,notas) WHERE id=?`)
    .bind(b.categoria_id ?? null, b.deducible === undefined ? null : Number(b.deducible),
      b.fecha_pago ?? null, b.notas ?? null, c.req.param('id')).run();
  return c.json({ ok: true });
});

app.get('/api/liquidaciones', async c => {
  const [d, h] = rango(anioQ(c.req.query('anio')));
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM liquidaciones_granos WHERE fecha BETWEEN ? AND ? ORDER BY fecha`).bind(d, h).all();
  return c.json(results);
});

app.get('/api/categorias', async c => c.json((await c.env.DB.prepare('SELECT id,nombre,tratamiento FROM categorias ORDER BY id').all()).results));

app.patch('/api/liquidaciones/:id', async c => {
  const b = await c.req.json<{ fecha_cobro?: string | null; ubicacion?: string | null }>();
  await c.env.DB.prepare('UPDATE liquidaciones_granos SET fecha_cobro=?, ubicacion=COALESCE(?,ubicacion) WHERE id=?')
    .bind(b.fecha_cobro || null, b.ubicacion ?? null, c.req.param('id')).run();
  return c.json({ ok: true });
});

// ---------- Parámetros fiscales por año ----------
app.put('/api/parametros/:anio/:clave', async c => {
  const valor = await c.req.json();
  await c.env.DB.prepare(`INSERT INTO parametros_fiscales (anio,clave,valor_json,fuente) VALUES (?,?,?,?)
    ON CONFLICT(anio,clave) DO UPDATE SET valor_json=excluded.valor_json, fuente=excluded.fuente`)
    .bind(Number(c.req.param('anio')), c.req.param('clave'), JSON.stringify(valor.valor ?? valor), valor.fuente ?? null).run();
  return c.json({ ok: true });
});

// ---------- Existencias: inicial + producción − ventas = final ----------
app.get('/api/existencias', async c => {
  const anio = anioQ(c.req.query('anio'));
  const [d, h] = rango(anio);
  const { results: ex } = await c.env.DB.prepare(
    `SELECT cultivo, concepto, SUM(kg) kg FROM existencias WHERE anio=? GROUP BY cultivo, concepto`).bind(anio).all<any>();
  const { results: ve } = await c.env.DB.prepare(
    `SELECT grano cultivo, SUM(kg) kg FROM liquidaciones_granos WHERE fecha BETWEEN ? AND ? GROUP BY grano`).bind(d, h).all<any>();
  const cult = new Set([...ex.map(e => e.cultivo), ...ve.map(v => v.cultivo)]);
  return c.json([...cult].map(k => {
    const s = (t: string) => ex.filter(e => e.cultivo === k && e.concepto === t).reduce((a, e) => a + e.kg, 0);
    const ventas = ve.find(v => v.cultivo === k)?.kg ?? 0;
    return { cultivo: k, inicial: s('inicial'), produccion: s('produccion'), ajuste: s('ajuste'), ventas,
      final: s('inicial') + s('produccion') + s('ajuste') - ventas };
  }));
});

// ---------- Resumen y simulación ----------
async function armarEntrada(db: D1Database, anio: number): Promise<{ entrada: EntradaGanancias; detalle: Record<string, number> }> {
  const [d, h] = rango(anio);
  const one = async (sql: string, ...p: unknown[]) => (await db.prepare(sql).bind(...p).first<{ v: number | null }>())?.v ?? 0;
  const par = async (k: string, def?: unknown) => {
    const r = await db.prepare('SELECT valor_json v FROM parametros_fiscales WHERE anio=? AND clave=?').bind(anio, k).first<{ v: string }>();
    if (!r) { if (def !== undefined) return def; throw new Error(`Falta el parámetro fiscal "${k}" del año ${anio}`); }
    return JSON.parse(r.v);
  };
  // Ingresos: ventas COBRADAS en el año (percibido), sin IVA
  const ingresos3ra = await one(`SELECT SUM(subtotal) v FROM liquidaciones_granos WHERE fecha_cobro BETWEEN ? AND ?`, d, h);
  // Gastos: comprobantes clasificados como deducibles y PAGADOS en el año, sin IVA (RI: IVA es crédito fiscal)
  const gastosComp = await one(`SELECT SUM(c.neto_ars) v FROM comprobantes c JOIN categorias k ON k.id=c.categoria_id
    WHERE c.deducible=1 AND k.tratamiento='gasto_deducible' AND c.fecha_pago BETWEEN ? AND ?`, d, h);
  // Gastos propios de la liquidación (comisión, sellos, registro) de las ventas cobradas
  const gastosLiq = await one(`SELECT SUM(comision+sellos+registro) v FROM liquidaciones_granos WHERE fecha_cobro BETWEEN ? AND ?`, d, h);
  // Amortización lineal simple (a validar con el contador)
  const amortizaciones = await one(`SELECT SUM(valor_origen/vida_util_anios) v FROM bienes_uso
    WHERE CAST(substr(fecha_alta,1,4) AS INT) <= ? AND CAST(substr(fecha_alta,1,4) AS INT) + vida_util_anios > ?`, anio, anio);
  const retGan = await one(`SELECT SUM(ret_ganancias) v FROM liquidaciones_granos WHERE fecha_cobro BETWEEN ? AND ?`, d, h);
  const otrosPagos = await one(`SELECT SUM(monto) v FROM pagos_a_cuenta WHERE anio=?`, anio);
  const entrada: EntradaGanancias = {
    ingresos3ra, gastos3ra: gastosComp + gastosLiq, amortizaciones,
    ingresos1ra: await par('ingresos1ra', 0) as number, gastos1ra: await par('gastos1ra', 0) as number,
    quebrantosAnteriores: await par('quebrantos_anteriores', 0) as number,
    deduccionesPersonales: await par('deducciones_personales') as number,
    pagosACuenta: retGan + otrosPagos, escala: await par('escala') as any,
  };
  return { entrada, detalle: { gastosComprobantes: gastosComp, gastosLiquidaciones: gastosLiq, retencionesGanancias: retGan } };
}

app.get('/api/resumen', async c => {
  const anio = anioQ(c.req.query('anio'));
  const { entrada, detalle } = await armarEntrada(c.env.DB, anio);
  const sinClasificar = await c.env.DB.prepare(
    `SELECT COUNT(*) n FROM comprobantes WHERE deducible IS NULL AND fecha BETWEEN ? AND ?`).bind(...rango(anio)).first<{ n: number }>();
  return c.json({ anio, entrada, detalle, resultado: calcularGanancias(entrada), comprobantesSinClasificar: sinClasificar?.n ?? 0 });
});

app.post('/api/simular', async c => {
  const anio = anioQ(c.req.query('anio'));
  const ajustes = await c.req.json();
  const { entrada } = await armarEntrada(c.env.DB, anio);
  return c.json(simular(entrada, ajustes));
});

// ---------- Motor anual (v0.3) ----------
async function entradaAnual(db: D1Database, anio: number): Promise<{ e: Entrada; p: Parametros }> {
  const [d, h] = rango(anio);
  const one = async (sql: string, ...b: unknown[]) => (await db.prepare(sql).bind(...b).first<{ v: number | null }>())?.v ?? 0;
  const pr = await db.prepare("SELECT valor_json v FROM parametros_fiscales WHERE anio=? AND clave='tablas'").bind(anio).first<{ v: string }>();
  const p: Parametros | null = pr ? JSON.parse(pr.v) : anio === 2026 ? P2026 : null;
  if (!p) throw new Error(`Faltan las tablas fiscales ${anio} (clave "tablas" en parametros_fiscales)`);
  const cfg = await db.prepare('SELECT * FROM config_personal WHERE anio=?').bind(anio).first<any>();
  const a = (await db.prepare('SELECT * FROM ajustes_anuales WHERE anio=?').bind(anio).first<any>()) ?? {};
  const gen = (await db.prepare('SELECT concepto, SUM(monto) m FROM deducciones_generales WHERE anio=? GROUP BY concepto').bind(anio).all<any>()).results;
  const ing = await one('SELECT SUM(subtotal) v FROM liquidaciones_granos WHERE fecha_cobro BETWEEN ? AND ?', d, h);
  const gLiq = await one('SELECT SUM(comision+sellos+registro) v FROM liquidaciones_granos WHERE fecha_cobro BETWEEN ? AND ?', d, h);
  const gComp = await one(`SELECT SUM(c.neto_ars*c.pct_afectado/100) v FROM comprobantes c JOIN categorias k ON k.id=c.categoria_id
    WHERE c.deducible=1 AND k.tratamiento='gasto_deducible' AND COALESCE(c.categoria_ganancias,3)=3 AND c.fecha_pago BETWEEN ? AND ?`, d, h);
  const amort = await one(`SELECT SUM(valor_origen/vida_util_anios*pct_afectado/100) v FROM bienes_uso
    WHERE CAST(substr(fecha_alta,1,4) AS INT)<=? AND CAST(substr(fecha_alta,1,4) AS INT)+vida_util_anios>?
    AND (fecha_baja IS NULL OR CAST(substr(fecha_baja,1,4) AS INT)>=?)`, anio, anio, anio);
  const queb = await one('SELECT SUM(monto-usado) v FROM quebrantos WHERE categoria=3 AND anio_origen BETWEEN ? AND ?', anio - 5, anio - 1);
  const ret = await one('SELECT SUM(ret_ganancias) v FROM liquidaciones_granos WHERE fecha_cobro BETWEEN ? AND ?', d, h);
  const e: Entrada = {
    c3: { ingresos: ing, gastos: gLiq + gComp, amortizaciones: amort, ajusteExistencias: a.ajuste_existencias ?? 0, ajusteInflacion: a.ajuste_inflacion ?? 0, quebrantos: queb },
    c1: { ingresos: a.ingresos_1ra ?? 0, gastos: a.gastos_1ra ?? 0, presuncionPct: a.presuncion_1ra_pct ?? undefined },
    c2: a.neto_2da ?? 0, c4: a.neto_4ta ?? 0,
    generales: Object.fromEntries(gen.map((g: any) => [g.concepto, g.m])),
    personales: { conyuge: !!cfg?.conyuge, hijos: cfg?.hijos ?? 0, hijosIncap: cfg?.hijos_incapacitados ?? 0, dedEspecial: cfg?.ded_especial ?? 'ninguna' },
    cedular: a.cedular ?? 0,
    pagos: { retenciones: ret, anticipos: a.anticipos ?? 0, debCred: a.deb_cred ?? 0, saldoFavor: a.saldo_favor ?? 0 },
  };
  return { e, p };
}

app.get('/api/anual', async c => {
  const anio = anioQ(c.req.query('anio'));
  const { e, p } = await entradaAnual(c.env.DB, anio);
  const sc = await c.env.DB.prepare('SELECT COUNT(*) n FROM comprobantes WHERE deducible IS NULL AND fecha BETWEEN ? AND ?').bind(...rango(anio)).first<{ n: number }>();
  return c.json({ entrada: e, resultado: calcularAnual(e, p), sinClasificar: sc?.n ?? 0 });
});

app.post('/api/anual/simular', async c => {
  const anio = anioQ(c.req.query('anio'));
  const b = await c.req.json<{ ingresos3ra?: number; gastos3ra?: number }>();
  const { e, p } = await entradaAnual(c.env.DB, anio);
  const s = structuredClone(e);
  s.c3.ingresos += Number(b.ingresos3ra) || 0; s.c3.gastos += Number(b.gastos3ra) || 0;
  return c.json({ real: calcularAnual(e, p), simulado: calcularAnual(s, p) });
});

app.get('/api/config/:anio', async c => {
  const anio = anioQ(c.req.param('anio')), db = c.env.DB;
  const cfg = await db.prepare('SELECT * FROM config_personal WHERE anio=?').bind(anio).first();
  const aj = await db.prepare('SELECT * FROM ajustes_anuales WHERE anio=?').bind(anio).first();
  const gen = (await db.prepare('SELECT concepto, SUM(monto) m FROM deducciones_generales WHERE anio=? GROUP BY concepto').bind(anio).all<any>()).results;
  const q = await db.prepare('SELECT SUM(monto) v FROM quebrantos WHERE anio_origen=? AND categoria=3').bind(anio - 1).first<{ v: number | null }>();
  return c.json({ cfg, aj, generales: Object.fromEntries(gen.map((g: any) => [g.concepto, g.m])), quebrantos: q?.v ?? 0 });
});

app.put('/api/config/:anio', async c => {
  const anio = anioQ(c.req.param('anio')), db = c.env.DB, n = (v: unknown) => Number(v) || 0;
  const b = await c.req.json<any>();
  const ded = ['ninguna', 'ap1', 'ap1Nuevos', 'ap2'].includes(b.cfg?.ded_especial) ? b.cfg.ded_especial : 'ninguna';
  const j = b.aj ?? {};
  const st = [
    db.prepare('INSERT OR REPLACE INTO config_personal (anio,conyuge,hijos,hijos_incapacitados,ded_especial) VALUES (?,?,?,?,?)')
      .bind(anio, b.cfg?.conyuge ? 1 : 0, n(b.cfg?.hijos), n(b.cfg?.hijos_incapacitados), ded),
    db.prepare(`INSERT OR REPLACE INTO ajustes_anuales (anio,ajuste_existencias,ajuste_inflacion,ingresos_1ra,gastos_1ra,presuncion_1ra_pct,
      neto_2da,neto_4ta,cedular,anticipos,deb_cred,saldo_favor) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(anio, n(j.ajuste_existencias), n(j.ajuste_inflacion), n(j.ingresos_1ra), n(j.gastos_1ra),
        j.presuncion_1ra_pct === '' || j.presuncion_1ra_pct == null ? null : n(j.presuncion_1ra_pct),
        n(j.neto_2da), n(j.neto_4ta), n(j.cedular), n(j.anticipos), n(j.deb_cred), n(j.saldo_favor)),
    db.prepare('DELETE FROM deducciones_generales WHERE anio=?').bind(anio),
    db.prepare('DELETE FROM quebrantos WHERE anio_origen=? AND categoria=3').bind(anio - 1),
  ];
  for (const [k, v] of Object.entries(b.generales ?? {}))
    if (n(v) > 0) st.push(db.prepare('INSERT INTO deducciones_generales (anio,concepto,monto) VALUES (?,?,?)').bind(anio, k, n(v)));
  if (n(b.quebrantos) > 0) st.push(db.prepare('INSERT INTO quebrantos (anio_origen,categoria,monto) VALUES (?,3,?)').bind(anio - 1, n(b.quebrantos)));
  await db.batch(st);
  return c.json({ ok: true });
});

app.onError((e, c) => c.json({ error: e.message }, 400));
export default app;
