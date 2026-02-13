import { z } from "zod";

export const appRoleSchema = z.enum(["ADMIN", "USER"]);
export const areaSchema = z.enum([
  "OPERATIONS",
  "COMMERCIAL",
  "TECHNICAL",
  "PROCUREMENT",
  "ADMINISTRATION",
]);

export type AppRole = z.infer<typeof appRoleSchema>;
export type Area = z.infer<typeof areaSchema>;

export type SessionUser = {
  id: string;
  email: string;
  role: AppRole;
  area?: Area;
};

export function canAdvancePhase(user: SessionUser): boolean {
  return user.area === "OPERATIONS";
}