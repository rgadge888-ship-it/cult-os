import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Use the request's host so this works for both localhost and the prod
  // Vercel domain without needing a NEXT_PUBLIC_SITE_URL env var.
  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
