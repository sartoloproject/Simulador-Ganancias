-- Simulador de Ganancias - esquema inicial (D1 / SQLite)
-- Año fiscal: enero-diciembre. Criterio: percibido.
-- Convención: fechas ISO (YYYY-MM-DD); importes en pesos (ARS) salvo indicación.

CREATE TABLE categorias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE,
  tratamiento TEXT NOT NULL CHECK (tratamiento IN
    ('gasto_deducible','gasto_no_deducible','bien_uso','ingreso_3ra','ingreso_1ra','renta_financiera','pago_a_cuenta','personal'))
);

-- Comprobantes recibidos (export "Mis Comprobantes Recibidos" de ARCA)
CREATE TABLE comprobantes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cae TEXT NOT NULL UNIQUE,
  fecha TEXT NOT NULL,
  tipo_codigo INTEGER NOT NULL,
  tipo_desc TEXT NOT NULL,
  punto_venta INTEGER, numero INTEGER,
  emisor_cuit TEXT NOT NULL, emisor_nombre TEXT NOT NULL,
  moneda TEXT NOT NULL DEFAULT 'ARS', tipo_cambio REAL NOT NULL DEFAULT 1,
  neto_gravado REAL NOT NULL DEFAULT 0, neto_no_gravado REAL NOT NULL DEFAULT 0,
  exento REAL NOT NULL DEFAULT 0, otros_tributos REAL NOT NULL DEFAULT 0,
  iva REAL NOT NULL DEFAULT 0, total REAL NOT NULL,
  signo INTEGER NOT NULL DEFAULT 1,
  total_ars REAL NOT NULL,
  neto_ars REAL NOT NULL,
  categoria_id INTEGER REFERENCES categorias(id),
  deducible INTEGER,
  fecha_pago TEXT,
  notas TEXT
);
CREATE INDEX idx_comp_fecha ON comprobantes(fecha);
CREATE INDEX idx_comp_pago ON comprobantes(fecha_pago);

-- Liquidaciones primarias de granos (ventas)
CREATE TABLE liquidaciones_granos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  coe TEXT NOT NULL UNIQUE,
  fecha TEXT NOT NULL,
  tipo_operacion TEXT,
  comprador_cuit TEXT, comprador_nombre TEXT,
  grano TEXT NOT NULL, grado TEXT,
  kg REAL NOT NULL, precio_kg REAL NOT NULL,
  subtotal REAL NOT NULL,
  iva REAL NOT NULL, iva_alicuota REAL,
  comision REAL NOT NULL DEFAULT 0, comision_iva REAL NOT NULL DEFAULT 0,
  sellos REAL NOT NULL DEFAULT 0, registro REAL NOT NULL DEFAULT 0,
  deducciones_total REAL NOT NULL DEFAULT 0,
  ret_ganancias REAL NOT NULL DEFAULT 0, ret_iva REAL NOT NULL DEFAULT 0,
  total_operacion REAL NOT NULL, neto_a_pagar REAL, pago_segun_condiciones REAL,
  fecha_cobro TEXT,
  ubicacion TEXT
);
CREATE INDEX idx_liq_cobro ON liquidaciones_granos(fecha_cobro);

-- Existencias de granos (kg): inicial + produccion - ventas = final
CREATE TABLE existencias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anio INTEGER NOT NULL, cultivo TEXT NOT NULL,
  concepto TEXT NOT NULL CHECK (concepto IN ('inicial','produccion','ajuste')),
  lote TEXT, kg REAL NOT NULL, notas TEXT
);

CREATE TABLE bienes_uso (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  descripcion TEXT NOT NULL, fecha_alta TEXT NOT NULL,
  valor_origen REAL NOT NULL, vida_util_anios INTEGER NOT NULL,
  comprobante_id INTEGER REFERENCES comprobantes(id)
);

CREATE TABLE pagos_a_cuenta (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anio INTEGER NOT NULL, concepto TEXT NOT NULL, fecha TEXT, monto REAL NOT NULL
);

-- Parámetros fiscales por año (escala, mínimo no imponible, deducciones). NO van en el código.
CREATE TABLE parametros_fiscales (
  anio INTEGER NOT NULL, clave TEXT NOT NULL, valor_json TEXT NOT NULL, fuente TEXT,
  PRIMARY KEY (anio, clave)
);

CREATE TABLE escenarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anio INTEGER NOT NULL, nombre TEXT NOT NULL,
  ajustes_json TEXT NOT NULL,
  creado TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO categorias (nombre, tratamiento) VALUES
 ('Insumos (semillas, agroquímicos, fertilizantes)','gasto_deducible'),
 ('Combustible y lubricantes','gasto_deducible'),
 ('Servicios y labores (contratistas, fletes)','gasto_deducible'),
 ('Arrendamientos pagados','gasto_deducible'),
 ('Sueldos y cargas sociales','gasto_deducible'),
 ('Seguros','gasto_deducible'),
 ('Intereses y gastos bancarios','gasto_deducible'),
 ('Honorarios profesionales','gasto_deducible'),
 ('Reparaciones y mantenimiento','gasto_deducible'),
 ('Bienes de uso (maquinaria, rodados)','bien_uso'),
 ('Gastos personales','personal'),
 ('Otros no deducibles','gasto_no_deducible'),
 ('Venta de granos','ingreso_3ra'),
 ('Arrendamientos cobrados (campos propios)','ingreso_1ra'),
 ('Retenciones y anticipos de Ganancias','pago_a_cuenta');
