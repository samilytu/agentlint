import { getPromptPack } from "@agent-lint/core";
import { artifactTypeValues } from "@agent-lint/shared";

describe("getPromptPack", () => {
  it("returns a prompt pack for each artifact type", () => {
    for (const type of artifactTypeValues) {
      const pack = getPromptPack(type);

      expect(pack.title.length).toBeGreaterThan(0);
      expect(pack.summary.length).toBeGreaterThan(0);
      expect(pack.prompt.length).toBeGreaterThan(0);
      expect(pack.prompt).toContain("Never expose secrets or tokens");
    }
  });
});
