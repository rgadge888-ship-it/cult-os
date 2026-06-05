// Hand-written types mirroring the V1 sheets-source schema in
// supabase/migrations/0001_init.sql. Replace with auto-generated types once
// the Supabase CLI is set up (`supabase gen types typescript`).

export type AppRole = "super_admin" | "admin" | "client";
export type ClientPlan = "one_month" | "three_month";
export type ClientStatus = "onboarding" | "active" | "paused" | "churned";
export type DeliverableStatus =
  | "not_started"
  | "in_progress"
  | "done"
  | "blocked";
export type ReportStatus = "draft" | "published";

export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskSource = "manual" | "from_mom";

export type Task = {
  id: string;
  client_id: string | null;
  title: string;
  description: string | null;
  assignee_id: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  source: TaskSource;
  source_report_id: string | null;
  created_by: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: AppRole;
  client_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Client = {
  id: string;
  name: string;
  slug: string;
  niche: string | null;
  plan: ClientPlan;
  status: ClientStatus;
  start_date: string | null;
  end_date: string | null;
  monthly_ad_budget_inr: number | null;
  timezone: string;
  mainsheet_file_id: string | null;
  mainsheet_url: string | null;
  sheets_connected_at: string | null;
  tab_map: Record<string, string>;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Deliverable = {
  id: string;
  client_id: string;
  name: string;
  category: string | null;
  status: DeliverableStatus;
  notes: string | null;
  completed_at: string | null;
  completed_by: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

// A single metric cell read from the sheet: keep the exact formatted string for
// display (preserves ₹ / % / commas) plus a parsed number for delta math.
export type MetricCell = { raw: string; value: number | null };

// Canonical metric fields. Keys map to the Weekly Datasheet columns via the
// fuzzy matcher in lib/reports/parse.ts.
export type MetricSet = Partial<Record<MetricField, MetricCell>>;

export type MetricField =
  | "date_range"
  | "spend"
  | "spend_with_gst"
  | "registrations"
  | "registrations_fb"
  | "cost_per_acq"
  | "cost_per_acq_fb"
  | "impressions"
  | "cpm"
  | "obc"
  | "ctr"
  | "cpc"
  | "lpv"
  | "obc_to_lpv"
  | "lpv_to_reg"
  | "call_booking"
  | "upsells"
  | "revenue"
  | "net_profit"
  | "roas";

export type FunnelSnapshot = {
  impressions: number | null;
  obc: number | null;
  lpv: number | null;
  registrations: number | null;
};

export type WebinarSnapshot = {
  date: string | null;
  registrations: number | null;
  attendees: number | null;
  attendees_pct: string | null;
  stayed_till_pitch_pct: string | null;
  converted: number | null;
  conversion_rate: string | null;
  revenue: string | null;
};

export type CreativeRow = {
  name: string;
  spend: string | null;
  registrations: string | null;
  cost_per_acq: string | null;
  hook_rate: string | null;
  hold_rate: string | null;
  ctr: string | null;
};

// data jsonb shape for a weekly_report row.
export type WeeklyReportData = {
  source_tab: string;
  acq_label: "CPR" | "CPP";
  current: { range: string; metrics: MetricSet };
  previous: { range: string; metrics: MetricSet } | null;
  funnel: FunnelSnapshot;
  latest_webinar: WebinarSnapshot | null;
  top_creatives: CreativeRow[];
  warnings: string[];
};

export type WeeklyReport = {
  id: string;
  client_id: string;
  week_start_date: string;
  week_end_date: string;
  data: WeeklyReportData;
  narrative: string | null;
  discussion: string | null;
  mom: string | null;
  status: ReportStatus;
  generated_by: string | null;
  generated_at: string;
  published_at: string | null;
  published_by: string | null;
  created_at: string;
  updated_at: string;
};

export type LeadAnnotation = {
  id: string;
  client_id: string;
  lead_email: string | null;
  lead_phone: string | null;
  webinar_tag: string | null;
  tag: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SheetColumnMapping = {
  id: string;
  client_id: string;
  tab_name: string;
  sheet_column_name: string;
  canonical_field: string;
  confidence: number | null;
  mapped_by: string | null;
  created_at: string;
};

export type ActivityLog = {
  id: string;
  client_id: string | null;
  actor_id: string | null;
  action: string;
  subject_table: string | null;
  subject_id: string | null;
  metadata: unknown;
  client_visible: boolean;
  created_at: string;
};
