import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { storePrivateUpload } from "../server/private-upload.mjs";

function fixture() {
  const objects = new Map(),
    rows = new Map();
  let failCommit = false,
    commits = 0;
  const actor = randomUUID(),
    id = randomUUID(),
    person = randomUUID();
  const bytes = Buffer.from("synthetic encoded test file");
  const metadata = {
    id,
    patient_id: person,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    object_key: `${person}/${id}.jpg`,
    oral_view: "cheek",
    quality_status: "acceptable",
    mime_type: "image/jpeg",
  };
  const admin = {
    from: () => {
      let id;
      const q = {
        select: () => q,
        eq: (_, value) => {
          id = value;
          return q;
        },
        maybeSingle: async () => ({ data: rows.get(id) ?? null, error: null }),
      };
      return q;
    },
    storage: {
      from: () => ({
        upload: async (key, value) => {
          if (objects.has(key)) return { error: { statusCode: "409" } };
          objects.set(key, value);
          return { error: null };
        },
        download: async (key) => ({
          data: new Blob([objects.get(key)]),
          error: null,
        }),
      }),
    },
    rpc: async (_, { metadata, actor_id }) => {
      if (failCommit) return { error: { code: "network" } };
      if (rows.has(metadata.id)) return { error: { code: "23505" } };
      rows.set(metadata.id, { ...metadata, uploaded_by: actor_id });
      commits++;
      return { error: null, data: metadata.id };
    },
  };
  return {
    admin,
    objects,
    rows,
    actor,
    metadata,
    bytes,
    set failCommit(value) {
      failCommit = value;
    },
    get commits() {
      return commits;
    },
    run: () => storePrivateUpload(admin, "oral", metadata, bytes, actor),
  };
}
test("replayed and simultaneous uploads create one object and one durable record", async () => {
  const f = fixture();
  const results = await Promise.all([f.run(), f.run()]);
  assert.deepEqual(results[0], results[1]);
  assert.deepEqual(await f.run(), results[0]);
  assert.equal(f.objects.size, 1);
  assert.equal(f.rows.size, 1);
  assert.equal(f.commits, 1);
});
test("upload recovers after object write succeeded but metadata confirmation failed", async () => {
  const f = fixture();
  f.failCommit = true;
  await assert.rejects(f.run, (e) => e.status === 502);
  assert.equal(f.rows.size, 0);
  assert.equal(f.objects.size, 1);
  f.failCommit = false;
  await f.run();
  assert.equal(f.rows.size, 1);
  assert.equal(f.objects.size, 1);
});
test("request ID reuse cannot substitute the actor, patient or bytes of an existing file", async () => {
  const f = fixture();
  await f.run();
  for (const [metadata, actor] of [
    [f.metadata, randomUUID()],
    [{ ...f.metadata, patient_id: randomUUID() }, f.actor],
    [{ ...f.metadata, sha256: "a".repeat(64) }, f.actor],
  ]) {
    await assert.rejects(
      () => storePrivateUpload(f.admin, "oral", metadata, f.bytes, actor),
      (e) => e.status === 409,
    );
  }
  assert.equal(f.commits, 1);
});
test("retry refuses an uncommitted object whose bytes differ", async () => {
  const f = fixture();
  f.objects.set(f.metadata.object_key, Buffer.from("different file"));
  await assert.rejects(f.run, (e) => e.status === 409);
  assert.equal(f.commits, 0);
});
