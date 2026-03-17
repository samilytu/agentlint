import {
  buildNextActions,
  getNextActionGuidance,
  type NextActionContext,
} from "../src/ui/next-action.js";

describe("buildNextActions", () => {
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

  it("recommends prompt after doctor", () => {
    const context: NextActionContext = {
      completedCommand: "doctor",
    };
    const options = buildNextActions(context);
    expect(options[0].value).toBe("prompt");
    expect(options[0].label).toContain("recommended");
    expect(options[1].value).toBe("init");
  });

  it("recommends doctor after prompt", () => {
    const context: NextActionContext = {
      completedCommand: "prompt",
    };
    const options = buildNextActions(context);
    expect(options[0].value).toBe("doctor");
    expect(options[0].label).toContain("recommended");
    expect(options[1].value).toBe("init");
  });

  it("always ends with 'Back to menu' and 'Exit'", () => {
    const contexts: NextActionContext[] = [
      { completedCommand: "init", initCreatedConfigs: true },
      { completedCommand: "init", initCreatedConfigs: false },
      { completedCommand: "doctor" },
      { completedCommand: "prompt" },
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
      { completedCommand: "prompt" },
    ];

    for (const context of contexts) {
      const options = buildNextActions(context);
      expect(options.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("provides all three commands for unknown completedCommand", () => {
    const context: NextActionContext = {
      completedCommand: "exit" as NextActionContext["completedCommand"],
    };
    const options = buildNextActions(context);
    const values = options.map((option) => option.value);
    expect(values).toContain("init");
    expect(values).toContain("doctor");
    expect(values).toContain("prompt");
    expect(values).toContain("menu");
    expect(values).toContain("exit");
  });

  it("explains the recommended sequence after doctor", () => {
    const guidance = getNextActionGuidance({ completedCommand: "doctor" });
    const options = buildNextActions({ completedCommand: "doctor" });

    expect(guidance.order).toContain("1. prompt");
    expect(guidance.order).toContain("2. init");
    expect(options[0]?.label).toContain("handoff prompt");
  });

  it("keeps navigation options short while action labels carry descriptions", () => {
    const options = buildNextActions({ completedCommand: "prompt" });

    expect(options.find((item) => item.value === "doctor")?.label).toContain("Rescan the workspace");
    expect(options.find((item) => item.value === "menu")?.label).toBe("Back to menu");
    expect(options.find((item) => item.value === "exit")?.label).toBe("Exit");
  });
});
