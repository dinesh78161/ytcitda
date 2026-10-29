import { spawnSync } from "node:child_process";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
if (
  !url?.startsWith("https://") ||
  url.includes("YOUR_") ||
  !key ||
  key.includes("YOUR_") ||
  key.startsWith("sb_secret_")
) {
  throw new Error(
    "Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY before building. Never use the server secret as the publishable key.",
  );
}
if (key.startsWith("eyJ")) {
  try {
    if (
      JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString())
        .role !== "anon"
    )
      throw new Error();
  } catch {
    throw new Error(
      "The browser requires a publishable/anon key, never a service-role key.",
    );
  }
}
const env = {
  ...process.env,
  VITE_APP_MODE: "supabase",
  VITE_WORKSPACE_MODE: process.env.WORKSPACE_MODE || "evaluation",
  VITE_SUPABASE_URL: url,
  VITE_SUPABASE_PUBLISHABLE_KEY: key,
};
for (const args of [
  ["node_modules/typescript/bin/tsc", "--noEmit"],
  ["node_modules/vite/bin/vite.js", "build"],
]) {
  const result = spawnSync(process.execPath, args, {
    env,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
