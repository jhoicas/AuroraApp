---
name: react-a11y-ui
description: "Habilidad para desarrollar interfaces React/TypeScript/Vite con Tailwind y Zustand, enfocadas en accesibilidad para funcionarios públicos y adultos mayores. Usa paleta cálida, alto contraste legible sin blanco/negro puro, feedback visual inmediato y lucide-react para iconos." 
applyTo:
  - "starter/frontend/src/**/*.{ts,tsx}"
  - "starter/frontend/src/**/*.{css,ts}"
author: "GitHub Copilot"
---

# Habilidad react-a11y-ui

## Objetivo

Guiar el desarrollo UI del frontend con React, TypeScript, Vite, Tailwind CSS y Zustand para una experiencia inclusiva de funcionarios públicos y adultos mayores. Garantiza accesibilidad, uso de una paleta cálida, retroalimentación visual inmediata y componentes UI confiables.

## Uso

Usa esta habilidad cuando implementes interfaces, formularios, paneles de navegación o componentes de estado en el frontend de la aplicación.

Incluye predicados como:
- `accesibilidad`
- `a11y`
- `React`
- `TypeScript`
- `Vite`
- `Tailwind`
- `Zustand`
- `lucide-react`
- `usabilidad`
- `adultos mayores`
- `funcionarios públicos`
- `feedback inmediato`

## Reglas principales

1. Prohíbe texto de color `#000000` o `#ffffff` en elementos de contenido; usa tonos como `text-slate-800`, `text-slate-900`, `bg-stone-50` y `teal-700` para acentos.
2. El fondo base debe ser cálido y suave, preferiblemente `bg-stone-50` u otros tonos cercanos al beige claro.
3. Asegura contraste suficiente y legibilidad sin usar blanco/negro puros.
4. Proporciona feedback visual inmediato para interacciones lentas: botones con estados `loading`, spinners amigables y mensajes claros.
5. Usa iconos de `lucide-react` para señalar acciones, estados y confirmaciones.
6. Mantén flujos simples, con tamaños de touch grandes, espaciado generoso y lenguaje directo.
7. Garantiza foco visible, etiquetas claras y soporte de teclado para todos los controles.

## Recomendaciones de implementación

- Define temas Tailwind consistentes y reusa clases como `bg-stone-50`, `text-slate-800`, `border-slate-300`, `hover:bg-stone-100`, `text-teal-700`.
- Prefiere componentes accesibles listos para teclado y pantalla lectora: `button`, `input`, `label`, `fieldset` y `aria-live` para notificaciones.
- Para estados asíncronos, muestra un spinner amigable con texto como `Cargando…` y un icono de `lucide-react` (`Loader2`, `RefreshCcw` o similar).
- Usa `Zustand` para manejar estado global y estados de carga de forma centralizada.
- Emplea `aria-busy`, `aria-label`, `aria-describedby` y mensajes de error visibles junto al campo.
- Evita toggles visuales que dependan solo de color; añade iconos o texto de estado.
- Asegura que cualquier respuesta de error o confirmación sea inmediata, legible y no cause ansiedad.

## Calidad

- Prioriza componentes pequeños y reutilizables.
- Evita patrones visuales confusos o sobrecargados.
- Asegura que la navegación y las acciones más importantes sean fáciles de encontrar.
- Mantén el código TypeScript con tipos estrictos y hooks limpios.
- Documenta las decisiones de diseño cuando impacten la accesibilidad.

## IA y datos de contexto

- Revisa primero los archivos en `starter/frontend/`, incluyendo componentes existentes, estilos Tailwind y configuración de `vite`.
- Usa la carpeta `docs/` como referencia para objetivos de usabilidad o requerimientos de diseño si existen.
- No cambies el diseño visual sin verificar el contexto actual del proyecto.

## Ejemplos de prompts

- `Crea un formulario accesible para adultos mayores con feedback inmediato y Zustand`
- `Revisa la UI y reemplaza blanco/negro puro con `bg-stone-50`, `text-slate-800` y accents `teal-700``
- `Implementa un spinner amigable con lucide-react y mensaje de carga`
- `Asegura que todos los botones tengan foco visible y sean fáciles de usar con teclado`
