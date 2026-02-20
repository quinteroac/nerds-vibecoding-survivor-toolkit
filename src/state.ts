import { access, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { StateSchema, type State } from "../scaffold/schemas/tmpl_state";

export const STATE_REL_PATH = join(".agents", "state.json");
export const FLOW_REL_DIR = join(".agents", "flow");

export async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function readState(projectRoot: string): Promise<State> {
  const statePath = join(projectRoot, STATE_REL_PATH);
  const raw = await readFile(statePath, "utf8");
  return StateSchema.parse(JSON.parse(raw));
}

export async function writeState(projectRoot: string, state: State): Promise<void> {
  const statePath = join(projectRoot, STATE_REL_PATH);
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}
