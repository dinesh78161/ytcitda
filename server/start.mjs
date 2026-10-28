import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createApi, createServices } from "./index.mjs";

const dist = new URL("../dist/", import.meta.url);
await access(new URL("index.html", dist));
for (const name of [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
]) {
  if (!process.env[name] || process.env[name].includes("YOUR_"))
    throw new Error(`Set ${name} in the hosting environment.`);
}
const port = Number(process.env.PORT || process.env.API_PORT || 8787);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("Invalid server port.");
const services = createServices();
const server = createApi(services, process.env, {
  staticDir: fileURLToPath(dist),
});
server.listen(port, "0.0.0.0", () =>
  console.log(`Aarogya Drishti web and API server listening on port ${port}`),
);
const timer = setInterval(
  () =>
    services
      .dispatchReminders()
      .catch(() =>
        console.error("Reminder dispatch failed; delivery will retry."),
      ),
  60000,
);
timer.unref();
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    clearInterval(timer);
    server.close();
    setTimeout(() => process.exit(0), 10000).unref();
  });
