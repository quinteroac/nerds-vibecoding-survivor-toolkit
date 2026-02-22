# Fix Requirements (Iteration 000008)

## Root Cause

All 34 test cases show `invocation_failed` because `parseBatchExecutionPayload` fails with **"Agent batch output was not valid JSON"**. The agent returned text + markdown fences + JSON, and `extractJson` failed to parse it correctly.

## Requirements to Fix

### 1. Hacer robusto `extractJson` ante múltiples bloques markdown

**Correlación:** TC-US001-08, bloquea verificación de US-001, US-002, FR-4, FR-5, FR-6

- **REQ-FIX-01:** `extractJson` debe priorizar bloques ` ```json ` cuando existan múltiples fences. Si hay ` ```json [...] ``` ` y luego ` ```bash ... ``` `, extraer solo el contenido del bloque json.
- **REQ-FIX-02:** El fallback "primer ``` a último ```" actualmente incluye texto intermedio (p. ej. "Para obtener resultados...") cuando hay varios bloques. Debe buscarse el bloque ` ```json ` explícitamente antes de caer en ese fallback.
- **REQ-FIX-03:** El fallback de regex `\[[\s\S]*\]` debería capturar el array JSON correcto. Verificar que funcione con output que contenga otros `[` o `]` en strings (p. ej. rutas de archivo).

### 2. Reforzar el contrato del skill execute-test-batch

**Correlación:** Previene futuros fallos de parseo

- **REQ-FIX-04:** El SKILL debe indicar explícitamente: "Output MUST be raw JSON only. No markdown fences, no introductory text, no trailing instructions."
- **REQ-FIX-05:** Opcional: incluir ejemplo de output incorrecto vs correcto en el SKILL para guiar al agente.

### 3. Fallback opcional: leer archivo escrito por el agente

**Correlación:** El agente escribió `it_000008_test-batch-results.json` con resultados válidos; el stdout tenía texto extra

- **REQ-FIX-06:** Si `parseBatchExecutionPayload(agentResult.stdout)` falla, intentar leer `.agents/flow/it_{iteration}_test-batch-results.json` (o similar) si el agente indicó en su output que lo escribió ahí.
- **REQ-FIX-07:** Este fallback es opcional; la solución principal es REQ-FIX-01 a REQ-FIX-03.

### 4. Requisitos del PRD que quedarán verificables tras el fix

Una vez corregido el parseo, los siguientes requisitos serán evaluables por los tests existentes:

| Requisito | Tests que lo verifican |
|-----------|------------------------|
| **FR-1** | TC-US001-01, 02, 03; TC-US002-13, 14; TC-FR1-01, 02, 03 |
| **FR-2** | TC-US002-09, 10, 11 |
| **FR-3** | TC-US001-06; TC-US002-12 |
| **FR-4** | TC-US001-04, 05, 07 |
| **FR-5** | TC-US002-01 a 08 |
| **FR-6** | TC-US001-04, 05, 07, 10; TC-US002-07, 08; TC-FR6-01 a 05 |
| **US-001** | TC-US001-01 a 11 |
| **US-002** | TC-US002-01 a 15 |

## Prioridad de implementación

1. **REQ-FIX-01, REQ-FIX-02** — Arreglar `extractJson` para manejar múltiples bloques markdown.
2. **REQ-FIX-03** — Verificar/mejorar fallback de array.
3. **REQ-FIX-04** — Actualizar SKILL execute-test-batch.
4. **REQ-FIX-06, REQ-FIX-07** — Solo si los anteriores no bastan.
