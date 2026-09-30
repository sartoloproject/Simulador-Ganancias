# Simulador de Ganancias (persona física agropecuaria)

Carga de ventas de granos y comprobantes, y simulación del impuesto a las ganancias por **año fiscal (enero–diciembre)**, criterio **percibido**.
Stack: GitHub + Cloudflare Workers (API, Hono) + D1 (SQLite). Frontend (Cloudflare Pages): pendiente, próxima etapa.

## Estado
- [x] Esquema de base de datos (`db/migrations`)
- [x] Importador de **Mis Comprobantes Recibidos** (Excel ARCA)
- [x] Importador de **Liquidación Primaria de Granos** (texto del PDF)
- [x] Motor de cálculo con escala parametrizada + simulador de escenarios
- [x] API (`apps/api/src/index.ts`)
- [ ] Frontend: carga de archivos, pantalla de clasificación, resumen y simulador
- [ ] Importador de facturas de bienes de uso, amortizaciones, rentas financieras

## Puesta en marcha
```bash
npm install
cd apps/api
npx wrangler login
npx wrangler d1 create simulador-ganancias      # copiar el database_id en wrangler.toml
# editar wrangler.toml: database_id y CUIT_PROPIO
npx wrangler d1 migrations apply simulador-ganancias --remote
npx wrangler deploy
```
**Protegé la API** con Cloudflare Access (Zero Trust → Access → Applications) antes de cargar datos reales.

## Parámetros fiscales (obligatorio antes de simular)
La escala y las deducciones personales **no están en el código**. Cargalas por año desde ARCA:
```bash
curl -X PUT https://TU-WORKER/api/parametros/2026/escala -H 'content-type: application/json' \
 -d '{"valor":[{"desde":0,"hasta":1000000,"fijo":0,"porcentaje":5}, ...], "fuente":"ARCA 2026"}'
curl -X PUT https://TU-WORKER/api/parametros/2026/deducciones_personales -H 'content-type: application/json' -d '{"valor": 0}'
```
Opcionales: `ingresos1ra`, `gastos1ra`, `quebrantos_anteriores`.

## Tests
```bash
FIXTURES=/ruta/a/muestras npm test
```
Los archivos reales (Excel, PDF) **no se versionan**: contienen datos personales. Los tests de parsers se saltean si no hay `FIXTURES`.
Ver `docs/reglas-de-calculo.md`: lo que hay que validar con el contador.
