import { describe, expect, test } from "bun:test";

import { buildCommand, parseAgentArg, parseProvider } from "./agent";

describe("agent provider parsing", () => {
  test("accepts cursor as a valid provider in --agent argument parsing", () => {
    const parsed = parseAgentArg(["create", "--agent", "cursor", "--force"]);

    expect(parsed.provider).toBe("cursor");
    expect(parsed.remainingArgs).toEqual(["create", "--force"]);
  });

  test("maps cursor provider to the Cursor agent CLI binary", () => {
    expect(parseProvider("cursor")).toBe("cursor");
    expect(buildCommand("cursor")).toEqual({ cmd: "agent", args: [] });
  });

  test("unknown provider error includes cursor in valid provider list", () => {
    expect(() => parseProvider("unknown-provider")).toThrow(
      "Unknown agent provider 'unknown-provider'. Valid providers: claude, codex, gemini, cursor",
    );
  });
});
