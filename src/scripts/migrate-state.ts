import { join } from "node:path";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";

// Define the path to the state file
const statePath = join(process.cwd(), ".agents", "state.json");

async function migrateState() {
  console.log(`Checking for state file at ${statePath}`);
  
  if (!existsSync(statePath)) {
    console.log("No state.json found. Nothing to migrate.");
    return;
  }

  try {
    const fileContent = await readFile(statePath, "utf-8");
    const state = JSON.parse(fileContent);

    let modified = false;

    // Check if phases.prototype exists and prune deprecated fields
    if (state.phases && state.phases.prototype) {
      const p = state.phases.prototype;
      
      if ("test_plan" in p) {
        delete p.test_plan;
        modified = true;
      }
      if ("tp_generation" in p) {
        delete p.tp_generation;
        modified = true;
      }
      if ("test_execution" in p) {
        delete p.test_execution;
        modified = true;
      }

      if (modified) {
        console.log("Found deprecated fields in phases.prototype. Removing them...");
        // Write the cleaned JSON back
        await writeFile(statePath, JSON.stringify(state, null, 2), "utf-8");
        console.log("Migration complete. Removed `test_plan`, `tp_generation`, and `test_execution`.");
      } else {
        console.log("No deprecated fields found in phases.prototype. State is already clean.");
      }
    } else {
      console.log("No phases.prototype block found in state.json.");
    }
  } catch (error) {
    console.error("Failed to migrate state.json:", error);
    process.exitCode = 1;
  }
}

migrateState();
