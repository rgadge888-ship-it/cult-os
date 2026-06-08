"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createClientAction, type NewClientState } from "./actions";
import { slugify } from "@/lib/sheets/parse-url";

const INITIAL: NewClientState = {};

export function NewClientForm() {
  const [state, action, pending] = useActionState(createClientAction, INITIAL);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  // Auto-suggest slug from name unless the user has edited slug.
  const onName = (v: string) => {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  };

  return (
    <form action={action} className="space-y-5">
      <Field label="Client name" error={state.fieldErrors?.name} required>
        <input
          name="name"
          value={name}
          onChange={(e) => onName(e.target.value)}
          required
          className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          placeholder="e.g. Carrie Anderson"
        />
      </Field>

      <Field
        label="Slug"
        hint="used in URLs and webhook paths. lowercase, dashes only."
        error={state.fieldErrors?.slug}
        required
      >
        <input
          name="slug"
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value);
            setSlugTouched(true);
          }}
          required
          className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          placeholder="carrie-anderson"
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Niche" error={state.fieldErrors?.niche}>
          <input
            name="niche"
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            placeholder="e.g. Social Media Manager Coach"
          />
        </Field>

        <Field label="Plan" error={state.fieldErrors?.plan} required>
          <select
            name="plan"
            defaultValue="three_month"
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          >
            <option value="three_month">Three Month — ₹55,000/mo</option>
            <option value="one_month">One Month — ₹75,000</option>
          </select>
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Monthly ad budget (INR)"
          error={state.fieldErrors?.monthly_ad_budget_inr}
        >
          <input
            name="monthly_ad_budget_inr"
            type="number"
            min="0"
            step="1000"
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            placeholder="e.g. 100000"
          />
        </Field>

        <Field label="Start date" error={state.fieldErrors?.start_date}>
          <input
            name="start_date"
            type="date"
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </Field>
      </div>

      <Field
        label="Mainsheet URL"
        hint="Paste the full Google Sheets URL of this client's Mainsheet (read-only access required)."
        error={state.fieldErrors?.mainsheet_url}
        required
      >
        <input
          name="mainsheet_url"
          type="url"
          required
          className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          placeholder="https://docs.google.com/spreadsheets/d/…/edit"
        />
      </Field>

      {state.error ? (
        <p className="rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3 border-t border-zinc-900 pt-5">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center rounded-md bg-orange-500 px-5 text-sm font-medium text-zinc-950 hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create client"}
        </button>
        <Link
          href="/admin/clients"
          className="text-xs uppercase tracking-widest text-zinc-500 hover:text-zinc-300"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-zinc-500">
        {label}
        {required ? <span className="text-orange-500">*</span> : null}
      </label>
      {children}
      {hint && !error ? <p className="text-xs text-zinc-600">{hint}</p> : null}
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
