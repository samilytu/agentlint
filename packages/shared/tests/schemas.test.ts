import {
  getGuidelinesInputSchema,
  planWorkspaceAutofixInputSchema,
  quickCheckInputSchema,
  emitMaintenanceSnippetInputSchema,
  MCP_TOOL_NAMES,
  mcpClientValues,
} from "@agent-lint/shared";
import { describe, expect, it } from "vitest";

describe("schemas", () => {
  describe("MCP_TOOL_NAMES", () => {
    it("has exactly 4 tools", () => {
      expect(MCP_TOOL_NAMES).toHaveLength(4);
    });

    it("all names start with agentlint_ prefix", () => {
      for (const name of MCP_TOOL_NAMES) {
        expect(name.startsWith("agentlint_")).toBe(true);
      }
    });
  });

  describe("mcpClientValues", () => {
    it("includes all supported clients", () => {
      expect(mcpClientValues).toContain("cursor");
      expect(mcpClientValues).toContain("windsurf");
      expect(mcpClientValues).toContain("vscode");
      expect(mcpClientValues).toContain("claude-desktop");
      expect(mcpClientValues).toContain("claude-code");
      expect(mcpClientValues).toContain("generic");
    });
  });

  describe("getGuidelinesInputSchema", () => {
    it("accepts valid input", () => {
      const result = getGuidelinesInputSchema.safeParse({ type: "agents" });
      expect(result.success).toBe(true);
    });

    it("accepts input with client", () => {
      const result = getGuidelinesInputSchema.safeParse({ type: "skills", client: "cursor" });
      expect(result.success).toBe(true);
    });

    it("rejects missing type", () => {
      const result = getGuidelinesInputSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("rejects invalid type", () => {
      const result = getGuidelinesInputSchema.safeParse({ type: "invalid" });
      expect(result.success).toBe(false);
    });

    it("rejects invalid client", () => {
      const result = getGuidelinesInputSchema.safeParse({ type: "agents", client: "invalid" });
      expect(result.success).toBe(false);
    });
  });

  describe("planWorkspaceAutofixInputSchema", () => {
    it("accepts empty object", () => {
      const result = planWorkspaceAutofixInputSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("accepts rootPath", () => {
      const result = planWorkspaceAutofixInputSchema.safeParse({ rootPath: "/some/path" });
      expect(result.success).toBe(true);
    });
  });

  describe("quickCheckInputSchema", () => {
    it("accepts empty object", () => {
      const result = quickCheckInputSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("accepts changedPaths", () => {
      const result = quickCheckInputSchema.safeParse({ changedPaths: ["src/index.ts"] });
      expect(result.success).toBe(true);
    });

    it("accepts changeDescription", () => {
      const result = quickCheckInputSchema.safeParse({ changeDescription: "Added new module" });
      expect(result.success).toBe(true);
    });

    it("accepts both inputs", () => {
      const result = quickCheckInputSchema.safeParse({
        changedPaths: ["src/new.ts"],
        changeDescription: "New feature",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty string in changedPaths", () => {
      const result = quickCheckInputSchema.safeParse({ changedPaths: [""] });
      expect(result.success).toBe(false);
    });
  });

  describe("emitMaintenanceSnippetInputSchema", () => {
    it("accepts empty object", () => {
      const result = emitMaintenanceSnippetInputSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("accepts valid client", () => {
      const result = emitMaintenanceSnippetInputSchema.safeParse({ client: "windsurf" });
      expect(result.success).toBe(true);
    });

    it("rejects invalid client", () => {
      const result = emitMaintenanceSnippetInputSchema.safeParse({ client: "invalid" });
      expect(result.success).toBe(false);
    });
  });
});
