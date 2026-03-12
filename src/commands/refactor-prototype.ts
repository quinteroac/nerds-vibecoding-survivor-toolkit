import type { AgentProvider } from "../agent";

export interface RefactorPrototypeOptions {
  provider: AgentProvider;
  force?: boolean;
}

interface RefactorPrototypeDeps {
  logFn: (message: string) => void;
}

const defaultDeps: RefactorPrototypeDeps = {
  logFn: console.log,
};

export async function runRefactorPrototype(
  _opts: RefactorPrototypeOptions,
  deps: Partial<RefactorPrototypeDeps> = {},
): Promise<void> {
  const mergedDeps = { ...defaultDeps, ...deps };
  mergedDeps.logFn("nvst refactor prototype is not implemented yet.");
}
