// Step 2: confirmed match + pasted text -> structured render-ready CV (OpenAI).
// Optionally pulls LinkedIn context via Exa contents for richer bullets.
import { NextRequest, NextResponse } from "next/server";
import { checkPassword, unauthorized } from "@/lib/auth";
import { structureCV } from "@/lib/openai";
import { exaPeopleSearch } from "@/lib/exa";
import { scrapeLinkedIn } from "@/lib/apify";
import type { MatchCandidate } from "@/lib/types";

export const runtime = "nodejs";
// Scrape (up to ~90s) plus the structuring call needs more headroom.
export const maxDuration = 180;

export async function POST(req: NextRequest) {
  if (!checkPassword(req)) return unauthorized();

  try {
    const { text, match } = (await req.json()) as {
      text: string;
      match: MatchCandidate;
    };
    if (!text || !match) {
      return NextResponse.json(
        { error: "Missing pasted text or confirmed match." },
        { status: 400 }
      );
    }

    // Best source first: scrape the actual LinkedIn profile (full role
    // descriptions, certifications, projects, recommendations). Falls back to
    // Exa summaries when there's no token, no URL, or the scrape comes back
    // empty — a failed scrape must never fail the build.
    let linkedinContext = match.summary || "";
    let scraped = false;

    if (match.linkedin) {
      const profile = await scrapeLinkedIn(match.linkedin);
      if (profile?.text) {
        linkedinContext = profile.text;
        scraped = true;
      }
    }

    if (!scraped) {
      try {
        const r = await exaPeopleSearch(
          `${match.name} ${match.company || ""} LinkedIn profile`,
          3
        );
        linkedinContext +=
          "\n" + r.map((x) => x.summary || "").filter(Boolean).join("\n");
      } catch {
        /* non-fatal */
      }
    }

    const cv = await structureCV(text, match, linkedinContext);
    return NextResponse.json({ cv, scraped });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Build failed" },
      { status: 500 }
    );
  }
}
