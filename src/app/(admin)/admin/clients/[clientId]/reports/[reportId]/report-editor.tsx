"use client";

import { useActionState, useRef, useState } from "react";
import {
  saveReportText,
  publishReport,
  unpublishReport,
  type SaveTextState,
} from "../actions";
import { Panel, SectionHeader } from "@/components/ui/section";
import { ExtractTasksDialog } from "./extract-tasks-dialog";

const INITIAL: SaveTextState = {};

export function ReportEditor({
  reportId,
  clientId,
  status,
  narrative,
  discussion,
  mom,
  admins,
  canPublish = true,
  canCreateTasks = true,
}: {
  reportId: string;
  clientId: string;
  status: "draft" | "published";
  narrative: string | null;
  discussion: string | null;
  mom: string | null;
  admins: { id: string; label: string }[];
  canPublish?: boolean;
  canCreateTasks?: boolean;
}) {
  const save = saveReportText.bind(null, reportId, clientId);
  const [state, action, pending] = useActionState(save, INITIAL);
  const momRef = useRef<HTMLTextAreaElement>(null);
  const [extractOpen, setExtractOpen] = useState(false);
  const [extractMom, setExtractMom] = useState("");

  const openExtract = () => {
    setExtractMom(momRef.current?.value ?? "");
    setExtractOpen(true);
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        label="discussion + minutes"
        action={
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            you edit these
          </span>
        }
      />
      <form action={action}>
        <Panel className="space-y-5 p-5">
          <Editable
            name="discussion"
            label="Points to be Discussed"
            placeholder={"> YT Ads\n> Email Nurturing\n> Optimization"}
            defaultValue={discussion ?? ""}
          />
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <label className="block text-[10px] uppercase tracking-widest text-zinc-500">
                Minutes of Meeting (MOM)
              </label>
              {canCreateTasks ? (
                <button
                  type="button"
                  onClick={openExtract}
                  className="font-mono text-[10px] uppercase tracking-widest text-orange-400 hover:text-orange-300"
                >
                  extract tasks →
                </button>
              ) : null}
            </div>
            <textarea
              ref={momRef}
              name="mom"
              defaultValue={mom ?? ""}
              placeholder="What was decided on the call…"
              rows={4}
              className="w-full resize-y rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-700 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>
          <Editable
            name="narrative"
            label="Narrative summary (optional)"
            placeholder="2-3 lines: what happened this week and why."
            defaultValue={narrative ?? ""}
          />
          <div className="flex items-center gap-3 border-t border-zinc-900 pt-4">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-9 items-center rounded-md border border-zinc-700 px-4 text-xs uppercase tracking-widest text-zinc-200 hover:border-zinc-500 disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            {state.ok ? (
              <span className="text-xs text-emerald-400">saved</span>
            ) : null}
            {state.error ? (
              <span className="text-xs text-red-400">{state.error}</span>
            ) : null}
          </div>
        </Panel>
      </form>

      {/* Publish controls */}
      <Panel className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <p className="text-sm text-zinc-200">
            {status === "published"
              ? "This report is visible in the client's portal."
              : "This report is a draft — the client can't see it yet."}
          </p>
          <p className="text-xs text-zinc-600">
            {canPublish
              ? "Publishing makes the metrics + your notes visible to the client login."
              : "Only a Strategist or Super Admin can publish to the client."}
          </p>
        </div>
        {!canPublish ? null : status === "published" ? (
          <form action={unpublishReport.bind(null, reportId, clientId)}>
            <button
              type="submit"
              className="inline-flex h-9 items-center rounded-md border border-zinc-700 px-4 text-xs uppercase tracking-widest text-zinc-300 hover:border-amber-700 hover:text-amber-300"
            >
              Unpublish
            </button>
          </form>
        ) : (
          <form action={publishReport.bind(null, reportId, clientId)}>
            <button
              type="submit"
              className="inline-flex h-9 items-center rounded-md bg-orange-500 px-4 text-xs font-medium uppercase tracking-widest text-zinc-950 hover:bg-orange-400"
            >
              Publish to client
            </button>
          </form>
        )}
      </Panel>

      <ExtractTasksDialog
        open={extractOpen}
        onClose={() => setExtractOpen(false)}
        mom={extractMom}
        reportId={reportId}
        clientId={clientId}
        admins={admins}
      />
    </div>
  );
}

function Editable({
  name,
  label,
  placeholder,
  defaultValue,
}: {
  name: string;
  label: string;
  placeholder: string;
  defaultValue: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[10px] uppercase tracking-widest text-zinc-500">
        {label}
      </label>
      <textarea
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        rows={4}
        className="w-full resize-y rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-700 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
      />
    </div>
  );
}
