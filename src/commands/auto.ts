import type { AgentProvider } from "../agent";
import { runCreatePrototype, type CreatePrototypeOptions } from "./create-prototype";
import { runAuditPrototype, type AuditPrototypeOptions } from "./audit-prototype";
import { runRefactorPrototype, type RefactorPrototypeOptions } from "./refactor-prototype";

export interface AutoOptions {
  provider: AgentProvider;
  force?: boolean;
  yolo?: boolean;
}

interface AutoDeps {
  runCreatePrototypeFn: (opts: CreatePrototypeOptions) => Promise<void>;
  runAuditPrototypeFn: (opts: AuditPrototypeOptions) => Promise<void>;
  runRefactorPrototypeFn: (opts: RefactorPrototypeOptions) => Promise<void>;
}

const defaultDeps: AutoDeps = {
  runCreatePrototypeFn: runCreatePrototype,
  runAuditPrototypeFn: runAuditPrototype,
  runRefactorPrototypeFn: runRefactorPrototype,
};

export async function runAuto(opts: AutoOptions, deps: Partial<AutoDeps> = {}): Promise<void> {
  const merged = { ...defaultDeps, ...deps };

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
