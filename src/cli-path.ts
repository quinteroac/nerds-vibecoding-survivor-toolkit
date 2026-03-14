import { join } from "node:path";

const isCompiled = import.meta.path.startsWith("/$bunfs");

/**
 * Command prefix to invoke the CLI as a subprocess.
 * When running as a compiled binary: [execPath] (the binary itself).
 * When running from source: ["bun", "path/to/cli.ts"].
 */
export const CLI_COMMAND: string[] = isCompiled
  ? [process.execPath]
  : ["bun", join(import.meta.dir, "cli.ts")];
