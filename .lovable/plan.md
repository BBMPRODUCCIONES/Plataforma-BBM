

## Analysis of the New "Caja Menor" Structure from Excel

After analyzing the uploaded Excel file and the current codebase, here is what the new structure entails and the plan to implement it.

### What the Excel Defines

The Excel describes a completely redesigned "Caja Menor" section (currently in Panel de Reportes → Reporte de Caja Menor) with these key elements:

**1. Estado de Caja Menor (Dashboard Panel)**
- **Base asignada**: A configurable starting budget (e.g., $2,000,000) — can be increased ("MAS")
- **Total gastos aprobados**: Sum of all expenses with estado "Aprobado"
- **Total gastos pendientes**: Sum of expenses still "Pendiente"
- **Efectivo en caja**: Base asignada minus only approved expenses
- **Cuadre de caja**: Difference/balance indicator
- **Reembolsado**: Amount reimbursed
- **Gasto Caja Menor** (top KPI): Total sum of all approved expenses, broken down by category (CC Operativo, Marketing, Aseo, Insumos Eventos)

**2. Persona Responsable** — Auto-login (same pattern as inventory responsables)

**3. Cierre de Caja** — Two states: "Legalizado" and "Reembolsado"

**4. New Fields per Gasto (expanded from current)**
- Usuario (auto-detected)
- Concepto (obligatorio)
- Centro de Costos — split into two groups:
  - **Eventos**: e.g., "Corferias 20-0004"
  - **Admin**: e.g., "ADMINT 30-0004", "TI 30-0004"
- Categoría — split by center type:
  - **Eventos**: Insumos (was "Compras"), Alimentación, Transporte
  - **Admin**: Aseo, Cafetería, Papelería
- Valor
- Imagen (obligatoria)
- **Nombre del comercio** (new, obligatorio)
- **NIT/CC** (new, obligatorio)

**5. Updated Estados**: Pendiente → Aprobado/No aprobado → Legalizado → Reembolsado

**6. Table Columns**: Fecha, Centro de costo, Concepto, Categoría, Nombre de comercio, NIT, Valor, Imagen, Estado, Aprobado por

**7. Cierre de Caja History Table** (bottom section):
- Fecha de cierre de caja
- Responsable caja
- Valor (sum total)
- Estado
- Desembolsado por
- Cambios de base

---

### Implementation Plan

#### Step 1: Database Migration
Add new columns to `gastos_menores` table:
- `nombre_comercio` (text, nullable)
- `nit_cc` (text, nullable)
- `tipo_centro` (text: 'eventos' or 'admin')

Create new table `caja_menor_config` for persistent state:
- `id`, `base_asignada` (numeric), `responsable_user_id`, `responsable_nombre`, `responsable_timestamp`, `estado_cierre` (text: 'Abierta'/'Legalizado'/'Reembolsado'), `desembolso` (numeric), `desembolsado_por`, `fecha_cierre`, `created_at`, `updated_at`

Create new table `caja_menor_cierres` for cierre history:
- `id`, `fecha_cierre`, `responsable_nombre`, `responsable_user_id`, `valor_total`, `estado`, `desembolsado_por`, `cambios_base`, `created_at`

#### Step 2: Update the Hook (`useGastosMenores`)
- Add the new fields to the `GastoMenor` interface (`nombre_comercio`, `nit_cc`)
- Update categories: split into events-type and admin-type
- Add new estados: "Legalizado", "Reembolsado"

#### Step 3: Create `useCajaMenorConfig` Hook
- Manage base asignada, responsable, cierre state, desembolsos
- Calculate derived values (efectivo en caja, cuadre de caja, totals by category)

#### Step 4: Redesign `GastoMenorDialog`
- Add "Nombre del comercio" and "NIT/CC" fields (both obligatory)
- Make categories dynamic based on selected centro de costos type (Eventos vs Admin)

#### Step 5: Redesign the "Reporte de Caja Menor" View in `PanelReportes`
- **Top section**: Estado de Caja Menor dashboard (base asignada, totals, efectivo en caja, cuadre)
- **Persona responsable**: Auto-login button
- **Cierre de caja**: Legalizado/Reembolsado buttons
- **Middle**: Gastos table with new columns (Nombre comercio, NIT, updated estados)
- **Bottom**: Cierre de caja history table

#### Step 6: Update `CajaMenorEstadoSelect`
- Add "Legalizado" and "Reembolsado" as new estado options

#### Step 7: Update the read-only mirror in PanelOperaciones
- Add the new columns (Nombre comercio, NIT) to the read-only CAJA MENOR table

