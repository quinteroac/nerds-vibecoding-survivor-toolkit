import type { AgentProvider } from "../agent";
import { assertGuardrail, type ReadLineFn, type StderrWriteFn } from "../guardrail";
import { readState } from "../state";
import type { State } from "../schemas/tmpl_state";
import { runCreatePrototype, type CreatePrototypeOptions } from "./create-prototype";
import { runAuditPrototype, type AuditPrototypeOptions } from "./audit-prototype";
import { runRefactorPrototype, type RefactorPrototypeOptions } from "./refactor-prototype";

export interface AutoOptions {
  provider: AgentProvider;
  force?: boolean;
  yolo?: boolean;
}

interface AutoDeps {
  readStateFn: (projectRoot: string) => Promise<State>;
  readLineFn?: ReadLineFn;
  stderrWriteFn?: StderrWriteFn;
  runCreatePrototypeFn: (opts: CreatePrototypeOptions) => Promise<void>;
  runAuditPrototypeFn: (opts: AuditPrototypeOptions) => Promise<void>;
  runRefactorPrototypeFn: (opts: RefactorPrototypeOptions) => Promise<void>;
}

const defaultDeps: AutoDeps = {
  readStateFn: readState,
  runCreatePrototypeFn: runCreatePrototype,
  runAuditPrototypeFn: runAuditPrototype,
  runRefactorPrototypeFn: runRefactorPrototype,
};

export async function runAuto(opts: AutoOptions, deps: Partial<AutoDeps> = {}): Promise<void> {
  const merged = { ...defaultDeps, ...deps };
  const projectRoot = process.cwd();

  const state = await merged.readStateFn(projectRoot);
  const requirementStatus = state.phases.define.requirement_definition.status;

  await assertGuardrail(
    state,
    requirementStatus !== "approved",
    "Requirement must be approved before running auto mode. Run `bun nvst approve requirement` first.",
    {
      force: opts.force,
      readLineFn: merged.readLineFn,
      stderrWriteFn: merged.stderrWriteFn,
    },
  );

  await merged.runCreatePrototypeFn({
    provider: opts.provider,
    force: opts.force,
    yolo: opts.yolo,
  });

  await merged.runAuditPrototypeFn({
    provider: opts.provider,
    force: opts.force,
    yolo: opts.yolo,
    interactive: false,
  });

  await merged.runRefactorPrototypeFn({
    provider: opts.provider,
    force: opts.force,
    yolo: opts.yolo,
  });
}
