// Step 3: render-ready CV JSON -> streamed PDF file.
import { NextRequest, NextResponse } from "next/server";
import { checkPassword, unauthorized } from "@/lib/auth";
import { renderToBuffer } from "@react-pdf/renderer";
import { CVDocument } from "@/lib/pdf";
import type { CandidateCV } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!checkPassword(req)) return unauthorized();

  try {
    const { cv } = (await req.json()) as { cv: CandidateCV };
    if (!cv || !cv.name) {
      return NextResponse.json({ error: "Missing CV data." }, { status: 400 });
    }

    const buffer = await renderToBuffer(<CVDocument cv={cv} />);
    const body = new Uint8Array(buffer);

    const filename = `${cv.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-cv.pdf`;
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "PDF render failed" },
      { status: 500 }
    );
  }
}
