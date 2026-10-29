import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { sealBackup, openBackup } from "../server/backup-archive.mjs";

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
export function registerRecoveryTests({ db, uid }) {
  test("encrypted PostgreSQL snapshot restores all data, request ledger, MFA policies and private blob bytes in isolation", async () => {
    const started = Date.now();
    const tables = (
      await db.query(
        "select schemaname,tablename from pg_tables where schemaname in ('public','app_private','auth','storage') order by schemaname,tablename",
      )
    ).rows;
    const capture = async (database) => {
      const hashes = {};
      for (const { schemaname, tablename } of tables) {
        assert.match(schemaname, /^[a-z_]+$/);
        assert.match(tablename, /^[a-z_]+$/);
        const rows = (
          await database.query(
            `select row_to_json(t)::text as row from ${schemaname}.${tablename} t order by row_to_json(t)::text`,
          )
        ).rows;
        hashes[schemaname + "." + tablename] = {
          rows: rows.length,
          sha256: sha(JSON.stringify(rows)),
        };
      }
      return hashes;
    };
    const initial = await db.dumpDataDir("gzip");
    const source = new PGlite({ loadDataDir: initial });
    let snapshot, expected, original;
    const request = crypto.randomUUID(),
      payload = {
        village: "Synthetic recovery fixture",
        held_on: "2026-01-01",
        attendees: 2,
        screened: 1,
      };
    try {
      await source.waitReady;
      await source.exec("begin; set local role authenticated");
      await source.query(
        "select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",
        [uid(1), JSON.stringify({ sub: uid(1), aal: "aal1" })],
      );
      original = (
        await source.query(
          "select public.submit_workflow($1,'outreach',$2::jsonb) as result",
          [request, JSON.stringify(payload)],
        )
      ).rows[0].result;
      await source.exec("commit");
      expected = await capture(source);
      assert.ok(expected["app_private.workflow_requests"].rows > 0);
      snapshot = await source.dumpDataDir("gzip");
    } finally {
      await source.close();
    }
    const blob = Buffer.from(
      "SYNTHETIC PRIVATE REPORT; isolated recovery fixture only",
    );
    const passphrase = randomBytes(32).toString("base64url");
    const encrypted = sealBackup(
      {
        "database/pglite.tar.gz": Buffer.from(await snapshot.arrayBuffer()),
        "storage/pathology-reports/synthetic-report.txt": blob,
      },
      {
        kind: "isolated-pglite-rehearsal",
        created_at: new Date().toISOString(),
      },
      passphrase,
    );
    const recovered = openBackup(encrypted, passphrase);
    assert.deepEqual(
      recovered.files.get("storage/pathology-reports/synthetic-report.txt"),
      blob,
    );
    const restored = new PGlite({
      loadDataDir: new Blob([recovered.files.get("database/pglite.tar.gz")]),
    });
    try {
      await restored.waitReady;
      assert.deepEqual(await capture(restored), expected);
      assert.equal(
        (
          await restored.query(
            "select count(*)::int n from pg_policies where policyname='require_privileged_mfa'",
          )
        ).rows[0].n,
        19,
      );
      await restored.exec("begin; set local role authenticated");
      await restored.query(
        "select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",
        [uid(1), JSON.stringify({ sub: uid(1), aal: "aal1" })],
      );
      assert.deepEqual(
        (
          await restored.query(
            "select public.submit_workflow($1,'outreach',$2::jsonb) as result",
            [request, JSON.stringify(payload)],
          )
        ).rows[0].result,
        original,
      );
      await restored.exec("commit");
      assert.deepEqual(
        await capture(restored),
        expected,
        "Retry after restore must not duplicate data or audit history",
      );
      for (const [role, actor, aal, expectedCount] of [
        ["authenticated", uid(2), "aal1", 0],
        ["authenticated", uid(2), "aal2", 12],
        ["authenticated", uid(1), "aal1", 12],
      ]) {
        await restored.exec(`begin; set local role ${role}`);
        try {
          await restored.query(
            "select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",
            [actor, JSON.stringify({ sub: actor, aal })],
          );
          assert.equal(
            (
              await restored.query(
                "select count(*)::int n from public.patients",
              )
            ).rows[0].n,
            expectedCount,
          );
          await assert.rejects(
            () =>
              restored.query(
                "update public.clinical_reviews set findings='forged'",
              ),
            (e) => e.code === "42501",
          );
        } finally {
          await restored.exec("rollback");
        }
      }
      const report = {
        scope:
          "isolated PGlite PostgreSQL and synthetic external blob; not hosted Supabase disaster recovery",
        checked_at: new Date().toISOString(),
        elapsed_ms: Date.now() - started,
        tables: expected,
        application_tables: tables.filter((t) => t.schemaname === "public")
          .length,
        private_blob_sha256: sha(blob),
        request_ledger_preserved: true,
        mfa_policies: 19,
        rls_and_immutable_history: "passed",
        archive_encryption_and_authentication: "passed",
      };
      await mkdir(new URL("../test-results/recovery/", import.meta.url), {
        recursive: true,
      });
      await writeFile(
        new URL(
          "../test-results/recovery/restore-rehearsal.json",
          import.meta.url,
        ),
        JSON.stringify(report, null, 2) + "\n",
      );
    } finally {
      await restored.close();
    }
  });
}
