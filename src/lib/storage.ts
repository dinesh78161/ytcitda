import { openDB } from "idb";
import type { Command, Draft, Profile } from "./types";
import { applyDemoCommand, createDemo } from "./demo";
import { emptyData } from "./types";
import { scheduleReminder } from "./care-workflows";
import { syncStages } from "./journey";
const database = openDB("aarogya-synthetic-workspace", 1, {
  upgrade(db) {
    db.createObjectStore("kv");
    db.createObjectStore("queue", { keyPath: "id" });
  },
});
export async function getLocal<T>(key: string): Promise<T | undefined> {
  return (await database).get("kv", key);
}
export async function setLocal(key: string, value: unknown) {
  await (await database).put("kv", value, key);
}
export async function loadDemo() {
  let data = await getLocal<ReturnType<typeof createDemo>>("demo-v1");
  if (!data) {
    data = createDemo();
    await setLocal("demo-v1", data);
  }
  if (!data.appointment_reminders) {
    data = { ...emptyData(), ...data };
    for (const appointment of data.appointments)
      scheduleReminder(data, appointment.id, new Date().toISOString());
    await setLocal("demo-v1", data);
  }
  return syncStages({ ...emptyData(), ...data });
}
export async function mutateDemo(profile: Profile, command: Command) {
  const db = await database,
    tx = db.transaction("kv", "readwrite");
  const data = (await tx.store.get("demo-v1")) ?? createDemo();
  const processed: string[] = (await tx.store.get("demo-processed")) ?? [];
  if (processed.includes(command.id)) {
    await tx.done;
    return data;
  }
  try {
    const next = applyDemoCommand(data, profile, command);
    await tx.store.put(next, "demo-v1");
    await tx.store.put([...processed, command.id], "demo-processed");
    await tx.done;
    return next;
  } catch (error) {
    tx.abort();
    await tx.done.catch(() => {});
    throw error;
  }
}
export async function resetDemo() {
  const db = await database;
  const tx = db.transaction(["kv", "queue"], "readwrite");
  await tx.objectStore("kv").put(createDemo(), "demo-v1");
  await tx.objectStore("kv").put([], "demo-processed");
  for (const key of await tx.objectStore("kv").getAllKeys())
    if (String(key).startsWith("form:demo:"))
      await tx.objectStore("kv").delete(key);
  for (const row of await tx.objectStore("queue").getAll())
    if (row.scope === "demo") await tx.objectStore("queue").delete(row.id);
  await tx.done;
}
export async function queueDraft(draft: Draft, scope: string) {
  await (await database).put("queue", { ...draft, scope });
}
export async function listDrafts(
  actor: string,
  scope: string,
): Promise<Draft[]> {
  return (await (await database).getAll("queue")).filter(
    (d) => d.actor === actor && d.scope === scope,
  );
}
export async function removeDraft(id: string) {
  await (await database).delete("queue", id);
}
