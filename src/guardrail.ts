import { createInterface } from "node:readline";

import type { State } from "../scaffold/schemas/tmpl_state";

export class GuardrailAbortError extends Error {
  constructor() {
    super("Aborted.");
    this.name = "GuardrailAbortError";
  }
}

export type ReadLineFn = () => Promise<string | null>;
export type StderrWriteFn = (message: string) => void;

export interface GuardrailOptions {
  force?: boolean;
  readLineFn?: ReadLineFn;
  stderrWriteFn?: StderrWriteFn;
}

async function defaultReadLine(): Promise<string | null> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      terminal: false,
    });

    let settled = false;

    const settle = (value: string | null): void => {
      if (!settled) {
        settled = true;
        rl.close();
        resolve(value);
      }
    };

    rl.once("line", settle);
    rl.once("close", () => settle(null));
  });
}

function defaultStderrWrite(message: string): void {
  process.stderr.write(`${message}\n`);
}

/**
 * Enforces the flow guardrail for phase/status violations.
 *
 * - strict (default): throws Error with `message` when `violated` is true and `force` is false
 * - relaxed: prints warning + confirmation prompt to stderr; aborts (exitCode=1) unless user confirms
 * - force: prints warning but skips the confirmation prompt regardless of guardrail mode
 *
 * When not violated, returns immediately without side effects.
 */
export async function assertGuardrail(
  state: State,
  violated: boolean,
  message: string,
  opts: GuardrailOptions = {},
): Promise<void> {
  if (!violated) {
    return;
  }

  const guardrail = state.flow_guardrail ?? "strict";
  const {
    force = false,
    readLineFn = defaultReadLine,
    stderrWriteFn = defaultStderrWrite,
  } = opts;

  if (guardrail === "strict" && !force) {
    throw new Error(message);
  }

  // Print warning to stderr (AC01, AC06)
  stderrWriteFn(`Warning: ${message}`);

  if (force) {
    // With --force: warn but skip the confirmation prompt (US-002)
    return;
  }

  // Relaxed mode without --force: prompt for confirmation (AC02, AC06)
  stderrWriteFn("Proceed anyway? [y/N]");

  let line: string | null;
  try {
    line = await readLineFn();
  } catch {
    line = null;
  }

  // Only "y" or "Y" is treated as confirmation (AC03, AC04, AC05)
  if (line !== null && (line.trim() === "y" || line.trim() === "Y")) {
    return;
  }

  // User aborted or stdin was closed (AC04, AC05)
  stderrWriteFn("Aborted.");
  process.exitCode = 1;
  throw new GuardrailAbortError();
}
