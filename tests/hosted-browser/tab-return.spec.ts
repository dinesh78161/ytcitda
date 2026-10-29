import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import {
  hostedClients,
  demoSession,
  checked,
} from "../../scripts/hosted-session.mjs";

test.use({ serviceWorkers: "block" });

test("live session retains the patient care tab after repeated browser returns", async ({
  page,
  baseURL,
}) => {
  test.skip(
    process.env.RUN_TAB_RETURN_PROD !== "1",
    "Opt in to read-only production verification.",
  );
  expect(baseURL).toBe("https://aarogya-drishti-om9g.onrender.com");
  const clients = hostedClients();
  const account = await demoSession(clients, "medical_officer");
  const patientId = "9e2ccf4d-6508-4c75-b072-c0972edd4509";
  try {
    const patient = checked(
      await account.client
        .from("patients")
        .select("id,display_name")
        .eq("id", patientId)
        .single(),
      "Existing synthetic test case",
    );
    expect(patient.display_name).toMatch(/^Synthetic Recorded Journey /);
    const authKey = `sb-${new URL(clients.url).hostname.split(".")[0]}-auth-token`;
    await page.addInitScript(
      ({ key, session }) => {
        localStorage.setItem(key, JSON.stringify(session));
        localStorage.setItem("aarogya-language", "en");
      },
      { key: authKey, session: account.session },
    );
    let profileReads = 0;
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/rest/v1/profiles")
        profileReads++;
    });
    await page.goto(baseURL!);
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Patient registry", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: /Search by name, village or ID/ })
      .fill(patient.display_name);
    await page
      .getByRole("button", {
        name: `Open record: ${patient.display_name}`,
        exact: true,
      })
      .click();
    const careTab = page.getByRole("tab", { name: "Care plan", exact: true });
    await careTab.click();
    const notes = page.getByRole("textbox", {
      name: "Investigation notes / result",
      exact: true,
    });
    await notes.scrollIntoViewIfNeeded();
    await notes.evaluate((el) =>
      el.setAttribute("data-tab-stability", "original-live-form"),
    );
    const initialReads = profileReads;
    await page.evaluate((key) => {
      document.documentElement.dataset.tabSignins = "0";
      const channel = new BroadcastChannel(key);
      channel.onmessage = ({ data }) => {
        if (data.event === "SIGNED_IN")
          document.documentElement.dataset.tabSignins = String(
            Number(document.documentElement.dataset.tabSignins) + 1,
          );
      };
    }, authKey);
    for (let cycle = 0; cycle < 3; cycle++) {
      await page.evaluate(async () => {
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          get: () => "hidden",
        });
        window.dispatchEvent(new Event("visibilitychange"));
        await new Promise((resolve) => setTimeout(resolve, 100));
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          get: () => "visible",
        });
        window.dispatchEvent(new Event("visibilitychange"));
      });
      // Observe an actual SDK sign-in confirmation; no authentication or API mocks.
      await expect
        .poll(() =>
          page.evaluate(() =>
            Number(document.documentElement.dataset.tabSignins),
          ),
        )
        .toBeGreaterThanOrEqual(cycle + 1);
      await page.waitForTimeout(250);
      await expect(careTab).toHaveAttribute("aria-selected", "true");
      await expect(notes).toHaveAttribute(
        "data-tab-stability",
        "original-live-form",
      );
      expect(profileReads).toBe(initialReads);
    }
    await page.screenshot({
      path: test.info().outputPath("live-care-tab-retained.png"),
    });
    await writeFile(
      test.info().outputPath("live-result.json"),
      JSON.stringify(
        {
          checked_at: new Date().toISOString(),
          outcome: "passed",
          origin: baseURL,
          patient_id: patientId,
          record_mutations: 0,
          provider_mocks: false,
          tab_returns: 3,
          actual_sdk_signin_events: await page.evaluate(() =>
            Number(document.documentElement.dataset.tabSignins),
          ),
          care_tab_retained: true,
          original_form_retained: true,
          duplicate_profile_fetches: profileReads - initialReads,
          authentication:
            "Temporary session for existing synthetic medical officer; password login not tested.",
          note: "Existing synthetic case is closed; unsaved editable notes are verified separately by the mocked-provider regression.",
        },
        null,
        2,
      ) + "\n",
    );
  } finally {
    await account.client.auth.signOut({ scope: "local" });
  }
});
