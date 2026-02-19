import { ProgressSchema } from "./tmpl_progress.ts";
import { readFileSync } from "fs";
import { join } from "path";

const path = join(import.meta.dir, "..", ".agents", "flow", "tmpl_it_000001_progress.example.json");
const raw = JSON.parse(readFileSync(path, "utf-8"));
const result = ProgressSchema.safeParse(raw);
if (result.success) {
  console.log("tmpl_it_000001_progress.example.json is valid");
} else {
  console.error("Validation failed:", result.error.flatten());
  process.exit(1);
}
