import { google } from "googleapis";
import type { Credentials } from "google-auth-library";

// Read-only access to the user's Google Sheets. Matches the scope we configured
// on the OAuth consent screen.
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets.readonly",
];

export function getOAuthClient() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Google OAuth env vars not configured");
  }
  return new google.auth.OAuth2({ clientId, clientSecret, redirectUri });
}

export function getAuthUrl(state: string) {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline", // get a refresh_token
    prompt: "consent",      // force refresh_token issuance every time
    scope: GOOGLE_SCOPES,
    state,
    include_granted_scopes: true,
  });
}

export async function exchangeCode(code: string): Promise<Credentials> {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  return tokens;
}
