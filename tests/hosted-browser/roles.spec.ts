import { test, expect } from "@playwright/test";
import {
  demoAccounts,
  demoSession,
  hostedClients,
} from "../../scripts/hosted-session.mjs";

test("hosted staff sessions load their workspaces and preserve district privacy", async ({
  browser,
  baseURL,
}) => {
  const clients = hostedClients();
  for (const role of Object.keys(demoAccounts)) {
    const account = await demoSession(clients, role);
    const context = await browser.newContext();
    try {
      // Only this short-lived user's session enters the browser; the server key
      // stays in Node. No passwords, auth state files or traces are written.
      await context.addInitScript(
        ({ key, session }) =>
          localStorage.setItem(key, JSON.stringify(session)),
        {
          key: `sb-${new URL(clients.url).hostname.split(".")[0]}-auth-token`,
          session: account.session,
        },
      );
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(baseURL!);
      await expect(
        page.getByRole("navigation", { name: "CARE WORKSPACE", exact: true }),
      ).toBeVisible();
      await expect(page.getByLabel("Demo role", { exact: true })).toHaveCount(
        0,
      );
      if (role === "district_admin") {
        await expect(
          page
            .getByRole("navigation")
            .getByRole("button", { name: "Patient registry", exact: true }),
        ).toHaveCount(0);
        await page
          .getByRole("navigation")
          .getByRole("button", { name: "District reports", exact: true })
          .click();
        await expect(page.getByRole("table")).toHaveCount(0);
      } else {
        await page
          .getByRole("navigation")
          .getByRole("button", { name: "Patient registry", exact: true })
          .click();
        await expect(
          page.getByRole("button", { name: /Open record:/ }).first(),
        ).toBeVisible();
      }
      await page.screenshot({
        path: `test-results/hosted-${role}.png`,
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
      await account.client.auth.signOut({ scope: "local" });
    }
  }
});
