# Logica de negocio MGA

## Arbol de Problemas

Todo proyecto parte de un problema central. El problema se descompone en:

- **Causas:** raices que explican por que ocurre el problema.
- **Efectos:** consecuencias producidas por el problema.
- **Problema central:** situacion negativa, concreta y verificable que el proyecto busca transformar.

Las causas y los efectos deben conservar trazabilidad hacia el problema central. No deben confundirse sintomas, actividades o soluciones con causas.

## Arbol de Objetivos

- El problema central se transforma en el objetivo general.
- Las causas se convierten en objetivos especificos, preferiblemente con verbos activos y medibles.
- Los efectos se convierten en fines o resultados esperados.
- Los indicadores deben medir avance, resultado o producto con unidad de medida, linea base, meta y fuente cuando esos campos existan en el modelo.

Los nombres `mga_specific_objectives` y `mga_indicators` pertenecen al modelo funcional solicitado, pero no estan declarados en `docs/schema.sql` ni `docs/schema-antigravity.sql`. No deben tratarse como tablas existentes sin una migracion oficial.

## Cadena de Valor y alternativas

- Una **alternativa** es una opcion tecnica y operativa para resolver el problema y alcanzar los objetivos.
- La alternativa se traduce en productos y entregables verificables.
- Los entregables se descomponen en actividades mediante la Estructura de Desglose de Trabajo (EDT).
- Cada actividad debe tener alcance, unidad o meta cuando aplique, responsables y costos trazables.
- Los costos se asocian a partidas presupuestales (`budget_items`) solo si esa entidad existe en el esquema vigente.

El esquema disponible verifica catalogos de productos y EDT (`productos`, `edt`, `catalogo_productos`, `catalogo_edt`), pero no verifica tablas transaccionales llamadas `mga_alternatives`, `project_edt_nodes`, `project_deliverables`, `project_activities` o `budget_items`.

## Evaluacion financiera

Toda alternativa debe compararse con criterios financieros y no financieros. La evaluacion financiera puede incluir:

- Flujo de caja de costos y beneficios.
- Valor Presente Neto (VPN).
- Tasa Interna de Retorno (TIR).
- Horizonte, tasa de descuento y supuestos documentados.

`project_evaluations` es el nombre funcional solicitado para persistir estos resultados, pero no aparece en los scripts SQL disponibles. No inventar columnas ni asumir que la evaluacion esta persistida hasta verificar la migracion o el modelo correspondiente.

## BPIN

**BPIN** significa Banco de Programas y Proyectos de Inversion Nacional. Es el codigo unico que identifica un proyecto publico en el banco nacional. En el esquema verificado se representa como `proyectos.codigo_bpin`.

## Poblacion y participantes

- La poblacion afectada recibe el impacto actual del problema.
- La poblacion objetivo es el grupo que el proyecto espera beneficiar y debe ser coherente, en alcance y magnitud, con la poblacion afectada.
- Los participantes son actores que intervienen, se benefician o pueden afectar la ejecucion.

Los nombres funcionales `mga_populations` y `mga_participants` no estan declarados en los scripts SQL disponibles.

## Invariantes para Aurora

1. Un proyecto pertenece a un tenant y nunca debe cruzar su aislamiento.
2. Cada objetivo debe poder relacionarse con el problema, sus causas o sus efectos.
3. Cada producto y entregable debe tener una actividad o justificacion de alcance cuando el diseño lo requiera.
4. Los costos, indicadores y evaluaciones deben ser auditables y trazables a la alternativa.
5. La IA recomienda y valida; la persona autorizada decide y confirma cambios con impacto presupuestal o normativo.
6. Si el esquema real contradice este documento, prevalece la migracion SQL aplicada y se actualiza la documentacion.
