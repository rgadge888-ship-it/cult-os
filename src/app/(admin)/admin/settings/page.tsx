import { requireUser } from "@/lib/auth/current-user";
import { Panel, SectionHeader } from "@/components/ui/section";
import { StatusPill } from "@/components/ui/status-pill";
import { getGoogleConnectionStatus } from "@/lib/google/status";
import { FullNameEditor, PasswordForm } from "./account-forms";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ google_connected?: string; google_disconnected?: string; google_error?: string }>;
}) {
  const { user, profile } = await requireUser({ adminOnly: true });
  const sp = await searchParams;
  const status = await getGoogleConnectionStatus(user.id);

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-[0.2em] text-orange-500">
          ► settings
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
          Settings
        </h1>
        <p className="text-sm text-zinc-500">
          your account, integrations, and connections
        </p>
      </div>

      {sp.google_connected ? (
        <p className="mt-6 rounded-md border border-emerald-700/50 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
          Google Sheets connected. Cult OS can now read your client Mainsheets.
        </p>
      ) : null}
      {sp.google_disconnected ? (
        <p className="mt-6 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-300">
          Google disconnected. Sheets reading is paused until you reconnect.
        </p>
      ) : null}
      {sp.google_error ? (
        <p className="mt-6 rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          Couldn't complete Google connection: <span className="font-mono">{sp.google_error}</span>
        </p>
      ) : null}

      {/* Account panel */}
      <div className="mt-8">
        <SectionHeader label="account" className="mb-3" />
        <Panel className="space-y-3 p-5 text-sm">
          <Row label="Email" value={profile.email} mono />
          <Row label="Full name" value={<FullNameEditor initial={profile.full_name} />} />
          <Row
            label="Role"
            value={
              <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">
                {profile.role.replace("_", " ")}
              </span>
            }
          />
        </Panel>
      </div>

      {/* Password panel */}
      <div className="mt-8">
        <SectionHeader label="password" className="mb-3" />
        <Panel className="p-5">
          <PasswordForm />
        </Panel>
      </div>

      {/* Google integration panel */}
      <div className="mt-8">
        <SectionHeader
          label="google sheets integration"
          className="mb-3"
          action={
            <StatusPill status={status.connected ? "active" : "not_started"} />
          }
        />
        <Panel className="space-y-4 p-5">
          <p className="text-sm text-zinc-400">
            Cult OS needs read-only access to your Google Sheets so it can pull data from
            client Mainsheets. You'll be sent to Google to approve. We only request the{" "}
            <span className="font-mono text-zinc-300">spreadsheets.readonly</span> scope —
            Cult OS cannot modify, write to, or delete any sheet.
          </p>

          {status.connected ? (
            <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs">
              <div className="flex justify-between gap-3">
                <span className="text-zinc-500">scope</span>
                <span className="text-zinc-300">{status.scope ?? "—"}</span>
              </div>
              <div className="mt-1 flex justify-between gap-3">
                <span className="text-zinc-500">refresh token</span>
                <span className={status.has_refresh_token ? "text-emerald-400" : "text-amber-400"}>
                  {status.has_refresh_token ? "stored" : "missing"}
                </span>
              </div>
              <div className="mt-1 flex justify-between gap-3">
                <span className="text-zinc-500">last updated</span>
                <span className="text-zinc-300">
                  {new Date(status.updated_at).toLocaleString()}
                </span>
              </div>
            </div>
          ) : null}

          <div className="flex items-center gap-3 border-t border-zinc-900 pt-4">
            {status.connected ? (
              <>
                <form action="/api/auth/google/disconnect" method="post">
                  <button
                    type="submit"
                    className="inline-flex h-9 items-center rounded-md border border-zinc-700 px-4 text-xs uppercase tracking-widest text-zinc-300 hover:border-red-700 hover:text-red-300"
                  >
                    Disconnect
                  </button>
                </form>
                <a
                  href="/api/auth/google/connect"
                  className="text-xs uppercase tracking-widest text-zinc-500 hover:text-zinc-300"
                >
                  Reconnect
                </a>
              </>
            ) : (
              <a
                href="/api/auth/google/connect"
                className="inline-flex h-9 items-center rounded-md bg-orange-500 px-4 text-xs font-medium uppercase tracking-widest text-zinc-950 hover:bg-orange-400"
              >
                Connect Google Sheets
              </a>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex gap-3">
      <span className="w-28 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
        {label}
      </span>
      <span className={mono ? "font-mono text-xs text-zinc-300" : "text-zinc-300"}>
        {value}
      </span>
    </div>
  );
}
