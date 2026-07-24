// OpenAI helpers for the two model steps: parse the fingerprint, and
// structure the final CV. Both use JSON mode so we get clean objects back.

import OpenAI from "openai";
import type { ParsedCV, MatchCandidate, CandidateCV } from "./types";
import type { ExaResult } from "./exa";

function client(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  return new OpenAI({ apiKey: key });
}

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

// Step 1a — extract a search fingerprint from pasted CV text.
export async function extractFingerprint(rawText: string): Promise<ParsedCV> {
  const res = await client().chat.completions.create({
    model: MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You extract a person-identification fingerprint from a pasted CV/profile. " +
          "Return ONLY facts present in the text. Do not invent. " +
          "Respond as JSON with keys: headline, currentRole, currentEmployer, priorEmployer, university, city, country.",
      },
      { role: "user", content: rawText.slice(0, 20000) },
    ],
  });
  const obj = JSON.parse(res.choices[0].message.content || "{}");
  return { ...obj, rawText };
}

// Step 1b — pick the best-matching person from Exa results and score confidence.
export async function matchPerson(
  parsed: ParsedCV,
  exaResults: ExaResult[]
): Promise<MatchCandidate> {
  const res = await client().chat.completions.create({
    model: MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You match a CV fingerprint to the correct person from web search results. " +
          "Confirm identity ONLY when multiple independent points agree (employer+dates, university, city, prior employer, a course/cert year, a tech detail). " +
          "confidence: 'high' = 3+ points; 'medium' = 2; 'low' = 1; 'none' = no credible match. " +
          "Prefer a LinkedIn URL as the contact. Never fabricate a person. " +
          "Respond as JSON: { name, linkedin, headline, company, summary, confidence, confidencePoints: string[] }.",
      },
      {
        role: "user",
        content: JSON.stringify({
          fingerprint: {
            headline: parsed.headline,
            currentEmployer: parsed.currentEmployer,
            priorEmployer: parsed.priorEmployer,
            university: parsed.university,
            city: parsed.city,
          },
          searchResults: exaResults.slice(0, 8),
        }),
      },
    ],
  });
  const obj = JSON.parse(res.choices[0].message.content || "{}");
  return {
    name: obj.name || parsed.currentRole || "Candidate",
    linkedin: obj.linkedin,
    headline: obj.headline,
    company: obj.company,
    summary: obj.summary,
    confidence: obj.confidence || "none",
    confidencePoints: Array.isArray(obj.confidencePoints)
      ? obj.confidencePoints
      : [],
  };
}

// Step 2 — merge pasted CV + confirmed match into the final render-ready CV.
export async function structureCV(
  rawText: string,
  match: MatchCandidate,
  linkedinContext?: string
): Promise<CandidateCV> {
  const res = await client().chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You produce a clean, accurate, render-ready CV as JSON for a recruitment agency. " +
          "Merge the pasted CV text with the confirmed person's public profile. " +
          "When linkedinContext is a scraped LinkedIn profile it is the FRESHER, more authoritative " +
          "source: prefer its employer names, role splits, dates and achievement bullets over the " +
          "pasted text where they disagree (the paste may use an old company name or merge roles). " +
          "Normalise language names to English (e.g. 'Engleză' -> 'English'). " +
          "BE EXHAUSTIVE: capture EVERY role in the work history (do not stop at the first two), " +
          "EVERY education entry, EVERY certification/license, and EVERY project mentioned. " +
          "If the source lists 4 jobs and 20 certifications, output all 4 jobs and all 20 certifications. " +
          "Preserve exact employer names as written (including rebrands, e.g. a company shown as 'Qemetica' " +
          "stays 'Qemetica'), exact dates, and exact durations. " +
          "For each role, keep the real achievement bullets from the source; do not collapse them to one line. " +
          "RULES: Never invent experience, dates, employers, skills, or contact details. " +
          "Only include an email/phone if explicitly present in the provided context; otherwise omit and rely on LinkedIn. " +
          "For certifications, include the issuer and year when present (e.g. 'Cisco AI Technical Practitioner (AITECH) — Cisco, 2026'). " +
          "Split skills into technical (tools/tech) and functional (management/process). " +
          "If a recommendation is present, capture its text and author. " +
          "Set contact.companyDomain to the current employer's website domain (e.g. 'dentons.com') " +
          "when you can infer it confidently from the employer name; otherwise leave it out. " +
          "Respond as JSON matching this TypeScript type: " +
          "{ name, headline, location, contact:{linkedin,email,emailStatus,phone,companyDomain}, about, " +
          "experience:[{title,employer,dates,location,industry,bullets:[string],tags:[string]}], " +
          "education:[{degree,school,field,dates,location}], " +
          "skills:{technical:[string],functional:[string]}, certifications:[string], " +
          "projects:[{name,dates,context,description}], " +
          "volunteering:[{role,organization,dates}], awards:[{title,issuer,date}], " +
          "recommendation:{text,author}, languages:[string], " +
          "desired:{role,type,level,cities:[string],salary}, meta:{sourceId,recency,matchConfidence:[string]} }.",
      },
      {
        role: "user",
        content: JSON.stringify({
          pastedCV: rawText.slice(0, 40000),
          confirmedPerson: match,
          linkedinContext: linkedinContext?.slice(0, 24000) || "",
        }),
      },
    ],
  });
  const obj = JSON.parse(res.choices[0].message.content || "{}");

  // Defensive defaults so the PDF renderer never hits undefined.
  return {
    name: obj.name || match.name,
    headline: obj.headline || match.headline || "",
    location: obj.location,
    contact: {
      linkedin: obj.contact?.linkedin || match.linkedin,
      email: obj.contact?.email,
      emailStatus: obj.contact?.emailStatus || "unknown",
      phone: obj.contact?.phone,
      companyDomain: obj.contact?.companyDomain,
    },
    about: obj.about,
    experience: obj.experience || [],
    education: obj.education || [],
    skills: {
      technical: obj.skills?.technical || [],
      functional: obj.skills?.functional || [],
    },
    certifications: obj.certifications || [],
    projects: obj.projects || [],
    volunteering: obj.volunteering || [],
    awards: obj.awards || [],
    recommendation: obj.recommendation,
    languages: obj.languages || [],
    desired: obj.desired,
    meta: {
      ...obj.meta,
      matchConfidence: match.confidencePoints,
    },
  };
}
