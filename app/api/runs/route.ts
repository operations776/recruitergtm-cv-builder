// Team-only run history: list past CVs, or fetch one in full.
// GET /api/runs        -> recent runs
// GET /api/runs?id=... -> one run including the full CV
import { NextRequest, NextResponse } from "next/server";
import { checkPassword, unauthorized } from "@/lib/auth";
import { listRuns, getRun, historyEnabled } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!checkPassword(req)) return unauthorized();

  if (!historyEnabled()) {
    return NextResponse.json({ enabled: false, runs: [] });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    const run = await getRun(id);
    if (!run) {
      return NextResponse.json({ error: "Run not found." }, { status: 404 });
    }
    return NextResponse.json({ enabled: true, run });
  }

  return NextResponse.json({ enabled: true, runs: await listRuns() });
}
