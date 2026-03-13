import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

const DEFAULT_ENTRY = "src/cli.ts";
const DEFAULT_OUTDIR = "dist";
const DEFAULT_NAME = "nvst";

export interface BuildBinaryOptions {
  target?: string;
  outdir?: string;
  name?: string;
  entry?: string;
}

export function resolveBinaryFilename(name: string, target?: string): string {
  const normalizedName = name.endsWith(".exe") ? name.slice(0, -4) : name;
  const useExe = target ? target.includes("windows") : process.platform === "win32";
  return useExe ? `${normalizedName}.exe` : normalizedName;
}

async function cleanupPriorOutputs(outdir: string, name: string): Promise<void> {
  const normalizedName = name.endsWith(".exe") ? name.slice(0, -4) : name;
  await Promise.all([
    rm(join(outdir, normalizedName), { force: true }),
    rm(join(outdir, `${normalizedName}.exe`), { force: true }),
  ]);
}

export function parseBuildBinaryArgs(args: string[]): BuildBinaryOptions {
  const options: BuildBinaryOptions = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--target") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("Missing value for --target.");
      }
      options.target = value;
      index += 1;
      continue;
    }

    if (arg === "--outdir") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("Missing value for --outdir.");
      }
      options.outdir = value;
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

    if (arg === "--entry") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("Missing value for --entry.");
      }
      options.entry = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

export async function runBuildBinary(options: BuildBinaryOptions): Promise<string> {
  const target = options.target;
  const outdir = options.outdir ?? DEFAULT_OUTDIR;
  const name = options.name ?? DEFAULT_NAME;
  const entry = options.entry ?? DEFAULT_ENTRY;
  const outputName = resolveBinaryFilename(name, target);
  const outfile = join(outdir, outputName);

  await mkdir(outdir, { recursive: true });
  await cleanupPriorOutputs(outdir, name);

  const command = [
    "bun",
    "build",
    entry,
    "--compile",
    `--outfile=${outfile}`,
    ...(target ? [`--target=${target}`] : []),
  ];

  const processRef = Bun.spawn(command, {
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await processRef.exited;
  if (exitCode !== 0) {
    throw new Error(`Binary build failed with exit code ${exitCode}.`);
  }

  return outfile;
}

if (import.meta.main) {
  const options = parseBuildBinaryArgs(process.argv.slice(2));
  const outfile = await runBuildBinary(options);
  console.log(`Built binary: ${outfile}`);
}
