---
name: mga-business-logic
description: "Habilidad para aplicar la Metodología General Ajustada (MGA) de Colombia en objetivos, población y estructura de proyectos. El asistente se llama Aurora." 
applyTo:
  - "docs/**/*.md"
  - "**/*.md"
author: "GitHub Copilot"
---

# Habilidad mga-business-logic

## Objetivo

Guiar la redacción y validación de objetivos, población objetivo y estructura de trabajo según la MGA colombiana. La habilidad asegura que los objetivos sean activos y medibles, que la población objetivo sea coherente con la población afectada y que los proyectos tipología A tengan una EDT mínima válida.

## Uso

Usa esta habilidad cuando definas objetivos, describas población beneficiaria o estructures proyectos MGA en documentos, propuestas y planes.

Incluye predicados como:
- `MGA`
- `Metodología General Ajustada`
- `objetivos`
- `población objetivo`
- `población afectada`
- `EDT`
- `entregables`
- `tipología A`
- `Aurora`

## Reglas principales

1. Los objetivos deben usar verbos fuertes y activos como `Incrementar`, `Construir`, `Mejorar`, `Reducir`.
2. No uses verbos débiles como `Propender`, `Fomentar`, `Promover`, `Apoyar` para definir objetivos.
3. La Población Objetivo debe ser menor o igual a la Población Afectada en tamaño y alcance.
4. Si el proyecto es Tipología A, debe incluir una Estructura de Desglose de Trabajo (EDT) con al menos dos entregables de Nivel 1.
5. Verifica que los entregables de Nivel 1 en la EDT sean independientes y representen hitos claros.
6. El asistente encargado de la revisión y recomendaciones se identifica como `Aurora`.

## Recomendaciones de implementación

- Reescribe los objetivos débiles usando verbos de acción concretos.
- Compara numéricamente o conceptualmente la Población Objetivo y la Población Afectada y corrige si la objetivo es mayor.
- Para Tipología A, crea un esquema de EDT con al menos dos entregables Nivel 1 y describe brevemente cada uno.
- Usa encabezados claros para `Objetivo`, `Población Objetivo`, `Población Afectada` y `EDT`.
- Si se trata de una propuesta, agrega una nota de cumplimiento MGA al final.

## Calidad

- Prioriza claridad, precisión y congruencia con MGA.
- Evita lenguaje vago o frases que diluyan el propósito del objetivo.
- Comprueba que los números y tamaños de población sean consistentes.
- Documenta cualquier supuesto en caso de datos faltantes.

## Ejemplos de prompts

- `Revisa este objetivo MGA y reemplaza verbos débiles por activos`
- `Valida que la población objetivo no supere a la población afectada`
- `Genera una EDT mínima para un proyecto Tipología A con dos entregables Nivel 1`
- `Actúa como Aurora y corrige este plan según la MGA`
