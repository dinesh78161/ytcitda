import assert from "node:assert/strict";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { createServices } from "../server/index.mjs";

function totp(secret) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secret.toUpperCase().replace(/=+$/, "")) {
    const digit = alphabet.indexOf(c);
    if (digit < 0)
      throw new Error("Unsupported authenticator secret encoding.");
    bits += digit.toString(2).padStart(5, "0");
  }
  const bytes = Buffer.from(
    (bits.match(/.{8}/g) || []).map((value) => parseInt(value, 2)),
  );
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac("sha1", bytes).update(counter).digest(),
    offset = digest[digest.length - 1] & 15;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, "0");
}
const check = (response, label) => {
  if (response.error)
    throw new Error(
      `${label} failed (${response.error.code || response.error.status || "service error"}).`,
    );
  return response.data;
};
const options = {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: (url, init) =>
      fetch(url, { ...init, signal: AbortSignal.timeout(30000) }),
  },
};
let admin,
  user,
  userId,
  profileCreated = false,
  success = false,
  report;
try {
  if (!process.argv.includes("--write"))
    throw new Error(
      "Add --write to create and remove one temporary synthetic Auth/profile fixture. No existing staff factors or passwords are changed.",
    );
  const {
    SUPABASE_URL: url,
    SUPABASE_SECRET_KEY: secret,
    SUPABASE_PUBLISHABLE_KEY: key,
  } = process.env;
  if (!url || !secret || !key)
    throw new Error("Configure the existing Supabase settings in .env.server.");
  admin = createClient(url, secret, options);
  user = createClient(url, key, options);
  const facility = check(
    await admin.from("facilities").select("id").order("id").limit(1),
    "Facility lookup",
  )[0];
  assert.ok(facility, "An existing synthetic facility is required");
  const email = `synthetic-mfa-${randomUUID()}@aarohanytc.in`,
    password = randomBytes(32).toString("base64url");
  const created = check(
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { synthetic_acceptance: true },
    }),
    "Temporary account creation",
  );
  userId = created.user.id;
  check(
    await admin
      .from("profiles")
      .insert({
        id: userId,
        display_name: "Synthetic MFA acceptance",
        role: "medical_officer",
        facility_id: facility.id,
        active: true,
      }),
    "Temporary profile creation",
  );
  profileCreated = true;
  const signed = check(
    await user.auth.signInWithPassword({ email, password }),
    "Normal password sign-in",
  );
  assert.equal(
    (await user.auth.mfa.getAuthenticatorAssuranceLevel()).data.currentLevel,
    "aal1",
  );
  const services = createServices();
  await assert.rejects(
    () => services.authenticate(signed.session.access_token),
    (e) => e.status === 403,
  );
  const enrolled = check(
    await user.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Synthetic acceptance only",
    }),
    "Temporary TOTP enrollment",
  );
  const correct = totp(enrolled.totp.secret),
    wrong = ((Number(correct) + 1) % 1000000).toString().padStart(6, "0");
  const bad = await user.auth.mfa.challengeAndVerify({
    factorId: enrolled.id,
    code: wrong,
  });
  assert.ok(bad.error, "Incorrect code must be rejected");
  check(
    await user.auth.mfa.challengeAndVerify({
      factorId: enrolled.id,
      code: totp(enrolled.totp.secret),
    }),
    "Correct TOTP verification",
  );
  const elevated = check(
    await user.auth.getSession(),
    "Elevated session",
  ).session;
  assert.equal(
    (await user.auth.mfa.getAuthenticatorAssuranceLevel()).data.currentLevel,
    "aal2",
  );
  assert.equal(
    (await services.authenticate(elevated.access_token)).profile.id,
    userId,
  );
  const policy = await user.rpc("security_policy");
  report = {
    checked_at: new Date().toISOString(),
    scope:
      "actual hosted Supabase Auth and updated local API assurance guard; temporary synthetic account",
    password_sign_in: "passed for temporary account; team passwords untouched",
    wrong_code_rejected: true,
    totp_enrollment_and_aal2: "passed",
    api_aal1_denial_and_aal2_access: "passed",
    database_mfa_migration_installed:
      !policy.error && policy.data?.privileged_mfa === true,
    fixture_removed: false,
  };
  success = true;
  console.log(
    "PASS: actual hosted password sign-in, TOTP enrollment, wrong-code rejection, AAL2 promotion, and local API assurance enforcement.",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (user) await user.auth.signOut({ scope: "local" });
  if (userId && admin) {
    try {
      if (profileCreated)
        check(
          await admin.from("profiles").delete().eq("id", userId),
          "Temporary profile cleanup",
        );
      check(
        await admin.auth.admin.deleteUser(userId),
        "Temporary Auth cleanup",
      );
      if (report) report.fixture_removed = true;
      console.log(
        "Temporary synthetic account/profile removed; existing staff accounts unchanged.",
      );
    } catch {
      console.error(
        "Temporary fixture cleanup needs inspection; existing staff accounts were not modified.",
      );
      process.exitCode = 1;
    }
  }
  if (success && report) {
    await mkdir(new URL("../test-results/security/", import.meta.url), {
      recursive: true,
    });
    await writeFile(
      new URL("../test-results/security/hosted-mfa.json", import.meta.url),
      JSON.stringify(report, null, 2) + "\n",
    );
    if (!report.database_mfa_migration_installed)
      console.log(
        "PENDING: apply migration 006 to enforce MFA in the hosted database. Local PostgreSQL enforcement tests cover the migration.",
      );
  }
}
