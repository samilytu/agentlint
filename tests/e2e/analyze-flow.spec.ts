import { expect, test, type Page } from "@playwright/test";

function normalizeMultiline(value: string) {
  return value.replace(/\r\n/g, "\n").trimEnd();
}

async function waitForAnalysisResult(page: Page) {
  await expect(page.getByText("Judge is thinking")).not.toBeVisible({ timeout: 45_000 });

  const output = page.getByTestId("artifact-output");
  await expect(output).toBeVisible({ timeout: 45_000 });
  await expect(output).not.toContainText("Run Analyze to generate the perfected artifact.", {
    timeout: 45_000,
  });

  return output;
}

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

test.describe("Analyze flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("analyze button is disabled when input is empty", async ({ page }) => {
    const input = page.getByTestId("artifact-input");
    await input.fill("");

    const analyzeBtn = page.getByRole("button", { name: "Analyze" });
    await expect(analyzeBtn).toBeDisabled();
  });

  test("shows loading state during analysis", async ({ page }) => {
    await page.getByRole("button", { name: "Analyze" }).click();
    await expect(page.getByText("Judge is thinking")).toBeVisible();
  });

  test("analysis produces output, score, and diff", async ({ page }) => {
    await page.getByRole("button", { name: "Analyze" }).click();

    const output = await waitForAnalysisResult(page);
    await expect(output).toHaveText(/\S+/);

    await expect(page.locator("[data-slot='progress']").first()).toBeVisible();

    await expect(page.locator(".bg-emerald-500\\/15").first()).toBeVisible();
  });

  test("apply fix replaces input with output", async ({ page }) => {
    await page.getByRole("button", { name: "Analyze" }).click();

    const output = await waitForAnalysisResult(page);
    const outputText = normalizeMultiline((await output.textContent()) ?? "");
    expect(outputText.length).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Apply Fix" }).click();
    const input = page.getByTestId("artifact-input");
    const inputValue = normalizeMultiline(await input.inputValue());
    expect(inputValue).toBe(outputText);
  });

  test("copy button copies output to clipboard", async ({ page }) => {
    await page.getByRole("button", { name: "Analyze" }).click();

    const output = await waitForAnalysisResult(page);
    const outputText = normalizeMultiline((await output.textContent()) ?? "");

    await page.getByRole("button", { name: "Copy" }).click();
    await expect(page.getByText("Copied!")).toBeVisible();

    const clipboard = normalizeMultiline(
      await page.evaluate(async () => navigator.clipboard.readText()),
    );
    expect(clipboard).toBe(outputText);
  });

  test("export button triggers download", async ({ page }) => {
    await page.getByRole("button", { name: "Analyze" }).click();
    await waitForAnalysisResult(page);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/agents-refined\.md/);
  });

  test("action buttons are disabled before analysis", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Apply Fix" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Copy" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Export" })).toBeDisabled();
  });
});
