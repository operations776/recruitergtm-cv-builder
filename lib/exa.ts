// Thin Exa client — reverse-searches a real person from a CV fingerprint.
// Uses the /search endpoint with category "people" + summaries.

const EXA_ENDPOINT = "https://api.exa.ai/search";

export interface ExaResult {
  title?: string;
  url?: string;
  summary?: string;
}

export async function exaPeopleSearch(
  query: string,
  numResults = 8
): Promise<ExaResult[]> {
  const key = process.env.EXA_API_KEY;
  if (!key) throw new Error("EXA_API_KEY is not set");

  const res = await fetch(EXA_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
    },
    body: JSON.stringify({
      query,
      type: "auto",
      category: "people",
      numResults,
      contents: {
        summary: {
          query:
            "Who is this person, current role and employer, prior employers, education, and any details that confirm identity.",
        },
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Exa search failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as { results?: ExaResult[] };
  return (data.results ?? []).map((r) => ({
    title: r.title,
    url: r.url,
    summary: r.summary,
  }));
}
