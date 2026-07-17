// Step 1: paste text -> fingerprint (OpenAI) -> reverse-search (Exa) -> match card.
import { NextRequest, NextResponse } from "next/server";
import { checkPassword, unauthorized } from "@/lib/auth";
import { extractFingerprint, matchPerson } from "@/lib/openai";
import { exaPeopleSearch } from "@/lib/exa";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!checkPassword(req)) return unauthorized();

  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string" || text.trim().length < 40) {
      return NextResponse.json(
        { error: "Paste the candidate's CV text (at least a few lines)." },
        { status: 400 }
      );
    }

    const parsed = await extractFingerprint(text);

    // Build a natural-language fingerprint query for Exa.
    const q = [
      parsed.currentRole,
      "at",
      parsed.currentEmployer,
      parsed.priorEmployer ? `previously ${parsed.priorEmployer}` : "",
      parsed.university || "",
      parsed.city || "",
      parsed.country || "",
    ]
      .filter(Boolean)
      .join(" ");

    const results = await exaPeopleSearch(q || parsed.headline, 8);
    const match = await matchPerson(parsed, results);

    return NextResponse.json({ parsed, match });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Identify failed" },
      { status: 500 }
    );
  }
}
