// Apify client — scrapes a full LinkedIn profile so the CV is built from real
// profile data (every role with its description, education, certifications,
// projects, recommendations) instead of thin search summaries.
//
// Actor: harvestapi/linkedin-profile-scraper (no cookies, ~$0.004 per profile).
// We use run-sync-get-dataset-items so one HTTP call returns the scraped items.

const ACTOR = "harvestapi~linkedin-profile-scraper";
const RUN_SYNC = `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items`;

export interface ScrapedProfile {
  /** Compact, model-friendly text block describing the whole profile. */
  text: string;
  /** A few structured bits we can use directly. */
  headline?: string;
  about?: string;
  location?: string;
  linkedinUrl?: string;
  /** Profile photo already embedded as a data URI (LinkedIn URLs expire). */
  photo?: string;
}

/**
 * LinkedIn photo URLs are signed and expire, so download the image now and
 * inline it as a data URI. Returns undefined on any failure — a missing photo
 * must never break a build.
 */
async function embedPhoto(url?: string): Promise<string | undefined> {
  if (!url) return undefined;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return undefined;
    const type = res.headers.get("content-type") || "image/jpeg";
    if (!type.startsWith("image/")) return undefined;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > 4_000_000) return undefined; // keep the PDF sane
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return undefined;
  }
}

/** Pick a reasonably sized photo (~400px) from the actor's size list. */
function pickPhotoUrl(p: any): string | undefined {
  const sizes = p?.profilePicture?.sizes;
  if (Array.isArray(sizes) && sizes.length) {
    const sorted = [...sizes].sort((a, b) => (b.width || 0) - (a.width || 0));
    const best = sorted.find((s) => (s.width || 0) <= 400) || sorted[0];
    if (best?.url) return best.url;
  }
  return p?.profilePicture?.url || p?.photo || undefined;
}

function dateText(d: any): string {
  if (!d) return "";
  if (typeof d === "string") return d;
  return d.text || [d.month, d.year].filter(Boolean).join(" ");
}

/**
 * Scrape one LinkedIn profile. Returns null when the scrape yields nothing —
 * callers should fall back to whatever context they already have rather than
 * failing the whole build.
 */
export async function scrapeLinkedIn(
  profileUrl: string,
  timeoutMs = 90_000
): Promise<ScrapedProfile | null> {
  const token = process.env.APIFY_TOKEN;
  if (!token) return null; // feature is optional — no token, no scrape
  if (!profileUrl) return null;

  const url = profileUrl.startsWith("http")
    ? profileUrl
    : `https://${profileUrl}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(`${RUN_SYNC}?token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileScraperMode: "Profile details no email ($4 per 1k)",
        queries: [url],
      }),
      signal: ctrl.signal,
    });

    if (!res.ok) return null;
    const items = (await res.json()) as any[];
    const p = Array.isArray(items) ? items[0] : null;
    if (!p || (!p.experience && !p.headline && !p.about)) return null;

    const photo = await embedPhoto(pickPhotoUrl(p));
    return { ...toText(p), linkedinUrl: p.linkedinUrl || url, photo };
  } catch {
    return null; // timeouts / network / actor errors are non-fatal
  } finally {
    clearTimeout(timer);
  }
}

