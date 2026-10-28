import { test, expect } from "@playwright/test";

test("production server delivers Supabase login, assets and API on one origin", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeEnabled();
  await expect(page.getByLabel("Demo role", { exact: true })).toHaveCount(0);
  const response = await request.get("/api/status");
  expect(response.status()).toBe(200);
  expect((await response.json()).database).toBe(true);
  expect((await request.post("/api/upload", { data: {} })).status()).toBe(401);
  expect((await request.get("/.env.server")).status()).toBe(404);
  await page.screenshot({
    path: "test-results/render-login-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/render-login-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});
