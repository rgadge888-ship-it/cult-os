import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/current-user";
import { deleteTokensForUser } from "@/lib/google/tokens";

export async function POST(req: Request) {
  const { user } = await requireUser({ adminOnly: true });
  await deleteTokensForUser(user.id);
  return NextResponse.redirect(
    new URL("/admin/settings?google_disconnected=1", req.url),
    { status: 303 },
  );
}
