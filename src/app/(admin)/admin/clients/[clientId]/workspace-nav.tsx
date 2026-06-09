"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS = [
  { label: "Overview", path: "" },
  { label: "Reports", path: "reports" },
  { label: "Daily Data", path: "daily-data" },
  { label: "Deliverables", path: "deliverables" },
  { label: "Login", path: "login" },
  { label: "Data Source", path: "data" },
];

export function ClientWorkspaceNav({ clientId }: { clientId: string }) {
  const pathname = usePathname();
  const base = `/admin/clients/${clientId}`;

  return (
    <nav className="mt-8 flex flex-wrap gap-2 border-b border-zinc-900 pb-3">
      {SECTIONS.map((section) => {
        const href = section.path ? `${base}/${section.path}` : base;
        const active =
          section.path === ""
            ? pathname === base
            : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={section.path}
            href={href}
            className={`inline-flex h-8 items-center rounded-md border px-3 text-xs uppercase tracking-widest ${
              active
                ? "border-orange-500 bg-orange-950/30 text-orange-300"
                : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
            }`}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
