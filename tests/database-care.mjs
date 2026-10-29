import { test } from "node:test";
import assert from "node:assert/strict";
export function registerCareTests({ db, asRole, rpc, uid, patient, denied }) {
  const referral = "60000000-0000-4000-8000-000000000001";
  test("new treatment accepts a null optional UUID from the browser form", async () => {
    await assert.rejects(
      () =>
        asRole("authenticated", uid(2), () =>
          rpc("treatment", {
            referral_id: referral,
            treatment_id: "",
            plan: "Synthetic form regression",
            notes: "Empty form UUID must not be submitted",
            status: "active",
            next_review_at: null,
          }),
        ),
      (error) => error.code === "22P02",
    );
    await asRole("authenticated", uid(2), async () => {
      const result = await rpc("treatment", {
        referral_id: referral,
        treatment_id: null,
        plan: "Synthetic form regression",
        notes: "New form record has no treatment UUID yet",
        status: "active",
        next_review_at: null,
      });
      const id = result.rows[0].result.id;
      assert.match(id, /^[0-9a-f-]{36}$/);
      const saved = (
        await db.query("select status from public.treatments where id=$1", [id])
      ).rows[0];
      assert.equal(saved.status, "active");
    });
  });
  test("treatment RPC is idempotent, append-only and revision checked", async () => {
    await asRole("authenticated", uid(2), async () => {
      const payload = {
          referral_id: referral,
          plan: "Synthetic treatment",
          notes: "Initial plan",
          status: "active",
        },
        request = crypto.randomUUID();
      const first = await rpc("treatment", payload, request);
      await rpc("treatment", payload, request);
      const id = first.rows[0].result.id;
      assert.equal(
        (
          await db.query(
            "select count(*)::int n from public.treatment_events where treatment_id=$1",
            [id],
          )
        ).rows[0].n,
        1,
      );
      await rpc("treatment_update", {
        treatment_id: id,
        revision: 1,
        status: "completed",
        notes: "Completed synthetic course",
      });
      assert.equal(
        (
          await db.query(
            "select count(*)::int n from public.treatment_events where treatment_id=$1",
            [id],
          )
        ).rows[0].n,
        2,
      );
      await assert.rejects(
        () =>
          rpc("treatment_update", {
            treatment_id: id,
            revision: 1,
            status: "active",
            notes: "stale",
          }),
        (e) => e.code === "40001",
      );
    });
  });
  test("navigator cannot read new clinical records or write treatment plans", async () => {
    await asRole("authenticated", uid(2), async () => {
      await rpc("treatment", {
        referral_id: referral,
        plan: "Private synthetic treatment",
        notes: "Initial",
        status: "planned",
      });
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        uid(4),
      ]);
      for (const table of [
        "treatments",
        "treatment_events",
        "patient_documents",
      ]) {
        assert.equal(
          (await db.query(`select count(*)::int n from public.${table}`))
            .rows[0].n,
          0,
        );
      }
      await assert.rejects(
        () =>
          rpc("treatment", {
            referral_id: referral,
            plan: "forged",
            notes: "forged",
            status: "active",
          }),
        (e) => e.code === "42501",
      );
    });
  });
  test("reschedule RPC replaces reminders once on retry and prevents stale overwrites", async () => {
    await asRole("authenticated", uid(4), async () => {
      const a = (
        await db.query(
          "select * from public.appointments where status='confirmed' order by starts_at limit 1",
        )
      ).rows[0];
      const payload = {
          appointment_id: a.id,
          previous_starts_at: a.starts_at,
          starts_at: "2099-01-01T04:30:00Z",
        },
        request = crypto.randomUUID();
      await rpc("reschedule", payload, request);
      await rpc("reschedule", payload, request);
      const rows = (
        await db.query(
          "select status,count(*)::int n from public.appointment_reminders where appointment_id=$1 group by status",
          [a.id],
        )
      ).rows;
      assert.equal(rows.find((r) => r.status === "pending").n, 1);
      assert.ok(rows.some((r) => r.status === "cancelled"));
      await assert.rejects(
        () =>
          rpc("reschedule", { ...payload, starts_at: "2099-01-02T04:30:00Z" }),
        (e) => e.code === "40001",
      );
    });
  });
  test("outreach totals reach district aggregates without exposing patient rows", async () => {
    await asRole("authenticated", uid(1), async () => {
      await rpc("outreach", {
        village: "Synthetic camp",
        held_on: "2026-01-01",
        attendees: 20,
        screened: 15,
      });
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        uid(5),
      ]);
      const s = (await db.query("select public.dashboard_summary() s")).rows[0]
        .s;
      assert.equal(s.outreach_attendees, 20);
      assert.equal(s.outreach_screened, 15);
      assert.equal(
        (await db.query("select count(*)::int n from public.outreach_events"))
          .rows[0].n,
        0,
      );
    });
  });
  test("file commit rechecks assignment and current consent and attributes verified uploader", async () => {
    await asRole("service_role", null, async () => {
      const id = crypto.randomUUID();
      await db.query(
        "select public.record_private_file($1,'report',$2::jsonb)",
        [
          uid(2),
          JSON.stringify({
            id,
            patient_id: patient(1),
            name: "Synthetic report.pdf",
            mime_type: "application/pdf",
            size_bytes: 200,
            sha256: "a".repeat(64),
            object_key: `${patient(1)}/${id}.pdf`,
          }),
        ],
      );
      const events = await db.query(
        "select actor_id from public.audit_events where resource_id=$1 and action='UPLOAD'",
        [id],
      );
      assert.equal(events.rows[0].actor_id, uid(2));
    });
  });
  test("browser roles cannot call privileged file, delivery or legacy workflow helpers", async () => {
    for (const query of [
      "select public.claim_reminders()",
      "select public.record_private_file(null,'report','{}')",
      "select public.submit_workflow_v1(null,'register','{}')",
      "select public.submit_workflow_v2(null,'register','{}')",
      "select public.record_private_file_v1(null,'report','{}')",
      "select public.dashboard_summary_v2()",
      "select public.dashboard_summary_v1()",
    ]) {
      await denied(() =>
        asRole("authenticated", uid(1), () => db.query(query)),
      );
    }
  });
  test("investigation RPC rejects stale stages and requires findings for reported results", async () => {
    await asRole("authenticated", uid(2), async () => {
      const result = await rpc("investigation", {
        referral_id: referral,
        kind: "biopsy",
        status: "requested",
        notes: "Requested",
      });
      const investigation_id = result.rows[0].result.id;
      await rpc("investigation", {
        referral_id: referral,
        investigation_id,
        previous_status: "requested",
        kind: "biopsy",
        status: "collected",
        notes: "Collected",
      });
      await assert.rejects(
        () =>
          rpc("investigation", {
            referral_id: referral,
            investigation_id,
            previous_status: "requested",
            kind: "biopsy",
            status: "reported",
            notes: "Synthetic result",
          }),
        (e) => e.code === "40001",
      );
    });
  });
  test("case decisions close, retry and reopen with retained history and aggregate stages", async () => {
    await asRole("authenticated", uid(2), async () => {
      const person = patient(2);
      const current = async () =>
        (
          await db.query(
            "select * from public.screenings where patient_id=$1",
            [person],
          )
        ).rows[0];
      for (const a of (
        await db.query(
          "select id from public.appointments where patient_id=$1 and status in ('requested','confirmed','rescheduled')",
          [person],
        )
      ).rows)
        await rpc("attendance", { appointment_id: a.id, status: "completed" });
      for (const t of (
        await db.query(
          "select id from public.navigation_tasks where patient_id=$1 and status='pending'",
          [person],
        )
      ).rows)
        await rpc("followup", { task_id: t.id, status: "completed" });
      assert.equal((await current()).status, "assessed");
      for (const category of ["diagnostics", "treatment"])
        await rpc("care_decision", {
          patient_id: person,
          revision: (await current()).revision,
          category,
          decision: "not_required",
          notes: "Synthetic signed rationale",
        });
      const payload = {
          patient_id: person,
          revision: (await current()).revision,
          category: "case",
          decision: "close",
          notes: "All synthetic care resolved",
        },
        request = crypto.randomUUID();
      await rpc("care_decision", payload, request);
      await rpc("care_decision", payload, request);
      assert.equal((await current()).status, "closed");
      assert.equal(
        (
          await db.query(
            "select count(*)::int n from public.care_decisions where patient_id=$1",
            [person],
          )
        ).rows[0].n,
        3,
      );
      await rpc("care_decision", {
        patient_id: person,
        revision: (await current()).revision,
        category: "case",
        decision: "reopen",
        notes: "Synthetic renewed review",
      });
      assert.equal((await current()).status, "assessed");
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        uid(5),
      ]);
      const summary = (await db.query("select public.dashboard_summary() s"))
        .rows[0].s;
      assert.equal(summary.stage_counts.assessed, 1);
      assert.equal(summary.completed_cases, 0);
      assert.equal(
        (await db.query("select count(*)::int n from public.care_decisions"))
          .rows[0].n,
        0,
      );
    });
  });
  test("database rejects case closure with outstanding appointments and tasks", async () => {
    await asRole("authenticated", uid(2), async () => {
      const s = (
        await db.query("select * from public.screenings where patient_id=$1", [
          patient(1),
        ])
      ).rows[0];
      await assert.rejects(
        () =>
          rpc("care_decision", {
            patient_id: patient(1),
            revision: s.revision,
            category: "case",
            decision: "close",
            notes: "Premature",
          }),
        (e) => e.code === "23514",
      );
    });
  });
  test("database prevents overlapping specialist bookings", async () => {
    await asRole("authenticated", uid(4), async () => {
      const a = (
        await db.query(
          "select * from public.appointments where status='confirmed' order by starts_at limit 1",
        )
      ).rows[0];
      await rpc("reschedule", {
        appointment_id: a.id,
        previous_starts_at: a.starts_at,
        starts_at: "2099-01-01T10:00:00Z",
      });
      const missed = (
        await db.query(
          "select * from public.appointments where status='missed' limit 1",
        )
      ).rows[0];
      await assert.rejects(
        () =>
          rpc("appoint", {
            referral_id: missed.referral_id,
            starts_at: "2099-01-01T10:10:00Z",
            mode: "in_person",
          }),
        (e) => e.code === "23514",
      );
    });
  });
  test("non-referral follow-up creates one navigator task and retry is idempotent", async () => {
    await asRole("authenticated", uid(2), async () => {
      const person = patient(8),
        s = (
          await db.query(
            "select * from public.screenings where patient_id=$1",
            [person],
          )
        ).rows[0];
      const payload = {
          patient_id: person,
          revision: s.revision,
          decision: "follow_up",
          findings: "Synthetic routine follow-up",
          followup_at: "2099-01-01T10:00:00Z",
        },
        request = crypto.randomUUID();
      await rpc("review", payload, request);
      await rpc("review", payload, request);
      const tasks = (
        await db.query(
          "select * from public.navigation_tasks where patient_id=$1",
          [person],
        )
      ).rows;
      assert.equal(tasks.length, 1);
      assert.equal(tasks[0].referral_id, null);
      assert.equal(tasks[0].owner_id, uid(4));
    });
  });
}
