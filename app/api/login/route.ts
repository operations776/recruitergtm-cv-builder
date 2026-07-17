// Validates the shared password so the UI can gate before showing the tool.
import { NextRequest, NextResponse } from "next/server";
import { checkPassword, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!checkPassword(req)) return unauthorized();
  return NextResponse.json({ ok: true });
}
