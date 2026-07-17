// Step 2: confirmed match + pasted text -> structured render-ready CV (OpenAI).
// Optionally pulls LinkedIn context via Exa contents for richer bullets.
import { NextRequest, NextResponse } from "next/server";
import { checkPassword, unauthorized } from "@/lib/auth";
import { structureCV } from "@/lib/openai";
import { exaPeopleSearch } from "@/lib/exa";
import type { MatchCandidate } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

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

    // Pull a bit of LinkedIn context to enrich (best-effort; ignore failures).
    let linkedinContext = match.summary || "";
    if (match.linkedin) {
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
    return NextResponse.json({ cv });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Build failed" },
      { status: 500 }
    );
  }
}
