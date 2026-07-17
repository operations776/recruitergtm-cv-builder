"use client";

import { useState } from "react";
import type { CandidateCV, MatchCandidate } from "@/lib/types";

type Stage = "gate" | "paste" | "confirm" | "preview";

export default function Home() {
  const [stage, setStage] = useState<Stage>("gate");
  const [password, setPassword] = useState("");
  const [text, setText] = useState("");
  const [match, setMatch] = useState<MatchCandidate | null>(null);
  const [cv, setCv] = useState<CandidateCV | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const authHeaders = { "Content-Type": "application/json", "x-app-password": password };

  async function login() {
    setError("");
    setLoading(true);
    try {
      const r = await fetch("/api/login", { method: "POST", headers: authHeaders });
      if (!r.ok) throw new Error("Wrong password.");
      setStage("paste");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function identify() {
    setError("");
    setLoading(true);
    setMatch(null);
    try {
      const r = await fetch("/api/identify", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ text }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Identify failed");
      setMatch(data.match);
      setStage("confirm");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function build() {
    setError("");
    setLoading(true);
    try {
      const r = await fetch("/api/build", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ text, match }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Build failed");
      setCv(data.cv);
      setStage("preview");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function download() {
    setError("");
    setLoading(true);
    try {
      const r = await fetch("/api/pdf", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ cv }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || "PDF failed");
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(cv?.name || "candidate").replace(/\s+/g, "-").toLowerCase()}-cv.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setText("");
    setMatch(null);
    setCv(null);
    setError("");
    setStage("paste");
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-brand-line bg-white">
        <div className="mx-auto max-w-4xl px-6 py-4 flex items-center gap-3">
          <div className="h-7 w-7 rounded-md bg-brand-purple" />
          <div>
            <div className="font-bold text-brand-ink leading-none">RecruiterGTM</div>
            <div className="text-xs text-brand-muted">CV Builder</div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-8">
        {error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {stage === "gate" && (
          <Card title="Enter password">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && login()}
              placeholder="Team password"
              className="w-full rounded-lg border border-brand-line px-4 py-2.5 outline-none focus:border-brand-purple"
            />
            <PrimaryBtn onClick={login} loading={loading}>
              Unlock
            </PrimaryBtn>
          </Card>
        )}

        {stage === "paste" && (
          <Card title="Paste the candidate's CV / profile text">
            <p className="mb-3 text-sm text-brand-slate">
              Copy the candidate's public profile text and paste it below. We'll find the
              person and build a clean CV.
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
              placeholder="Paste here…"
              className="w-full rounded-lg border border-brand-line px-4 py-3 text-sm outline-none focus:border-brand-purple font-mono"
            />
            <PrimaryBtn onClick={identify} loading={loading} disabled={text.trim().length < 40}>
              Find candidate
            </PrimaryBtn>
          </Card>
        )}

        {stage === "confirm" && match && (
          <Card title="Is this the right person?">
            <MatchCard match={match} />
            <div className="mt-5 flex gap-3">
              <PrimaryBtn onClick={build} loading={loading}>
                Yes, build CV
              </PrimaryBtn>
              <GhostBtn onClick={reset}>Not them / start over</GhostBtn>
            </div>
            {match.confidence === "low" || match.confidence === "none" ? (
              <p className="mt-3 text-xs text-amber-600">
                Low confidence match — double-check before sending to a client. You can still
                build from the pasted text.
              </p>
            ) : null}
          </Card>
        )}

        {stage === "preview" && cv && (
          <Card title="CV ready">
            <CVPreview cv={cv} />
            <div className="mt-5 flex gap-3">
              <PrimaryBtn onClick={download} loading={loading}>
                Download PDF
              </PrimaryBtn>
              <GhostBtn onClick={reset}>Build another</GhostBtn>
            </div>
          </Card>
        )}
      </div>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-brand-line bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-bold text-brand-ink">{title}</h2>
      {children}
    </div>
  );
}

function PrimaryBtn({
  children,
  onClick,
  loading,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className="mt-4 rounded-lg bg-brand-purple px-5 py-2.5 font-semibold text-white transition hover:bg-brand-dark disabled:opacity-40"
    >
      {loading ? "Working…" : children}
    </button>
  );
}

function GhostBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mt-4 rounded-lg border border-brand-line px-5 py-2.5 font-semibold text-brand-slate transition hover:bg-brand-tint"
    >
      {children}
    </button>
  );
}

function MatchCard({ match }: { match: MatchCandidate }) {
  const color =
    match.confidence === "high"
      ? "bg-green-100 text-green-700"
      : match.confidence === "medium"
      ? "bg-amber-100 text-amber-700"
      : "bg-red-100 text-red-700";
  return (
    <div className="rounded-xl border border-brand-line bg-brand-tint p-4">
      <div className="flex items-center justify-between">
        <div className="text-lg font-bold text-brand-ink">{match.name}</div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}>
          {match.confidence} confidence
        </span>
      </div>
      {match.headline && <div className="text-sm text-brand-slate">{match.headline}</div>}
      {match.company && <div className="text-sm text-brand-muted">{match.company}</div>}
      {match.linkedin && (
        <a
          href={match.linkedin.startsWith("http") ? match.linkedin : `https://${match.linkedin}`}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-block text-sm text-brand-purple underline"
        >
          {match.linkedin.replace(/^https?:\/\//, "")}
        </a>
      )}
      {match.confidencePoints?.length > 0 && (
        <div className="mt-3 text-xs text-brand-slate">
          Matched on: {match.confidencePoints.join("; ")}
        </div>
      )}
    </div>
  );
}

function CVPreview({ cv }: { cv: CandidateCV }) {
  return (
    <div className="grid grid-cols-3 gap-6 rounded-xl border border-brand-line p-5 text-sm">
      <aside className="col-span-1 space-y-3">
        <div className="text-base font-bold text-brand-ink">{cv.name}</div>
        <div className="text-xs text-brand-purple">{cv.headline}</div>
        {cv.location && <div className="text-xs text-brand-slate">{cv.location}</div>}
        {cv.contact?.linkedin && (
          <div className="text-xs text-brand-slate break-all">{cv.contact.linkedin}</div>
        )}
        {cv.skills?.technical?.length > 0 && (
          <div>
            <div className="mt-2 text-xs font-bold uppercase text-brand-dark">Skills</div>
            <div className="text-xs text-brand-slate">{cv.skills.technical.join(", ")}</div>
          </div>
        )}
        {cv.languages?.length > 0 && (
          <div>
            <div className="mt-2 text-xs font-bold uppercase text-brand-dark">Languages</div>
            <div className="text-xs text-brand-slate">{cv.languages.join(", ")}</div>
          </div>
        )}
      </aside>
      <section className="col-span-2 space-y-3">
        {cv.about && <p className="text-xs leading-relaxed text-brand-slate">{cv.about}</p>}
        {cv.experience?.map((e, i) => (
          <div key={i}>
            <div className="font-bold text-brand-ink">{e.title}</div>
            <div className="text-xs text-brand-muted">
              {[e.employer, e.dates].filter(Boolean).join(" · ")}
            </div>
            <ul className="ml-4 list-disc text-xs text-brand-slate">
              {e.bullets?.slice(0, 4).map((b, j) => (
                <li key={j}>{b}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
