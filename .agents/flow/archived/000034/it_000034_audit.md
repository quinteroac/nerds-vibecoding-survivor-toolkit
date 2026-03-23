# Audit — Iteration 000034: Migrate CLI from Custom Arg Parser to commander.js

## 1. Executive Summary

La migración de la iteración 34 está **funcionalmente completa**: los 137 tests automatizados pasan sin regresiones, `commander` está instalado como dependencia de producción, todos los comandos CLI se comportan igual que antes, los helpers legados (`extractFlagValue`, `parseOptionalIntegerFlag`, `parseProjectContextMode`, `parseForce`, `printUsage`) fueron eliminados, y el help auto-generado funciona tanto a nivel raíz como por comando/subcomando.

Sin embargo, la implementación adoptó un enfoque **híbrido**: commander.js se usa exclusivamente para generar texto de ayuda via `buildHelpProgram()`, mientras que el dispatch real y el parsing de opciones siguen siendo manuales (bloques `if (command === ...)` con `args.includes()` / `indexOf()`). Esto satisface los objetivos observables por el usuario pero diverge de varios FRs que requirieron explícitamente que commander.js controlara el pipeline de parsing.

---

## 2. Verification by FR

| FR | Assessment | Notes |
|----|-----------|-------|
| FR-1 | **comply** | `commander ^14.0.3` en `package.json` como dependencia de producción. |
| FR-2 | **partially_comply** | Los comandos están registrados en commander como subcomandos, pero sin `.action()` — el dispatch lo hace un `if/else` manual en `main()`. |
| FR-3 | **partially_comply** | `--agent` aparece en el help tree, pero la validación (choices) la sigue haciendo `parseAgentArg()` de `src/agent.ts`. |
| FR-4 | **partially_comply** | `--force` registrado en el help program, pero el runtime usa `args.includes('--force')`. |
| FR-5 | **partially_comply** | `--challenge` registrado en el help program, parseado manualmente con `args.includes('--challenge')`. |
| FR-6 | **partially_comply** | `--iterations` y `--retry-on-fail` registrados en help. La validación (≥1/≥0) se hace inline con `indexOf` + `Number()`, no con `.argParser()`. |
| FR-7 | **partially_comply** | `--mode` registrado sin `.choices()`. Validación inline en lugar de choices enforcement de commander. |
| FR-8 | **comply** | `--clean` registrado y manejado correctamente en `destroy`. |
| FR-9 | **comply** | `--schema`, `--out`, `--data` registrados en `write-json`; stdin fallback preservado en el handler. |
| FR-10 | **comply** | `--out`, `--data` registrados en `write-technical-debt`; stdin fallback preservado. |
| FR-11 | **partially_comply** | Version manejada manualmente (`if command === '-v'`); no se usa `.version()` de commander. |
| FR-12 | **comply** | Comandos desconocidos imprimen error y setean `process.exitCode = 1` (no `process.exit()`). |
| FR-13 | **comply** | `GuardrailAbortError` capturado en `.catch()` top-level sin re-logging. |

---

## 3. Verification by US

| US | Assessment | Notes |
|----|-----------|-------|
| US-001 | **comply** | `bun nvst --help` y `-h` salen con código 0, muestran todos los comandos requeridos generados por commander. |
| US-002 | **comply** | `bun nvst create prototype --help` lista `--agent`, `--iterations`, `--retry-on-fail`, `--stop-on-critical`, `--force`; todos los comandos responden a `--help`. |
| US-003 | **comply** | 137/137 tests pasan incluyendo el test de compatibilidad de comandos `us-003-command-compatibility.test.ts`. |
| US-004 | **comply** | `extractFlagValue`, `parseOptionalIntegerFlag`, `parseProjectContextMode`, `parseForce`, `printUsage` eliminados de `src/cli.ts`. No hay imports a estas funciones en ningún otro archivo. |
| US-005 | **comply** | `bun test` → 137 pass / 0 fail / 528 `expect()` calls. Ningún test file fue debilitado. |

---

## 4. Minor Observations

1. **FR-2 (parcial):** `buildHelpProgram()` instancia un root `Command` con todos los subcomandos registrados — pero sin handlers `.action()`. Commander no ejecuta el dispatch; lo hace el `if/else` manual en `main()`.

