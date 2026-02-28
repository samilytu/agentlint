import { readFile } from "node:fs/promises";
import path from "node:path";

import { MCP_TOOL_NAMES } from "@agent-lint/shared";
import { describe, expect, it } from "vitest";

type ServerJsonTool = {
  name?: string;
};

type ServerJsonShape = {
  tools?: ServerJsonTool[];
};

function sortStrings(input: readonly string[]): string[] {
  return [...input].sort((a, b) => a.localeCompare(b));
}

describe("server.json contract", () => {
  it("advertises the same MCP tool names as shared schema catalog", async () => {
    const serverJsonPath = path.resolve(process.cwd(), "server.json");
    const raw = await readFile(serverJsonPath, "utf8");

    const parsed = JSON.parse(raw) as ServerJsonShape;
    const advertisedTools = (parsed.tools ?? [])
      .map((tool) => tool.name)
      .filter((name): name is string => typeof name === "string");

    expect(sortStrings(advertisedTools)).toEqual(sortStrings(MCP_TOOL_NAMES));
  });
});
