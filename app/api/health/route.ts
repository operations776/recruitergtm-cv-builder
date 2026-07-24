// Health check — reports which integrations are wired up, without leaking any
// secret or candidate data. Safe to call unauthenticated: it only ever returns
// booleans plus a row count.
import { NextResponse } from "next/server";
import { historyEnabled, dbPing } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const db = historyEnabled() ? await dbPing() : { ok: false, runs: null };

  return NextResponse.json({
    ok: true,
    integrations: {
      openai: !!process.env.OPENAI_API_KEY,
      exa: !!process.env.EXA_API_KEY,
      prospeo: !!process.env.PROSPEO_API_KEY,
      apify: !!process.env.APIFY_TOKEN,
      password: !!process.env.APP_PASSWORD,
    },
    history: {
      configured: historyEnabled(),
      reachable: db.ok,
      runs: db.runs,
      error: (db as any).error ?? null,
    },
  });
}
