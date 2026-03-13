import { runBuildBinary } from "./build-binary";

const DEFAULT_OUTDIR = "dist";
const DEFAULT_ENTRY = "src/cli.ts";
const DEFAULT_NAME = "nvst";

export const DEFAULT_BINARY_TARGETS = [
  "bun-darwin-x64",
  "bun-linux-x64",
  "bun-windows-x64",
] as const;

export interface BuildBinariesOptions {
  outdir?: string;
  entry?: string;
  name?: string;
  targets?: string[];
}

export function targetToOutputSuffix(target: string): string {
  if (!target.startsWith("bun-")) {
    throw new Error(`Unsupported Bun target format: ${target}`);
  }

  return target.slice("bun-".length);
}

export function parseBuildBinariesArgs(args: string[]): BuildBinariesOptions {
  const options: BuildBinariesOptions = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--outdir") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("Missing value for --outdir.");
      }
      options.outdir = value;
      index += 1;
      continue;
    }

    if (arg === "--entry") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("Missing value for --entry.");
      }
      options.entry = value;
      index += 1;
      continue;
    }

    if (arg === "--name") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("Missing value for --name.");
      }
      options.name = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

export async function runBuildBinaries(options: BuildBinariesOptions): Promise<string[]> {
  const outdir = options.outdir ?? DEFAULT_OUTDIR;
  const entry = options.entry ?? DEFAULT_ENTRY;
  const name = options.name ?? DEFAULT_NAME;
  const targets = options.targets ?? [...DEFAULT_BINARY_TARGETS];

  const outputs: string[] = [];

  for (const target of targets) {
    const suffix = targetToOutputSuffix(target);
    const outfile = await runBuildBinary({
      target,
      outdir,
      entry,
      name: `${name}-${suffix}`,
    });
    outputs.push(outfile);
  }

  return outputs;
}

if (import.meta.main) {
  const options = parseBuildBinariesArgs(process.argv.slice(2));
  const outputs = await runBuildBinaries(options);
  console.log(`Built binaries:\n${outputs.join("\n")}`);
}
