"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { extractSheetsFileId, slugify } from "@/lib/sheets/parse-url";

const newClientSchema = z.object({
  name: z.string().min(2, "Name is too short").max(120),
  slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/, "lowercase letters, numbers, and dashes only"),
  niche: z.string().max(120).optional(),
  plan: z.enum(["one_month", "three_month"]),
  mainsheet_url: z.string().url("Must be a Google Sheets URL"),
  monthly_ad_budget_inr: z
    .union([z.string(), z.number()])
    .transform((v) => (v === "" || v == null ? null : Number(v)))
    .pipe(z.number().nonnegative().nullable()),
  start_date: z.string().optional().nullable(),
});

export type NewClientState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function createClientAction(
  _prev: NewClientState,
  formData: FormData,
): Promise<NewClientState> {
  const raw = Object.fromEntries(formData);

  // Default slug from name if not provided.
  if (!raw.slug && raw.name) raw.slug = slugify(String(raw.name));

  const parsed = newClientSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0] ?? "form")] = issue.message;
    }
    return { error: "Fix the highlighted fields.", fieldErrors };
  }

  const fileId = extractSheetsFileId(parsed.data.mainsheet_url);
  if (!fileId) {
    return {
      error: "Couldn't extract a file ID from that URL.",
      fieldErrors: { mainsheet_url: "Paste the full Google Sheets URL." },
    };
  }

  const supabase = await createClient();

  // Insert the client row.
  const { data: inserted, error: insertErr } = await supabase
    .from("clients")
    .insert({
      name: parsed.data.name,
      slug: parsed.data.slug,
      niche: parsed.data.niche || null,
      plan: parsed.data.plan,
      status: "onboarding",
      monthly_ad_budget_inr: parsed.data.monthly_ad_budget_inr,
      start_date: parsed.data.start_date || null,
      mainsheet_file_id: fileId,
      mainsheet_url: parsed.data.mainsheet_url,
    })
    .select("id, slug")
    .single();

  if (insertErr || !inserted) {
    if (insertErr?.code === "23505") {
      return {
        error: "A client with that slug already exists.",
        fieldErrors: { slug: "Pick a different slug." },
      };
    }
    return { error: insertErr?.message ?? "Insert failed." };
  }

  // Seed the deliverables checklist via the helper function we wrote in the migration.
  const { error: seedErr } = await supabase.rpc("seed_default_deliverables", {
    p_client_id: inserted.id,
  });
  if (seedErr) {
    // Non-fatal — log but continue. Admin can manually seed later.
    console.warn("[clients:create] seed_default_deliverables failed:", seedErr.message);
  }

  // Record in activity log (client_visible=true so client can see it after we invite them).
  await supabase.from("activity_log").insert({
    client_id: inserted.id,
    action: "client.created",
    subject_table: "clients",
    subject_id: inserted.id,
    metadata: { name: parsed.data.name, plan: parsed.data.plan },
    client_visible: true,
  });

  redirect(`/admin/clients/${inserted.id}`);
}
