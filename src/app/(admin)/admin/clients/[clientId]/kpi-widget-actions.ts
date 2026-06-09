"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { loadFoundationSheet } from "@/lib/sheets/foundation";
import type { Client } from "@/lib/db/types";

export async function addKpiWidget(clientId: string, formData: FormData) {
  const { user } = await requireUser({ adminOnly: true });
  const kpiLabel = String(formData.get("kpi_label") ?? "").trim();
  if (!kpiLabel) return;

  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, mainsheet_file_id, tab_map")
    .eq("id", clientId)
    .single();
  if (!client?.mainsheet_file_id) return;

  const c = client as Pick<Client, "id" | "mainsheet_file_id" | "tab_map">;
  if (!c.mainsheet_file_id) return;

  const foundation = await loadFoundationSheet(c.mainsheet_file_id, c.tab_map);
  const target = foundation?.targets.find((item) => item.label === kpiLabel);
  if (!target) return;

  const { count } = await supabase
    .from("client_kpi_widgets")
    .select("*", { count: "exact", head: true })
    .eq("client_id", clientId);

  await supabase.from("client_kpi_widgets").upsert(
    {
      client_id: clientId,
      kpi_label: target.label,
      sort_order: count ?? 0,
      created_by: user.id,
    },
    { onConflict: "client_id,kpi_label" },
  );

  revalidatePath(`/admin/clients/${clientId}`);
}

export async function removeKpiWidget(clientId: string, widgetId: string) {
  await requireUser({ adminOnly: true });
  const supabase = await createClient();
  await supabase
    .from("client_kpi_widgets")
    .delete()
    .eq("id", widgetId)
    .eq("client_id", clientId);

  revalidatePath(`/admin/clients/${clientId}`);
}