2. **FR-3 (parcial):** `--agent` está en el help tree descrito correctamente, pero la validación de valores permitidos (`claude | codex | gemini | cursor | copilot | ide`) la sigue resolviendo `parseAgentArg()` — no el sistema de choices de commander.

3. **FR-4 / FR-5 (parcial):** `--force` y `--challenge` están en el help program pero en runtime se parsean con `args.includes()` simple, no con opciones de commander.

4. **FR-6 (parcial):** La lógica de `--iterations` (int ≥ 1) y `--retry-on-fail` (int ≥ 0) está reimplementada inline como `indexOf() + Number()`. El PRD requería `.argParser()` en la opción de commander.

5. **FR-7 (parcial):** `--mode` registrado sin `.choices(['strict', 'yolo'])`. La validación es `if (modeVal !== 'strict' && modeVal !== 'yolo')` inline.

6. **FR-9 / FR-10 (comply):** Los handlers de `write-json` y `write-technical-debt` reciben `args` raw y hacen su propio parsing. El comportamiento funcional es correcto y el stdin fallback está preservado.

7. **FR-11 (parcial):** El version flag usa `if (command === '-v' || command === '--version')` manual en lugar de `program.version()` de commander con la lógica de fallback `NVST_COMPILED_VERSION`.

8. **Overhead mínimo:** `buildHelpProgram()` se invoca en cada ruta de error (unknown command) además de para help. No tiene impacto funcional pero es ineficiente si hay muchos errores de usuario.

9. **Sin regresiones:** `bun test` → 137 pass / 0 fail.

---

## 5. Conclusions and Recommendations

Todos los user stories fueron cumplidos desde la perspectiva del usuario final: el help es auto-generado, el help por subcomando funciona, los comandos se comportan igual, los helpers legacy fueron borrados y la suite de tests está verde.

**El gap es arquitectónico**: siete FRs (FR-2 a FR-7, FR-11) pedían que commander.js controlara el parsing en runtime —no solo la generación de help. El enfoque híbrido actual conserva el dispatch manual, por lo que el problema de mantenimiento original (boilerplate por comando) sigue presente en `main()`.

**Recomendación:** Completar la migración reemplazando el `buildHelpProgram()` + dispatch manual por un único `program` con `.action()` callbacks en cada subcomando, `.argParser()` para `--iterations` / `--retry-on-fail`, `.choices()` para `--mode`, y `.version()` para la versión. Esto alinearía la implementación con los goals del PRD y reduciría el costo de mantenimiento futuro.

---

## 6. Refactor Plan

### Objetivo
Completar la migración a commander.js para que sea el motor real de parsing, no solo el generador de help.

### Cambios propuestos

1. **Consolidar en un solo `program`** — Eliminar `buildHelpProgram()` y el dispatch `if/else` en `main()`. Registrar `.action()` handlers directamente en cada subcomando commander.

2. **FR-3 — Reemplazar `parseAgentArg` con choices de commander** — Usar `.requiredOption('--agent <provider>')` + `.addHelpText()` o `.choices(['claude','codex','gemini','cursor','copilot','ide'])` en cada subcomando agent-backed.

3. **FR-6 — Usar `.argParser()` para `--iterations` y `--retry-on-fail`** — Mover la lógica de validación (int ≥ 1 / int ≥ 0) a parsers de commander en lugar de código inline.

4. **FR-7 — Usar `.choices()` para `--mode`** — `.addOption(new Option('--mode <strict|yolo>', '...').choices(['strict','yolo']))`.

5. **FR-11 — Usar `.version()` de commander** — `program.version(resolvedVersion, '-v, --version')` donde `resolvedVersion` aplica la lógica `NVST_COMPILED_VERSION` antes de configurar el programa.

6. **FR-4 / FR-5 — Opciones booleanas via commander** — Los valores de `--force` y `--challenge` se obtienen desde el objeto `options` del action handler, eliminando `args.includes()`.

7. **Cleanup** — Eliminar `findCommand()` una vez que `buildHelpProgram()` desaparezca.

### Archivos afectados
- `src/cli.ts` — reescritura de la función `main()` y eliminación de `buildHelpProgram()` / `findCommand()`.
- `src/agent.ts` — `parseAgentArg` puede volverse innecesario o reducirse a documentación interna.
- Tests: sin cambios esperados (los tests de integración ya validan comportamiento externo).
