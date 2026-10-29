import { HttpError } from "./validation.mjs";

export const privilegedRoles = [
  "medical_officer",
  "specialist",
  "district_admin",
];

// Call only AFTER Auth has verified this same token with getUser().
// Decoding alone never authenticates a request.
export function enforceVerifiedAssurance(token, userId, profile) {
  if (!privilegedRoles.includes(profile.role)) return;
  let claims;
  try {
    claims = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString(),
    );
  } catch {
    throw new HttpError(401, "Session expired. Sign in again.");
  }
  if (claims.sub !== userId || profile.id !== userId)
    throw new HttpError(401, "Session identity does not match.");
  if (claims.aal !== "aal2")
    throw new HttpError(403, "Verify your authenticator code to continue.");
}
