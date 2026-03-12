import type { AgentProvider } from "../agent";

export interface AuditPrototypeOptions {
  provider: AgentProvider;
  force?: boolean;
}

interface AuditPrototypeDeps {
  logFn: (message: string) => void;
}

const defaultDeps: AuditPrototypeDeps = {
  logFn: console.warn,
};

export async function runAuditPrototype(
  _opts: AuditPrototypeOptions,
  deps: Partial<AuditPrototypeDeps> = {},
): Promise<void> {
  const mergedDeps = { ...defaultDeps, ...deps };
  mergedDeps.logFn("⚠️  The 'nvst audit prototype' command is currently a stub and not fully implemented yet.");
}
