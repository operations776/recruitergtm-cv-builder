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
      { role: "user", content: rawText.slice(0, 12000) },
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
          "RULES: Never invent experience, dates, employers, skills, or contact details. " +
          "Only include an email/phone if explicitly present in the provided context; otherwise omit and rely on LinkedIn. " +
          "Write crisp, professional bullet points. Keep it truthful. " +
          "Respond as JSON matching this TypeScript type: " +
          "{ name, headline, location, contact:{linkedin,email,emailStatus,phone}, about, " +
          "experience:[{title,employer,dates,location,industry,bullets:[string],tags:[string]}], " +
          "education:[{degree,school,field,dates,location}], " +
          "skills:{technical:[string],functional:[string]}, certifications:[string], languages:[string], " +
          "desired:{role,type,level,cities:[string],salary}, meta:{sourceId,recency,matchConfidence:[string]} }.",
      },
      {
        role: "user",
        content: JSON.stringify({
          pastedCV: rawText.slice(0, 12000),
          confirmedPerson: match,
          linkedinContext: linkedinContext?.slice(0, 6000) || "",
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
    },
    about: obj.about,
    experience: obj.experience || [],
    education: obj.education || [],
    skills: {
      technical: obj.skills?.technical || [],
      functional: obj.skills?.functional || [],
    },
    certifications: obj.certifications || [],
    languages: obj.languages || [],
    desired: obj.desired,
    meta: {
      ...obj.meta,
      matchConfidence: match.confidencePoints,
    },
  };
}
