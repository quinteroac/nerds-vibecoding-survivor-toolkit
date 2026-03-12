export interface ApprovePrototypeOptions {
  force?: boolean;
}

interface ApprovePrototypeDeps {
  logFn: (message: string) => void;
}

const defaultDeps: ApprovePrototypeDeps = {
  logFn: console.log,
};

export async function runApprovePrototype(
  _opts: ApprovePrototypeOptions = {},
  deps: Partial<ApprovePrototypeDeps> = {},
): Promise<void> {
  const mergedDeps = { ...defaultDeps, ...deps };
  mergedDeps.logFn("nvst approve prototype is not implemented yet.");
}
