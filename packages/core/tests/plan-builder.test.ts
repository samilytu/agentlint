import { buildWorkspaceAutofixPlan } from "@agent-lint/core";
import path from "node:path";

describe("plan-builder", () => {
  const fixtureWorkspace = path.resolve(__dirname, "../../..", "fixtures", "workspace");

  it("builds a plan with markdown output", () => {
    const plan = buildWorkspaceAutofixPlan(fixtureWorkspace);
    expect(plan.markdown).toContain("# Workspace Autofix Plan");
    expect(plan.markdown).toContain("## Discovered artifacts");
    expect(plan.markdown).toContain("## Action plan");
  });

  it("lists canonical artifacts and excludes noisy paths", () => {
    const plan = buildWorkspaceAutofixPlan(fixtureWorkspace);

    expect(plan.markdown).toContain("docs\\workflows\\deploy.md");
    expect(plan.markdown).toContain("docs\\plans\\roadmap.md");
    expect(plan.markdown).not.toContain(".agentlint-report.md");
    expect(plan.markdown).not.toContain("README.md");
    expect(plan.markdown).not.toContain("docs\\deploy-workflow.md");
    expect(plan.markdown).not.toContain("examples\\sample\\AGENTS.md");
  });

  it("includes LLM instructions and guidelines references", () => {
    const plan = buildWorkspaceAutofixPlan(fixtureWorkspace);
    expect(plan.markdown).toContain("## Instructions for the LLM");
    expect(plan.markdown).toContain("## Guidelines references");
    expect(plan.markdown).toContain("agentlint_get_guidelines");
  });

  it("returns discovery result alongside markdown", () => {
    const plan = buildWorkspaceAutofixPlan(fixtureWorkspace);
    expect(plan.discoveryResult.discovered.length).toBe(5);
    expect(plan.discoveryResult.missing).toHaveLength(0);
    expect(plan.rootPath).toBe(fixtureWorkspace);
  });
});
