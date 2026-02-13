import { expect, test } from "@playwright/test";

function normalizeMultiline(value: string) {
  return value.replace(/\r\n/g, "\n").trimEnd();
}

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

test("input -> fix -> copy flow", async ({ page }) => {
  await page.goto("/");

  const input = page.getByTestId("artifact-input");
  await input.fill("# AGENTS.md\n\nDo only safe operations.");

  await page.getByRole("button", { name: "Analyze" }).click();

  const output = page.getByTestId("artifact-output");
  await expect(page.getByText("Judge is thinking")).not.toBeVisible({ timeout: 45_000 });
  await expect(output).not.toContainText("Run Analyze to generate the perfected artifact.", {
    timeout: 45_000,
  });
  await expect(page.getByText("Warnings")).toBeVisible({ timeout: 30_000 });

  const beforeFix = normalizeMultiline((await output.textContent()) ?? "");
  expect(beforeFix.length).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Apply Fix" }).click();
  const fixedInput = normalizeMultiline(await input.inputValue());
  expect(fixedInput).toBe(beforeFix);

  await page.getByRole("button", { name: "Copy" }).click();

  const clipboard = normalizeMultiline(
    await page.evaluate(async () => navigator.clipboard.readText()),
  );
  expect(clipboard).toBe(beforeFix);
});

test("artifact switch + diff view + provider badge", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Skills" }).click();
  const input = page.getByTestId("artifact-input");
  await expect(input).toHaveValue(/name: safe-deploy-skill/);

  await page.getByRole("button", { name: "Analyze" }).click();
  await expect(page.getByText("Judge is thinking")).not.toBeVisible({ timeout: 45_000 });

  await expect(page.getByText("Analyze content to see before/after diff.")).not.toBeVisible({
    timeout: 45_000,
  });
  await expect(page.getByText(/^(gemini|mock)$/i).first()).toBeVisible({ timeout: 30_000 });
});
