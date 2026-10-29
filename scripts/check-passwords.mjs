import { createClient } from "@supabase/supabase-js";
import { demoAccounts } from "./hosted-session.mjs";

const options = {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: (url, init) =>
      fetch(url, { ...init, signal: AbortSignal.timeout(30000) }),
  },
};
try {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY)
    throw new Error(
      "Configure the existing Supabase URL and publishable key in .env.server.",
    );
  const missing = Object.keys(demoAccounts).filter(
    (role) => !process.env[`DEMO_PASSWORD_${role.toUpperCase()}`],
  );
  if (missing.length)
    throw new Error(
      "Copy .env.acceptance.example to .env.acceptance and enter the five existing demo passwords locally. No passwords have been tried or reset.",
    );
  for (const [role, email] of Object.entries(demoAccounts)) {
    const client = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_PUBLISHABLE_KEY,
      options,
    );
    try {
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password: process.env[`DEMO_PASSWORD_${role.toUpperCase()}`],
      });
      if (error || !data.session || data.user?.email !== email)
        throw new Error(
          `Password sign-in failed for ${role}. No further attempt was made for this account.`,
        );
      const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance.error)
        throw new Error(`Could not inspect session assurance for ${role}.`);
      console.log(
        `PASS: ${role} normal password sign-in; assurance=${assurance.data.currentLevel}.`,
      );
    } finally {
      await client.auth.signOut({ scope: "local" });
    }
  }
  console.log(
    "PASS: all five first-factor passwords verified. Privileged authenticator verification remains a separate step.",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
