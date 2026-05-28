import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/current-user";

export default async function ClientLayout({ children }: { children: ReactNode }) {
  const { profile } = await requireUser({ clientOnly: true });
  return (
    <AppShell role={profile.role} email={profile.email}>
      {children}
    </AppShell>
  );
}