/** Flatten the actor's rich JSON into a text block the model can read. */
function toText(p: any): ScrapedProfile {
  const lines: string[] = [];
  const name = [p.firstName, p.lastName].filter(Boolean).join(" ");
  const location = p.location?.linkedinText || p.location?.parsed?.text;

  if (name) lines.push(`NAME: ${name}`);
  if (p.headline) lines.push(`HEADLINE: ${p.headline}`);
  if (location) lines.push(`LOCATION: ${location}`);
  if (p.about) lines.push(`\nABOUT:\n${p.about}`);

  const exp = [...(p.currentPosition || []), ...(p.experience || [])];
  if (exp.length) {
    lines.push("\nEXPERIENCE:");
    const seen = new Set<string>();
    for (const e of exp) {
      const key = `${e.position}|${e.companyName}|${dateText(e.startDate)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const period =
        [dateText(e.startDate), dateText(e.endDate) || "Present"]
          .filter(Boolean)
          .join(" - ") + (e.duration ? ` (${e.duration})` : "");
      lines.push(
        `- ${e.position || ""} at ${e.companyName || ""} | ${period}` +
          (e.location ? ` | ${e.location}` : "") +
          (e.employmentType ? ` | ${e.employmentType}` : "")
      );
      if (e.description) lines.push(`  ${e.description.replace(/\n+/g, "\n  ")}`);
      if (e.skills?.length) lines.push(`  Skills: ${e.skills.join(", ")}`);
    }
  }

  if (p.education?.length) {
    lines.push("\nEDUCATION:");
    for (const ed of p.education) {
      lines.push(
        `- ${[ed.degree, ed.fieldOfStudy].filter(Boolean).join(", ")} — ${
          ed.schoolName || ""
        }${ed.period ? ` | ${ed.period}` : ""}`
      );
    }
  }

  if (p.certifications?.length) {
    lines.push("\nCERTIFICATIONS:");
    for (const c of p.certifications) {
      lines.push(
        `- ${c.title || ""}${c.issuedBy ? ` — ${c.issuedBy}` : ""}${
          c.issuedAt ? ` (${c.issuedAt})` : ""
        }`
      );
    }
  }

  if (Array.isArray(p.projects) && p.projects.length) {
    lines.push("\nPROJECTS:");
    for (const pr of p.projects) {
      if (typeof pr === "string") lines.push(`- ${pr}`);
      else
        lines.push(
          `- ${pr.title || pr.name || ""}${pr.period ? ` (${pr.period})` : ""}${
            pr.description ? `: ${pr.description}` : ""
          }`
        );
    }
  }

  const skills =
    p.topSkills?.length
      ? p.topSkills
      : (p.skills || []).map((s: any) => s?.name).filter(Boolean);
  if (skills.length) lines.push(`\nSKILLS: ${skills.join(", ")}`);

  if (p.languages?.length) {
    // LinkedIn returns language names in mixed locales (e.g. "Engleză",
    // "francouzština"). Keep the proficiency, let the model normalise the name.
    lines.push(
      `\nLANGUAGES (names may be in the profile's own locale — normalise to English): ${p.languages
        .map((l: any) =>
          typeof l === "string"
            ? l
            : [l?.name, l?.proficiency].filter(Boolean).join(" — ")
        )
        .filter(Boolean)
        .join("; ")}`
    );
  }

  if (p.receivedRecommendations?.length) {
    lines.push("\nRECOMMENDATIONS:");
    for (const r of p.receivedRecommendations.slice(0, 3)) {
      lines.push(`- "${r.description || ""}" — ${r.givenBy || ""}${
        r.givenByHeadline ? `, ${r.givenByHeadline}` : ""
      }`);
    }
  }

  if (p.volunteering?.length) {
    lines.push("\nVOLUNTEERING:");
    for (const v of p.volunteering) {
      lines.push(
        `- ${v.role || ""} at ${v.organizationName || ""}${
          v.duration ? ` (${v.duration})` : ""
        }`
      );
    }
  }

  if (p.honorsAndAwards?.length) {
    lines.push("\nHONORS & AWARDS:");
    for (const a of p.honorsAndAwards) {
      if (typeof a === "string") lines.push(`- ${a}`);
      else
        lines.push(
          `- ${a.title || ""}${a.issuedBy ? ` — ${a.issuedBy}` : ""}${
            a.issuedAt ? ` (${a.issuedAt})` : ""
          }`
        );
    }
  }

  if (p.courses?.length) {
    lines.push("\nCOURSES:");
    for (const c of p.courses) {
      if (typeof c === "string") lines.push(`- ${c}`);
      else lines.push(`- ${c.title || ""}${c.number ? ` (${c.number})` : ""}`);
    }
  }

  if (p.publications?.length) {
    lines.push("\nPUBLICATIONS:");
    for (const pub of p.publications) {
      lines.push(
        `- ${pub.title || ""}${pub.publishedAt ? ` (${pub.publishedAt})` : ""}${
          pub.description ? `: ${pub.description}` : ""
        }`
      );
    }
  }

  return {
    text: lines.join("\n"),
    headline: p.headline,
    about: p.about,
    location,
  };
}
