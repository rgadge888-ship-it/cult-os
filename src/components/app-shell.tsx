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
  { href: "/client/daily-data", label: "Daily Data" },
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
    <div className="flex min-h-screen flex-1 flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="border-zinc-800/80 bg-zinc-950/40 backdrop-blur lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-60 lg:flex-shrink-0 lg:flex-col lg:border-r">
        {/* Brand */}
        <div className="flex items-center justify-between border-b border-zinc-900 px-5 py-4 lg:border-b-0 lg:py-5">
          <Link href={isAdminSide ? "/admin" : "/client"} className="flex flex-col gap-0.5">
            <span className="text-xs uppercase tracking-[0.2em] text-orange-500">
              ► cult os
            </span>
            <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">
              [ {roleLabel} ]
            </span>
          </Link>
          {/* Mobile sign-out (sidebar collapses to horizontal strip) */}
          <form action="/signout" method="post" className="lg:hidden">
            <button
              type="submit"
              className="rounded border border-zinc-800 px-3 py-1.5 text-[10px] uppercase tracking-widest text-zinc-400 hover:border-zinc-600 hover:text-zinc-100"
            >
              Sign out
            </button>
          </form>
        </div>

        {/* Nav */}
        <nav className="flex gap-1 overflow-x-auto border-b border-zinc-900 px-3 py-2 lg:flex-1 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:border-b-0 lg:px-3 lg:py-4">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-md px-3 py-1.5 text-xs uppercase tracking-wider text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100 lg:py-2"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Footer: email + sign out (desktop) */}
        <div className="hidden border-t border-zinc-900 px-4 py-4 lg:block">
          <p className="mb-2 truncate font-mono text-[10px] text-zinc-500" title={email}>
            {email}
          </p>
          <form action="/signout" method="post">
            <button
              type="submit"
              className="w-full rounded border border-zinc-800 px-3 py-1.5 text-[10px] uppercase tracking-widest text-zinc-400 hover:border-zinc-600 hover:text-zinc-100"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
