import Link from "next/link";
import { Panel, SectionHeader } from "@/components/ui/section";
import { NewClientForm } from "./new-client-form";
import { requireUser } from "@/lib/auth/current-user";

export default async function NewClientPage() {
  await requireUser({ adminOnly: true, capability: "create_client" });
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <Link
        href="/admin/clients"
        className="text-[10px] uppercase tracking-widest text-zinc-500 hover:text-zinc-300"
      >
        ← Clients
      </Link>
      <div className="mt-3 space-y-1">
        <p className="text-[10px] uppercase tracking-[0.2em] text-orange-500">
          ► onboarding
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
          New client
        </h1>
        <p className="text-sm text-zinc-500">
          fills the basics + links a Mainsheet. seeds the 21-item deliverables checklist
          automatically.
        </p>
      </div>

      <Panel className="mt-8 p-6">
        <SectionHeader label="client info" className="mb-6" />
        <NewClientForm />
      </Panel>
    </div>
  );
}
