import { expect, test } from "@playwright/test";

test.describe("Artifact type switching", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("default type is agents with AGENTS.md template loaded", async ({ page }) => {
    const input = page.getByTestId("artifact-input");
    await expect(input).toHaveValue(/# AGENTS\.md/);
  });

  test("switching to skills loads skills template", async ({ page }) => {
    await page.getByRole("button", { name: /Skills/i }).click();
    const input = page.getByTestId("artifact-input");
    await expect(input).toHaveValue(/safe-deploy-skill/);
  });

  test("switching to rules loads rules template", async ({ page }) => {
    await page.getByRole("button", { name: /Rules/i }).click();
    const input = page.getByTestId("artifact-input");
    await expect(input).toHaveValue(/No any types/);
  });

  test("switching to workflows loads workflows template", async ({ page }) => {
    await page.getByRole("button", { name: /Workflows|Flows/i }).click();
    const input = page.getByTestId("artifact-input");
    await expect(input).toHaveValue(/Release Patch/);
  });

  test("switching to plans loads plans template", async ({ page }) => {
    await page.getByRole("button", { name: /Plans/i }).click();
    const input = page.getByTestId("artifact-input");
    await expect(input).toHaveValue(/# Great Plan/);
  });

  test("switching type clears previous output", async ({ page }) => {
    await page.getByRole("button", { name: "Analyze" }).click();
    await expect(page.getByText("Judge is thinking")).not.toBeVisible({ timeout: 45_000 });

    const output = page.getByTestId("artifact-output");
    await expect(output).not.toContainText("Run Analyze to generate the perfected artifact.", {
      timeout: 45_000,
    });

    await page.getByRole("button", { name: /Skills/i }).click();
    await expect(output).toContainText("Run Analyze to generate the perfected artifact.");
  });
});
