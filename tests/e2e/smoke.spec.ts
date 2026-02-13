import { expect, test } from "@playwright/test";

test("home renderiza cabecera", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Vectus Projects (MVP)" })).toBeVisible();
});