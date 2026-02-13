import { expect, test } from "@playwright/test";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

test("input -> fix -> copy flow", async ({ page }) => {
  await page.goto("/");

  const input = page.getByTestId("artifact-input");
  await input.fill("# AGENTS.md\n\nDo only safe operations.");

  await page.getByRole("button", { name: "Analyze" }).click();

  await expect(page.getByTestId("artifact-output")).toContainText("Refined Artifact", {
    timeout: 15_000,
  });

  await page.getByRole("button", { name: "Fix" }).click();
  await expect(input).toHaveValue(/Refined Artifact/);

  await page.getByRole("button", { name: "Copy" }).click();

  const clipboard = await page.evaluate(async () => navigator.clipboard.readText());
  expect(clipboard).toContain("Refined Artifact");
});
