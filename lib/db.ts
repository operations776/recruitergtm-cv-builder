// Run history — stores every CV the tool builds so the team can find and
// re-download past work. Backed by Vercel Postgres (Neon).
//
// The whole feature is optional: with no DATABASE_URL the helpers no-op and
// the UI simply hides history. A storage failure must never break a build.

import { neon } from "@neondatabase/serverless";
import type { CandidateCV } from "./types";

export interface RunSummary {
  id: string;
  name: string;
  headline: string | null;
  company: string | null;
  confidence: string | null;
  createdAt: string;
}

export interface RunRecord extends RunSummary {
  cv: CandidateCV;
}

function connectionString(): string | null {
  // Vercel's Neon integration injects one of these depending on how the
  // database was attached; accept them all so the feature just works.
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.NEON_DATABASE_URL ||
    null
  );
}

export function historyEnabled(): boolean {
  return !!connectionString();
}

type Sql = ReturnType<typeof neon>;

function sqlClient(): Sql | null {
  const url = connectionString();
  if (!url) return null;
  return neon(url);
}

let ensured = false;

/** Create the table on first use. Cheap and idempotent. */
async function ensureTable(sql: Sql) {
  if (ensured) return;
  await sql`
    CREATE TABLE IF NOT EXISTS cv_runs (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name        text NOT NULL,
      headline    text,
      company     text,
      confidence  text,
      cv          jsonb NOT NULL,
      created_at  timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS cv_runs_created_at_idx ON cv_runs (created_at DESC)`;
  ensured = true;
}

/**
 * Verify the database is actually reachable and the table exists.
 * Returns only a boolean and a row count — never any candidate data.
 */
export async function dbPing(): Promise<{
  ok: boolean;
  runs: number | null;
  error?: string;
}> {
  const sql = sqlClient();
  if (!sql) return { ok: false, runs: null, error: "No connection string" };
  try {
    await ensureTable(sql);
    const rows = (await sql`SELECT count(*)::int AS n FROM cv_runs`) as any[];
    return { ok: true, runs: rows[0]?.n ?? 0 };
  } catch (e: any) {
    return { ok: false, runs: null, error: e?.message?.slice(0, 200) };
  }
}

/** Persist a finished CV. Returns the new run id, or null when unavailable. */
export async function saveRun(
  cv: CandidateCV,
  confidence?: string
): Promise<string | null> {
  const sql = sqlClient();
  if (!sql) return null;
  try {
    await ensureTable(sql);
    const rows = await sql`
      INSERT INTO cv_runs (name, headline, company, confidence, cv)
      VALUES (
        ${cv.name},
        ${cv.headline || null},
        ${cv.experience?.[0]?.employer || null},
        ${confidence || null},
        ${JSON.stringify(cv)}::jsonb
      )
      RETURNING id
    `;
    return (rows as any[])[0]?.id ?? null;
  } catch {
    return null; // history is a nice-to-have, never fail the build over it
  }
}

/** Most recent runs, newest first. */
export async function listRuns(limit = 50): Promise<RunSummary[]> {
  const sql = sqlClient();
  if (!sql) return [];
  try {
    await ensureTable(sql);
    const rows = (await sql`
      SELECT id, name, headline, company, confidence, created_at
      FROM cv_runs
      ORDER BY created_at DESC
      LIMIT ${limit}
    `) as any[];
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      headline: r.headline,
      company: r.company,
      confidence: r.confidence,
      createdAt: new Date(r.created_at).toISOString(),
    }));
  } catch {
    return [];
  }
}

/** Full record for one run, so a past CV can be re-previewed and re-exported. */
export async function getRun(id: string): Promise<RunRecord | null> {
  const sql = sqlClient();
  if (!sql) return null;
  try {
    await ensureTable(sql);
    const rows = (await sql`
      SELECT id, name, headline, company, confidence, cv, created_at
      FROM cv_runs
      WHERE id = ${id}::uuid
    `) as any[];
    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      name: r.name,
      headline: r.headline,
      company: r.company,
      confidence: r.confidence,
      createdAt: new Date(r.created_at).toISOString(),
      cv: r.cv as CandidateCV,
    };
  } catch {
    return null;
  }
}
