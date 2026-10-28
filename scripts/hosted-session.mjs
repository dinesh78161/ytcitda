import { createClient } from "@supabase/supabase-js";

export const demoAccounts = {
  health_worker: "worker@aarohanytc.in",
  medical_officer: "doctor@aarohanytc.in",
  specialist: "specialist@aarohanytc.in",
  navigator: "navigator@aarohanytc.in",
  district_admin: "admin@aarohanytc.in",
};
export function hostedClients() {
  const {
    SUPABASE_URL: url,
    SUPABASE_PUBLISHABLE_KEY: key,
    SUPABASE_SECRET_KEY: secret,
  } = process.env;
  if (!url || !key || !secret)
    throw new Error("Configure .env.server with the three Supabase values.");
  const options = {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (url, init) =>
        fetch(url, { ...init, signal: AbortSignal.timeout(30000) }),
    },
  };
  return {
    admin: createClient(url, secret, options),
    user: () => createClient(url, key, options),
    url,
  };
}
export function checked(result, label) {
  if (result.error)
    throw new Error(
      `${label} failed (${result.error.code || result.error.status || "service error"}).`,
    );
  return result.data;
}
export async function demoSession(clients, role) {
  const profiles = checked(
    await clients.admin
      .from("profiles")
      .select("id,role,active")
      .eq("role", role)
      .eq("active", true),
    "Staff lookup",
  );
  let account;
  for (const profile of profiles) {
    const { user } = checked(
      await clients.admin.auth.admin.getUserById(profile.id),
      "Demo account lookup",
    );
    if (user?.email === demoAccounts[role]) {
      account = user;
      break;
    }
  }
  if (!account)
    throw new Error(
      `Provision the existing ${role} demo account using docs/SUPABASE_SETUP.md.`,
    );
  // Generates and consumes a token locally. Does not send email, create an account,
  // reset a password, or print/save credentials. Only known synthetic demo users.
  const link = checked(
    await clients.admin.auth.admin.generateLink({
      type: "magiclink",
      email: account.email,
    }),
    "Test-session token",
  );
  const client = clients.user();
  const { session } = checked(
    await client.auth.verifyOtp({
      token_hash: link.properties.hashed_token,
      type: "email",
    }),
    "Test sign-in",
  );
  if (!session || session.user.id !== account.id)
    throw new Error("Unexpected test-session identity.");
  return { client, session, role };
}
