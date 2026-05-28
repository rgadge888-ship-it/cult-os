import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/current-user";
import { getAuthUrl } from "@/lib/google/oauth";

// Starts the Google OAuth flow. Generates a random state, sets it as an
// httpOnly cookie, and redirects to Google's consent screen. Only admins
// can connect (the tokens authorize reading client Mainsheets).
export async function GET() {
  await requireUser({ adminOnly: true });

  const state = randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set("google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes — they need to complete the flow in this window
    path: "/",
  });

  return NextResponse.redirect(getAuthUrl(state));
}
