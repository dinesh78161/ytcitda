import { openDB } from "idb";
import { normalizeIntake } from "./intake.ts";
import { isLanguage } from "./languages.ts";
import { hasConsent } from "./care-workflows.ts";
import { emptyData, type DataSet, type Draft, type Profile } from "./types.ts";

// The key is non-exportable, but same-origin scripts can still use it. This is
// encryption at rest, not protection against XSS or an unlocked shared device.
let database: ReturnType<typeof openDB> | undefined;
const offlineDatabase = () =>
  (database ??= openDB("aarogya-offline-v1", 1, {
    upgrade(db) {
      db.createObjectStore("keys");
      db.createObjectStore("records");
    },
  }));
const recordId = (scope: string, actor: string, name: string) =>
  JSON.stringify([scope, actor, name]);
async function deviceKey(scope: string, actor: string) {
  const db = await offlineDatabase(),
    id = recordId(scope, actor, "key");
  let key = (await db.get("keys", id)) as CryptoKey | undefined;
  if (!key) {
    const candidate = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
    // Serialize key installation across tabs; never replace an existing key.
    const tx = db.transaction("keys", "readwrite");
    key = (await tx.store.get(id)) as CryptoKey | undefined;
    if (!key) {
      key = candidate;
      await tx.store.put(key, id);
    }
    await tx.done;
  }
  return key;
}
export async function saveOffline(
  scope: string,
  actor: string,
  name: string,
  value: unknown,
) {
  const db = await offlineDatabase(),
    id = recordId(scope, actor, name);
  if (value === null) {
    await db.delete("records", id);
    return;
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(id) },
    await deviceKey(scope, actor),
    new TextEncoder().encode(JSON.stringify(value)),
  );
  await db.put("records", { iv, ciphertext }, id);
}
export async function loadOffline<T>(
  scope: string,
  actor: string,
  name: string,
): Promise<T | undefined> {
  const id = recordId(scope, actor, name),
    row = await (await offlineDatabase()).get("records", id);
  if (!row) return undefined;
  const plain = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: row.iv,
      additionalData: new TextEncoder().encode(id),
    },
    await deviceKey(scope, actor),
    row.ciphertext,
  );
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}
export async function offlineDrafts(scope: string, actor: string) {
  const keys = await (await offlineDatabase()).getAllKeys("records");
  const names = keys
    .map((key) => JSON.parse(String(key)) as string[])
    .filter(
      ([s, a, n]) => s === scope && a === actor && n.startsWith("queue:"),
    );
  const rows = await Promise.all(
    names.map(([, , n]) => loadOffline<Draft>(scope, actor, n)),
  );
  return rows
    .filter((row): row is Draft => Boolean(row))
    .sort(
      (a, b) =>
        (a.action === "image" ? 1 : 0) - (b.action === "image" ? 1 : 0) ||
        a.created_at.localeCompare(b.created_at) ||
        a.id.localeCompare(b.id),
    );
}
export const saveOfflineDraft = (scope: string, draft: Draft) =>
  saveOffline(scope, draft.actor, `queue:${draft.id}`, draft);
export const removeOfflineDraft = (scope: string, actor: string, id: string) =>
  saveOffline(scope, actor, `queue:${id}`, null);

export interface OfflineSession {
  profile: Profile;
  verified_at: number;
  data: DataSet;
}
export function validOfflineSession(
  session: OfflineSession | undefined,
  actor: string,
  expiresAt: number,
) {
  return Boolean(
    session &&
    session.profile.id === actor &&
    session.profile.active &&
    session.profile.role === "health_worker" &&
    expiresAt * 1000 > Date.now() &&
    session.verified_at <= Date.now() &&
    Date.now() - session.verified_at < 24 * 60 * 60 * 1000,
  );
}
// Cache only the worker's own screening records and consent, not signed reviews,
// reports, AI results, signed URLs, or the entire server workspace.
export function captureSnapshot(data: DataSet, actor: Profile): DataSet {
  const patients = data.patients.filter((p) => p.registered_by === actor.id);
  const ids = new Set(patients.map((p) => p.id));
  return {
    ...emptyData(),
    facilities: data.facilities,
    patients,
    screenings: data.screenings.filter((s) => ids.has(s.patient_id)),
    consents: data.consents.filter((c) => ids.has(c.patient_id)),
  };
}
export function projectDrafts(
  original: DataSet,
  actor: Profile,
  drafts: Draft[],
  clinical: boolean,
): DataSet {
  const data = structuredClone(original);
  for (const draft of drafts) {
    if (draft.actor !== actor.id) continue;
    const p = draft.payload,
      id = String(p.patient_id),
      language = isLanguage(p.language) ? p.language : "en";
    if (
      (draft.action ?? "register") === "register" &&
      !data.patients.some((row) => row.id === id)
    ) {
      data.patients.unshift({
        id,
        display_name: String(p.display_name),
        age_years: Number(p.age_years),
        village: String(p.village),
        mandal: p.mandal ? String(p.mandal) : null,
        habitation: p.habitation ? String(p.habitation) : null,
        subcenter: p.subcenter ? String(p.subcenter) : null,
        abha_id: p.abha_id ? String(p.abha_id) : null,
        aadhaar_last4: p.aadhaar_last4 ? String(p.aadhaar_last4) : null,
        contact_phone: String(p.contact_phone ?? ""),
        preferred_language: language,
        facility_id: actor.facility_id,
        registered_by: actor.id,
        is_synthetic: !clinical,
        created_at: draft.created_at,
      });
      data.screenings.unshift({
        id: String(p.screening_id),
        patient_id: id,
        examiner_id: actor.id,
        status: "awaiting_clinician",
        examination_notes: String(p.notes ?? ""),
        ...normalizeIntake(p),
        revision: 1,
        created_at: draft.created_at,
      });
      for (const purpose of [
        "screening",
        ...(p.photo_consent === true ? ["image_capture"] : []),
      ])
        data.consents.push({
          id: `${draft.id}:${purpose}`,
          patient_id: id,
          purpose,
          granted: true,
          language,
          recorded_at: draft.created_at,
        });
    }
    if (
      draft.action === "image" &&
      !data.images.some((row) => row.id === draft.id)
    ) {
      const screening = data.screenings
        .filter((s) => s.patient_id === id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      if (
        !screening ||
        !hasConsent(data, id, "image_capture") ||
        !hasConsent(data, id, "screening")
      )
        continue;
      data.images.push({
        id: draft.id,
        patient_id: id,
        screening_id: screening.id,
        object_key: "",
        quality_status:
          p.quality_status === "acceptable" ? "acceptable" : "recapture",
        quality_details: p.quality_details as Record<string, unknown>,
        oral_view: String(p.oral_view ?? "cheek"),
        preview: String(p.preview),
        created_at: draft.created_at,
        pending_sync: true,
      });
    }
  }
  return data;
}
