import type { Role } from "./types";

export const privilegedRoles: Role[] = [
  "medical_officer",
  "specialist",
  "district_admin",
];

export function requiresSecondFactor(
  role: Role,
  currentLevel: string | null,
  nextLevel: string | null,
) {
  return (
    currentLevel !== "aal2" &&
    (privilegedRoles.includes(role) || nextLevel === "aal2")
  );
}
