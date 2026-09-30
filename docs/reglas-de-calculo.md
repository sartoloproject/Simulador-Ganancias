# Reglas de cálculo (para validar con el contador)

Año fiscal enero–diciembre. Criterio: **percibido**.

| Concepto | Regla implementada | A validar |
|---|---|---|
| Ingreso por venta de granos | Subtotal sin IVA de la liquidación, en el año de `fecha_cobro` | Fecha de cobro vs. fecha de liquidación |
| Gastos de la liquidación | Comisión (sin IVA), sellos y derecho de registro, en el año del cobro | — |
| Gastos por comprobantes | Neto sin IVA, si está clasificado como deducible y en el año de `fecha_pago` (IVA = crédito fiscal, Responsable Inscripto) | Criterio para gastos pagados con tarjeta |
| Amortizaciones | Lineal simple: valor de origen / vida útil | Método real, amortización acelerada, año de alta, ajuste por inflación |
| Arrendamientos cobrados (1ª categoría) | Parámetro manual `ingresos1ra` / `gastos1ra` | Deducción real vs. presunta |
| Quebrantos | Se compensan solo contra 3ª categoría | Vencimiento (5 años) |
| Pagos a cuenta | Retención de Ganancias de las liquidaciones cobradas + tabla `pagos_a_cuenta` | Impuesto a los créditos y débitos, anticipos |
| Existencias | Solo control físico en kg (inicial + producción − ventas) | Si se valúan para el cálculo |
| Escala y deducciones personales | Tablas `parametros_fiscales` del año: **hay que cargarlas** desde ARCA | Valores vigentes |

**No incluido todavía:** rentas financieras (FCI, intereses), ajuste por inflación impositivo, diferencias de cambio,
movimientos con sociedades.
