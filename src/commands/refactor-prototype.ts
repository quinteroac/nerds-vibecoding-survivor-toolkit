import type { AgentProvider } from "../agent";

export interface RefactorPrototypeOptions {
  provider: AgentProvider;
  force?: boolean;
}

interface RefactorPrototypeDeps {
  logFn: (message: string) => void;
}

const defaultDeps: RefactorPrototypeDeps = {
  logFn: console.warn,
};

export async function runRefactorPrototype(
  _opts: RefactorPrototypeOptions,
  deps: Partial<RefactorPrototypeDeps> = {},
): Promise<void> {
  const mergedDeps = { ...defaultDeps, ...deps };
  mergedDeps.logFn("⚠️  The 'nvst refactor prototype' command is currently a stub and not fully implemented yet.");
}
