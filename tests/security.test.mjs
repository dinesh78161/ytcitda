import { test } from "node:test";
import assert from "node:assert/strict";
import {
  enforceVerifiedAssurance,
  privilegedRoles,
} from "../server/security.mjs";

const id = "00000000-0000-4000-8000-000000000002";
const jwt = (claims) =>
  `verified.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;
test("API requires verified AAL2 for every privileged role and rejects mismatched identity", () => {
  for (const role of privilegedRoles) {
    const profile = { id, role };
    for (const claims of [{ sub: id }, { sub: id, aal: "aal1" }])
      assert.throws(
        () => enforceVerifiedAssurance(jwt(claims), id, profile),
        (e) => e.status === 403,
      );
    assert.doesNotThrow(() =>
      enforceVerifiedAssurance(jwt({ sub: id, aal: "aal2" }), id, profile),
    );
    assert.throws(
      () =>
        enforceVerifiedAssurance(
          jwt({ sub: "different", aal: "aal2" }),
          id,
          profile,
        ),
      (e) => e.status === 401,
    );
    assert.throws(
      () => enforceVerifiedAssurance("malformed", id, profile),
      (e) => e.status === 401,
    );
  }
});
test("worker and navigator retain normal first-factor access", () => {
  for (const role of ["health_worker", "navigator"])
    assert.doesNotThrow(() =>
      enforceVerifiedAssurance(jwt({ sub: id, aal: "aal1" }), id, { id, role }),
    );
});
