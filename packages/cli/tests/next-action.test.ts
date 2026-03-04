import { buildNextActions, type NextActionContext } from "../src/ui/next-action.js";

describe("buildNextActions", () => {
  // ── After init ─────────────────────────────────────────────────────────

  it("recommends prompt after init when configs were created", () => {
    const context: NextActionContext = {
      completedCommand: "init",
      initCreatedConfigs: true,
    };
    const options = buildNextActions(context);
    expect(options[0].value).toBe("prompt");
    expect(options[0].label).toContain("recommended");
    expect(options[1].value).toBe("doctor");
  });

  it("recommends doctor after init when all configs existed", () => {
    const context: NextActionContext = {
      completedCommand: "init",
      initCreatedConfigs: false,
    };
    const options = buildNextActions(context);
    expect(options[0].value).toBe("doctor");
    expect(options[0].label).toContain("recommended");
    expect(options[1].value).toBe("prompt");
  });

  // ── After doctor ───────────────────────────────────────────────────────

  it("recommends prompt after doctor", () => {
    const context: NextActionContext = {
      completedCommand: "doctor",
    };
    const options = buildNextActions(context);
    expect(options[0].value).toBe("prompt");
    expect(options[0].label).toContain("recommended");
    expect(options[1].value).toBe("init");
  });

  // ── After prompt ───────────────────────────────────────────────────────

  it("recommends doctor after prompt when no report exists", () => {
    const context: NextActionContext = {
      completedCommand: "prompt",
      hasReport: false,
    };
    const options = buildNextActions(context);
    expect(options[0].value).toBe("doctor");
    expect(options[0].label).toContain("recommended");
    expect(options[1].value).toBe("init");
  });

  it("offers doctor and init after prompt when report exists (no recommendation)", () => {
    const context: NextActionContext = {
      completedCommand: "prompt",
      hasReport: true,
    };
    const options = buildNextActions(context);
    expect(options[0].value).toBe("doctor");
    expect(options[1].value).toBe("init");
    // No "recommended" — workflow is complete
    expect(options[0].label).not.toContain("recommended");
  });

  // ── Navigation options always present ──────────────────────────────────

  it("always ends with 'Back to menu' and 'Exit'", () => {
    const contexts: NextActionContext[] = [
      { completedCommand: "init", initCreatedConfigs: true },
      { completedCommand: "init", initCreatedConfigs: false },
      { completedCommand: "doctor" },
      { completedCommand: "prompt", hasReport: false },
      { completedCommand: "prompt", hasReport: true },
    ];

    for (const context of contexts) {
      const options = buildNextActions(context);
      const lastTwo = options.slice(-2);
      expect(lastTwo[0].value).toBe("menu");
      expect(lastTwo[0].label).toBe("Back to menu");
      expect(lastTwo[1].value).toBe("exit");
      expect(lastTwo[1].label).toBe("Exit");
    }
  });

  it("returns at least 4 options for every context", () => {
    const contexts: NextActionContext[] = [
      { completedCommand: "init", initCreatedConfigs: true },
      { completedCommand: "doctor" },
      { completedCommand: "prompt", hasReport: false },
    ];

    for (const context of contexts) {
      const options = buildNextActions(context);
      // At least 2 commands + "Back to menu" + "Exit"
      expect(options.length).toBeGreaterThanOrEqual(4);
    }
  });

  // ── Edge: unknown command falls through to default ─────────────────────

  it("provides all three commands for unknown completedCommand", () => {
    const context: NextActionContext = {
      completedCommand: "exit" as NextActionContext["completedCommand"],
    };
    const options = buildNextActions(context);
    const values = options.map((o) => o.value);
    expect(values).toContain("init");
    expect(values).toContain("doctor");
    expect(values).toContain("prompt");
    expect(values).toContain("menu");
    expect(values).toContain("exit");
  });
});
