import type { AgentProvider } from "../agent";

export interface AuditPrototypeOptions {
  provider: AgentProvider;
  force?: boolean;
}

interface AuditPrototypeDeps {
  logFn: (message: string) => void;
}

const defaultDeps: AuditPrototypeDeps = {
  logFn: console.log,
};

export async function runAuditPrototype(
  _opts: AuditPrototypeOptions,
  deps: Partial<AuditPrototypeDeps> = {},
): Promise<void> {
  const mergedDeps = { ...defaultDeps, ...deps };
  mergedDeps.logFn("nvst audit prototype is not implemented yet.");
}
