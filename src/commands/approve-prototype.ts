export interface ApprovePrototypeOptions {
  force?: boolean;
}

interface ApprovePrototypeDeps {
  logFn: (message: string) => void;
}

const defaultDeps: ApprovePrototypeDeps = {
  logFn: console.warn,
};

export async function runApprovePrototype(
  _opts: ApprovePrototypeOptions = {},
  deps: Partial<ApprovePrototypeDeps> = {},
): Promise<void> {
  const mergedDeps = { ...defaultDeps, ...deps };
  mergedDeps.logFn("⚠️  The 'nvst approve prototype' command is currently a stub and not fully implemented yet.");
}
