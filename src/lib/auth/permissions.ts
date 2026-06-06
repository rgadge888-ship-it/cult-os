import type { AppRole } from "@/lib/db/types";

// Capability source of truth for Cult OS team roles. Mirrors the matrix in
// memory:reference-cultos-roles. Used in server actions (enforcement) and to
// hide UI per role. RLS handles client-row visibility separately.

export type Capability =
  | "view_clients" // sees the admin side at all
  | "see_all_clients" // vs assigned-only
  | "generate_report"
  | "edit_report_text"
  | "publish_report"
  | "sheet_setup" // connect Google + tab mapping
  | "manage_deliverables"
  | "create_client"
  | "edit_client"
  | "delete_client"
  | "create_task"
  | "complete_task"
  | "manage_client_logins"
  | "manage_team";

const MATRIX: Record<AppRole, Capability[]> = {
  super_admin: [
    "view_clients", "see_all_clients", "generate_report", "edit_report_text",
    "publish_report", "sheet_setup", "manage_deliverables", "create_client",
    "edit_client", "delete_client", "create_task", "complete_task",
    "manage_client_logins", "manage_team",
  ],
  strategist: [
    "view_clients", "see_all_clients", "generate_report", "edit_report_text",
    "publish_report", "manage_deliverables", "create_client", "edit_client",
    "create_task", "complete_task", "manage_client_logins",
  ],
  automation: [
    "view_clients", "generate_report", "edit_report_text", "sheet_setup",
    "create_task", "complete_task",
  ],
  copywriter: [
    "view_clients", "edit_report_text", "complete_task",
  ],
  // Legacy generic admin — treat as a full non-super admin (assigned-scope).
  admin: [
    "view_clients", "generate_report", "edit_report_text", "publish_report",
    "sheet_setup", "manage_deliverables", "create_client", "edit_client",
    "create_task", "complete_task", "manage_client_logins",
  ],
  client: [],
};

export function can(role: AppRole | null | undefined, cap: Capability): boolean {
  if (!role) return false;
  return MATRIX[role]?.includes(cap) ?? false;
}

export function isStaff(role: AppRole | null | undefined): boolean {
  return can(role, "view_clients");
}

// Human label for a role (UI).
export const ROLE_LABEL: Record<AppRole, string> = {
  super_admin: "Super Admin",
  strategist: "Strategist",
  automation: "Automation",
  copywriter: "Copywriter",
  admin: "Admin",
  client: "Client",
};

// Roles a super_admin can assign when inviting a teammate.
export const ASSIGNABLE_ROLES: AppRole[] = ["strategist", "automation", "copywriter"];
