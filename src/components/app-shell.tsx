import Link from "next/link";
import type { ReactNode } from "react";
import type { AppRole } from "@/lib/db/types";

type NavItem = { href: string; label: string };

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/tasks", label: "Tasks" },
  { href: "/admin/settings", label: "Settings" },
];

const CLIENT_NAV: NavItem[] = [
  { href: "/client", label: "Dashboard" },
  { href: "/client/leads", label: "Leads" },
  { href: "/client/webinar-reports", label: "Webinar Reports" },
  { href: "/client/funnel", label: "Funnel Calculator" },
  { href: "/client/creatives", label: "Ads & Creatives" },
];

export function AppShell({
  role,
  email,
  children,
}: {
  role: AppRole;
  email: string;
  children: ReactNode;
}) {
  const isAdminSide = role === "super_admin" || role === "admin";
  const nav = isAdminSide ? ADMIN_NAV : CLIENT_NAV;
  const roleLabel =
    role === "super_admin" ? "super admin" : role === "admin" ? "admin" : "client";

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-zinc-800/80 bg-zinc-950/40 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <Link href={isAdminSide ? "/admin" : "/client"} className="flex items-center gap-3">
            <span className="text-xs uppercase tracking-[0.2em] text-orange-500">
              ► cult os
            </span>
            <span className="hidden text-[10px] uppercase tracking-widest text-zinc-600 sm:inline">
              [ {roleLabel} ]
            </span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded px-3 py-1.5 text-xs uppercase tracking-wider text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-zinc-500 md:inline">{email}</span>
            <form action="/signout" method="post">
              <button
                type="submit"
                className="rounded border border-zinc-800 px-3 py-1.5 text-xs uppercase tracking-wider text-zinc-400 hover:border-zinc-700 hover:text-zinc-100"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
