import { createHash } from "node:crypto";
import { HttpError, requireValue } from "./validation.mjs";

// The object and metadata share a stable ID. A lost response or a process restart
// can be retried without creating another image or deleting a committed object.
export async function storePrivateUpload(
  admin,
  kind,
  metadata,
  bytes,
  actorId,
) {
  const table = kind === "oral" ? "images" : "patient_documents";
  const bucket = kind === "oral" ? "oral-images" : "pathology-reports";
  const existing = async () => {
    const { data, error } = await admin
      .from(table)
      .select("*")
      .eq("id", metadata.id)
      .maybeSingle();
    if (error)
      throw new HttpError(
        502,
        "Unable to check the upload. Retry with the same file.",
      );
    if (!data) return null;
    const fields =
      kind === "oral"
        ? ["patient_id", "sha256", "object_key", "oral_view"]
        : [
            "patient_id",
            "sha256",
            "object_key",
            "investigation_id",
            "name",
            "mime_type",
          ];
    requireValue(
      data.uploaded_by === actorId &&
        fields.every((key) => (data[key] ?? null) === (metadata[key] ?? null)),
      409,
      "This upload ID belongs to a different file or record.",
    );
    return {
      id: data.id,
      ...(kind === "oral" ? { quality_status: data.quality_status } : {}),
    };
  };
  const replay = await existing();
  if (replay) return replay;
  const storage = admin.storage.from(bucket);
  const uploaded = await storage.upload(metadata.object_key, bytes, {
    contentType: metadata.mime_type,
    upsert: false,
  });
  if (uploaded.error) {
    const duplicate =
      String(uploaded.error.statusCode ?? uploaded.error.status) === "409" ||
      uploaded.error.error === "Duplicate";
    requireValue(
      duplicate,
      502,
      "The file store is unavailable. Retry with the same file.",
    );
    const object = await storage.download(metadata.object_key);
    requireValue(
      !object.error && object.data,
      502,
      "Unable to resume the upload. Retry with the same file.",
    );
    const checksum = createHash("sha256")
      .update(Buffer.from(await object.data.arrayBuffer()))
      .digest("hex");
    requireValue(
      checksum === metadata.sha256,
      409,
      "This upload ID belongs to a different file.",
    );
  }
  const committed = await admin.rpc("record_private_file", {
    actor_id: actorId,
    kind,
    metadata,
  });
  if (committed.error) {
    // Another instance may have committed the same request while we uploaded.
    const replay = await existing();
    if (replay) return replay;
    // Keep the private object for a retry; deleting here could race a successful
    // commit on another instance. Unreferenced objects need periodic reconciliation.
    throw new HttpError(
      502,
      "The upload was not confirmed. Retry with the same file.",
    );
  }
  return {
    id: metadata.id,
    ...(kind === "oral" ? { quality_status: metadata.quality_status } : {}),
  };
}
