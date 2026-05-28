import { getTokensForUser } from "./tokens";

export type ConnectionStatus =
  | { connected: false }
  | {
      connected: true;
      scope: string | null;
      expiry_date: string | null;
      has_refresh_token: boolean;
      updated_at: string;
    };

export async function getGoogleConnectionStatus(
  userId: string,
): Promise<ConnectionStatus> {
  const tokens = await getTokensForUser(userId);
  if (!tokens) return { connected: false };
  return {
    connected: true,
    scope: tokens.scope,
    expiry_date: tokens.expiry_date,
    has_refresh_token: !!tokens.refresh_token,
    updated_at: tokens.updated_at,
  };
}
