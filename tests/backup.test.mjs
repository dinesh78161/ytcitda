import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { sealBackup, openBackup } from "../server/backup-archive.mjs";

test("backup encryption restores bytes exactly and rejects wrong passphrases and tampering", () => {
  const passphrase = randomBytes(32).toString("base64url"),
    files = {
      "schema.sql": Buffer.from("synthetic schema"),
      "storage/report.pdf": randomBytes(600),
    };
  const archive = sealBackup(files, { kind: "test" }, passphrase);
  assert.equal(archive.includes(files["schema.sql"]), false);
  const restored = openBackup(archive, passphrase);
  for (const [name, bytes] of Object.entries(files))
    assert.deepEqual(restored.files.get(name), bytes);
  assert.throws(
    () => openBackup(archive, randomBytes(32).toString("hex")),
    /authenticated/,
  );
  const damaged = Buffer.from(archive);
  damaged[damaged.length - 1] ^= 1;
  assert.throws(() => openBackup(damaged, passphrase), /authenticated/);
  assert.throws(
    () => sealBackup({ "../escape": Buffer.from("x") }, {}, passphrase),
    /entry name/,
  );
  assert.throws(() => sealBackup(files, {}, "short"), /passphrase/);
});
