// Prospeo client — finds a candidate's verified work email and mobile.
// Docs: POST https://api.prospeo.io/enrich-person with an X-KEY header.
//
// Credits (per Prospeo): 1 credit per email found; 10 credits per mobile found
// (email included free with mobile). No charge when nothing is found, and no
// charge when re-enriching the same record within 90 days.

const ENDPOINT = "https://api.prospeo.io/enrich-person";

export interface ProspeoIdentity {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  linkedinUrl?: string;
  companyName?: string;
  companyWebsite?: string;
  companyLinkedinUrl?: string;
}

export interface ProspeoResult {
  email?: string;
  emailStatus?: string; // VERIFIED / CATCH_ALL / ...
  mobile?: string;
  mobileStatus?: string;
  charged: boolean; // false when Prospeo reported a free enrichment
  company?: string;
}

/** Map an error_code from Prospeo into something a recruiter can act on. */
function friendlyError(code?: string): string {
  switch (code) {
    case "NO_MATCH":
      return "No match found for this person.";
    case "INVALID_DATAPOINTS":
      return "Not enough detail to identify the person. A LinkedIn URL works best.";
    case "INSUFFICIENT_CREDITS":
      return "Prospeo credits exhausted.";
    case "INVALID_API_KEY":
      return "Prospeo API key is invalid.";
    default:
      return code ? `Prospeo error: ${code}` : "Prospeo lookup failed.";
  }
}

/**
 * Look up a person at Prospeo.
 * `wantMobile` = true costs 10 credits and returns email + mobile.
 * `wantMobile` = false costs 1 credit and returns the email only.
 */
export async function prospeoEnrich(
  who: ProspeoIdentity,
  wantMobile: boolean
): Promise<ProspeoResult> {
  const key = process.env.PROSPEO_API_KEY;
  if (!key) throw new Error("PROSPEO_API_KEY is not set");

  // Build the identity payload — send every datapoint we have, the docs are
  // explicit that more fields means a better match rate.
  const data: Record<string, string> = {};
  if (who.linkedinUrl) data.linkedin_url = normalizeLinkedIn(who.linkedinUrl);
  if (who.firstName) data.first_name = who.firstName;
  if (who.lastName) data.last_name = who.lastName;
  if (who.fullName) data.full_name = who.fullName;
  if (who.companyName) data.company_name = who.companyName;
  if (who.companyWebsite) data.company_website = who.companyWebsite;
  if (who.companyLinkedinUrl) data.company_linkedin_url = who.companyLinkedinUrl;

  // Minimum match requirement: a LinkedIn URL, or a name plus a company.
  const hasName = !!(data.full_name || (data.first_name && data.last_name));
  const hasCompany = !!(
    data.company_name ||
    data.company_website ||
    data.company_linkedin_url
  );
  if (!data.linkedin_url && !(hasName && hasCompany)) {
    throw new Error(
      "Need a LinkedIn URL, or a full name plus a company, to look this person up."
    );
  }

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-KEY": key },
    body: JSON.stringify({
      enrich_mobile: wantMobile,
      data,
    }),
  });

  const json: any = await res.json().catch(() => ({}));

  if (!res.ok || json?.error) {
    throw new Error(friendlyError(json?.error_code));
  }

  const person = json.person || {};
  return {
    email: person.email?.email || undefined,
    emailStatus: person.email?.status || undefined,
    mobile: person.mobile?.mobile || undefined,
    mobileStatus: person.mobile?.status || undefined,
    charged: json.free_enrichment === false,
    company: json.company?.name || undefined,
  };
}

function normalizeLinkedIn(u: string): string {
  const t = u.trim();
  return t.startsWith("http") ? t : `https://${t}`;
}
