import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/current-user";
import { exchangeCode } from "@/lib/google/oauth";
import { saveTokensForUser } from "@/lib/google/tokens";

// Google redirects here after the user grants or denies access on the consent
// screen. We verify the state, exchange the code for tokens, and persist them.
export async function GET(req: NextRequest) {
  const { user } = await requireUser({ adminOnly: true });

  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const settingsUrl = (params: Record<string, string>) => {
    const u = new URL("/admin/settings", req.url);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    return u;
  };

  if (error) {
    return NextResponse.redirect(settingsUrl({ google_error: error }));
  }
  if (!code || !state) {
    return NextResponse.redirect(settingsUrl({ google_error: "missing_params" }));
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("google_oauth_state")?.value;
  cookieStore.delete("google_oauth_state");
  if (!expectedState || expectedState !== state) {
    return NextResponse.redirect(settingsUrl({ google_error: "state_mismatch" }));
  }

  try {
    const tokens = await exchangeCode(code);
    if (!tokens.access_token) {
      return NextResponse.redirect(settingsUrl({ google_error: "no_access_token" }));
    }
    await saveTokensForUser(user.id, tokens);
  } catch (e) {
    console.error("[google/callback] token exchange failed:", e);
    return NextResponse.redirect(settingsUrl({ google_error: "token_exchange_failed" }));
  }

  return NextResponse.redirect(settingsUrl({ google_connected: "1" }));
}
