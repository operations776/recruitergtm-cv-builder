// Contact enrichment via Prospeo. Two modes, two buttons in the UI:
//   mode "email" -> 1 credit,  returns the verified work email
//   mode "phone" -> 10 credits, returns the mobile (email comes along free)
import { NextRequest, NextResponse } from "next/server";
import { checkPassword, unauthorized } from "@/lib/auth";
import { prospeoEnrich } from "@/lib/prospeo";
import type { CandidateCV } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!checkPassword(req)) return unauthorized();

  try {
    const { cv, mode } = (await req.json()) as {
      cv: CandidateCV;
      mode: "email" | "phone";
    };

    if (!cv?.name) {
      return NextResponse.json({ error: "Missing candidate." }, { status: 400 });
    }
    if (mode !== "email" && mode !== "phone") {
      return NextResponse.json({ error: "Unknown mode." }, { status: 400 });
    }

    const [firstName, ...rest] = cv.name.trim().split(/\s+/);
    const currentRole = cv.experience?.[0];

    const result = await prospeoEnrich(
      {
        fullName: cv.name,
        firstName,
        lastName: rest.join(" ") || undefined,
        linkedinUrl: cv.contact?.linkedin,
        companyName: currentRole?.employer,
        companyWebsite: cv.contact?.companyDomain,
      },
      mode === "phone"
    );

    return NextResponse.json({
      email: result.email,
      emailStatus: result.emailStatus,
      mobile: result.mobile,
      mobileStatus: result.mobileStatus,
      charged: result.charged,
      creditsUsed: result.charged ? (mode === "phone" ? 10 : 1) : 0,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Enrichment failed" },
      { status: 500 }
    );
  }
}
