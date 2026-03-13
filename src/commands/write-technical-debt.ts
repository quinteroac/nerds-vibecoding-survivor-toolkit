import { z } from "zod";

import {
  appendTechnicalDebtItems,
  DEFAULT_TECHNICAL_DEBT_PATH,
} from "../technical-debt";

const DebtItemSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
});

const WriteTechnicalDebtPayloadSchema = z.object({
  iteration: z.string().optional(),
  items: z.array(DebtItemSchema).min(1),
});

export type WriteTechnicalDebtPayload = z.infer<
  typeof WriteTechnicalDebtPayloadSchema
>;

export interface WriteTechnicalDebtOptions {
  args: string[];
}

function extractFlag(
  args: string[],
  flag: string,
): { value: string | null; remaining: string[] } {
  const idx = args.indexOf(flag);
  if (idx === -1) return { value: null, remaining: args };
  if (idx + 1 >= args.length) {
    throw new Error(`Missing value for ${flag}`);
  }
  const value = args[idx + 1];
  const remaining = [...args.slice(0, idx), ...args.slice(idx + 2)];
  return { value, remaining };
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  const reader = Bun.stdin.stream().getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks).toString("utf-8");
}

/**
 * Writes or appends technical debt items to the project's TECHNICAL_DEBT.md.
 * Updates are additive; existing entries are preserved.
 */
export async function runWriteTechnicalDebt({
  args,
}: WriteTechnicalDebtOptions): Promise<void> {
  const { value: dataArg, remaining: afterData } = extractFlag(args, "--data");
  const { value: outPath, remaining: afterOut } = extractFlag(
    afterData,
    "--out",
  );
  if (afterOut.length > 0) {
    throw new Error(`Unknown option(s): ${afterOut.join(" ")}`);
  }

  let rawJson: string;
  if (dataArg) {
    rawJson = dataArg;
  } else {
    rawJson = await readStdin();
    if (!rawJson.trim()) {
      throw new Error(
        "No JSON payload provided. Use --data '<json>' or pipe via stdin.",
      );
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    throw new Error(
      `Invalid JSON input: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const result = WriteTechnicalDebtPayloadSchema.safeParse(parsed);
  if (!result.success) {
    const formatted = result.error.format();
    throw new Error(
      `Invalid payload: ${JSON.stringify({ errors: formatted }, null, 2)}`,
    );
  }

  const projectRoot = process.cwd();
  const filePath = outPath ?? DEFAULT_TECHNICAL_DEBT_PATH;

  await appendTechnicalDebtItems(projectRoot, {
    items: result.data.items,
    iteration: result.data.iteration,
    filePath,
  });

  console.log(`Updated: ${filePath}`);
}
