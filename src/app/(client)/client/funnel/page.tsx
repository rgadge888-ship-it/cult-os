import { requireUser } from "@/lib/auth/current-user";
import { FunnelCalculator } from "./funnel-calculator";

export default async function ClientFunnelPage() {
  await requireUser({ clientOnly: true });
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-[0.2em] text-orange-500">
          ► simulator
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
          Funnel Calculator
        </h1>
        <p className="text-sm text-zinc-500">
          play with the numbers. understand where your revenue actually comes from.
        </p>
      </div>
      <div className="mt-10">
        <FunnelCalculator />
      </div>
    </div>
  );
}
