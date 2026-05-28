"use client";

import { useEffect, useState, useTransition } from "react";
import { createTasksFromMom } from "../actions";
import type { TaskPriority } from "@/lib/db/types";

type Draft = {
  id: string;
  included: boolean;
  title: string;
  assignee_id: string;
  priority: TaskPriority;
  due_date: string;
};

// Parse MOM text into candidate task lines. Strips common bullet markers and
// numeric prefixes; drops blanks and very short fragments.
function parseLines(mom: string): string[] {
  return mom
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s>•*\-•]+/, "").replace(/^\d+[.)]\s*/, "").trim())
    .filter((l) => l.length >= 4 && l.length <= 300);
}

export function ExtractTasksDialog({
  open,
  onClose,
  mom,
  reportId,
  clientId,
  admins,
}: {
  open: boolean;
  onClose: () => void;
  mom: string;
  reportId: string;
  clientId: string;
  admins: { id: string; label: string }[];
}) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // Re-parse whenever the dialog opens with new MOM text.
  useEffect(() => {
    if (!open) return;
    const lines = parseLines(mom);
    setDrafts(
      lines.map((title, i) => ({
        id: `${Date.now()}-${i}`,
        included: true,
        title,
        assignee_id: "",
        priority: "medium",
        due_date: "",
      })),
    );
    setErr(null);
    setOkMsg(null);
  }, [open, mom]);

  if (!open) return null;

  const update = (id: string, patch: Partial<Draft>) =>
    setDrafts((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const submit = () => {
    setErr(null);
    setOkMsg(null);
    const payload = drafts
      .filter((d) => d.included && d.title.trim())
      .map((d) => ({
        title: d.title.trim(),
        assignee_id: d.assignee_id || null,
        priority: d.priority,
        due_date: d.due_date || null,
      }));
    if (payload.length === 0) {
      setErr("Pick at least one line to convert.");
      return;
    }
    start(async () => {
      const res = await createTasksFromMom(reportId, clientId, payload);
      if (res.error) setErr(res.error);
      else {
        setOkMsg(`Created ${res.count} task${res.count === 1 ? "" : "s"}.`);
        setTimeout(onClose, 900);
      }
    });
  };

  const included = drafts.filter((d) => d.included).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
      <div className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-md border border-zinc-800 bg-zinc-950">
        <header className="flex items-center justify-between border-b border-zinc-900 px-5 py-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-orange-500">
              ► extract
            </p>
            <h2 className="text-base font-semibold text-zinc-100">
              Tasks from MOM
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 hover:text-zinc-200"
          >
            close
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {drafts.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">
              Nothing in the MOM to extract. Type some lines first.
            </p>
          ) : (
            <ul className="space-y-2">
              {drafts.map((d) => (
                <li
                  key={d.id}
                  className={`grid grid-cols-12 items-center gap-2 rounded-md border px-3 py-2 ${
                    d.included
                      ? "border-zinc-800 bg-zinc-950"
                      : "border-zinc-900 bg-black/30 opacity-50"
                  }`}
                >
                  <label className="col-span-1 flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={d.included}
                      onChange={(e) => update(d.id, { included: e.target.checked })}
                      className="h-4 w-4 accent-orange-500"
                    />
                  </label>
                  <input
                    value={d.title}
                    onChange={(e) => update(d.id, { title: e.target.value })}
                    className="col-span-5 rounded-sm border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm text-zinc-100 focus:border-orange-500 focus:outline-none"
                  />
                  <select
                    value={d.assignee_id}
                    onChange={(e) => update(d.id, { assignee_id: e.target.value })}
                    className="col-span-3 rounded-sm border border-zinc-800 bg-zinc-950 px-1 py-1 text-xs text-zinc-200 focus:border-orange-500 focus:outline-none"
                  >
                    <option value="">Unassigned</option>
                    {admins.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={d.priority}
                    onChange={(e) =>
                      update(d.id, { priority: e.target.value as TaskPriority })
                    }
                    className="col-span-1 rounded-sm border border-zinc-800 bg-zinc-950 px-1 py-1 text-xs text-zinc-200 focus:border-orange-500 focus:outline-none"
                  >
                    <option value="low">low</option>
                    <option value="medium">med</option>
                    <option value="high">high</option>
                    <option value="urgent">urg</option>
                  </select>
                  <input
                    type="date"
                    value={d.due_date}
                    onChange={(e) => update(d.id, { due_date: e.target.value })}
                    className="col-span-2 rounded-sm border border-zinc-800 bg-zinc-950 px-1 py-1 text-xs text-zinc-200 focus:border-orange-500 focus:outline-none"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-900 px-5 py-3">
          <div>
            {err ? <p className="text-xs text-red-400">{err}</p> : null}
            {okMsg ? <p className="text-xs text-emerald-400">{okMsg}</p> : null}
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              {included} of {drafts.length} selected
            </span>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center rounded-md border border-zinc-700 px-4 text-xs uppercase tracking-widest text-zinc-300 hover:border-zinc-500"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={pending || included === 0}
              className="inline-flex h-9 items-center rounded-md bg-orange-500 px-4 text-xs font-medium uppercase tracking-widest text-zinc-950 hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Creating…" : `Create ${included} task${included === 1 ? "" : "s"}`}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
