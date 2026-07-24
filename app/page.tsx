"use client";

import { useState } from "react";
import Image from "next/image";
import type { CandidateCV, MatchCandidate } from "@/lib/types";
import type { RunSummary } from "@/lib/db";

type Stage = "gate" | "paste" | "confirm" | "preview";

const STEPS: { key: Stage; n: string; label: string }[] = [
  { key: "gate", n: "01", label: "Unlock" },
  { key: "paste", n: "02", label: "Paste profile" },
  { key: "confirm", n: "03", label: "Confirm match" },
  { key: "preview", n: "04", label: "Build & export" },
];

export default function Home() {
  const [stage, setStage] = useState<Stage>("gate");
  const [password, setPassword] = useState("");
  const [text, setText] = useState("");
  const [match, setMatch] = useState<MatchCandidate | null>(null);
  const [cv, setCv] = useState<CandidateCV | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Contact enrichment (Prospeo) — each button tracks its own state so one
  // can run while the other stays clickable.
  const [enriching, setEnriching] = useState<null | "email" | "phone">(null);
  const [enrichNote, setEnrichNote] = useState<{
    kind: "ok" | "miss";
    text: string;
  } | null>(null);

  // Past runs, so the team can find and re-export earlier CVs.
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [historyOn, setHistoryOn] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const authHeaders = {
    "Content-Type": "application/json",
    "x-app-password": password,
  };

  async function login() {
    setError("");
    setLoading(true);
    try {
      const r = await fetch("/api/login", { method: "POST", headers: authHeaders });
      if (!r.ok) throw new Error("That password didn't match. Try again.");
      setStage("paste");
      loadHistory();
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
      if (!r.ok) throw new Error(data.error || "Couldn't run the search. Try again.");
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
      if (!r.ok) throw new Error(data.error || "Couldn't build the CV. Try again.");
      setCv(data.cv);
      setStage("preview");
      loadHistory();
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
        throw new Error(d.error || "Couldn't render the PDF. Try again.");
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(cv?.name || "candidate")
        .replace(/\s+/g, "-")
        .toLowerCase()}-cv.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function enrich(mode: "email" | "phone") {
    if (!cv) return;
    setError("");
    setEnrichNote(null);
    setEnriching(mode);
    try {
      const r = await fetch("/api/enrich", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ cv, mode }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Couldn't run the lookup.");

      // Merge whatever came back into the CV so it lands in the PDF too.
      setCv((prev) =>
        prev
          ? {
              ...prev,
              contact: {
                ...prev.contact,
                email: d.email || prev.contact.email,
                emailStatus: d.email
                  ? d.emailStatus === "VERIFIED"
                    ? "verified"
                    : "unknown"
                  : prev.contact.emailStatus,
                phone: d.mobile || prev.contact.phone,
              },
            }
          : prev
      );

      const got = mode === "phone" ? d.mobile : d.email;
      if (got) {
        setEnrichNote({
          kind: "ok",
          text:
            mode === "phone"
              ? `Mobile found. ${d.creditsUsed} credits used.`
              : `Email found. ${d.creditsUsed} credit used.`,
        });
      } else {
        setEnrichNote({
          kind: "miss",
          text:
            mode === "phone"
              ? "No mobile on record for this person. No credits charged."
              : "No email on record for this person. No credits charged.",
        });
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setEnriching(null);
    }
  }

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const r = await fetch("/api/runs", { headers: authHeaders });
      const d = await r.json();
      if (r.ok) {
        setRuns(d.runs || []);
        setHistoryOn(!!d.enabled);
      }
    } catch {
      /* history is optional — stay quiet */
    } finally {
      setHistoryLoading(false);
    }
  }

  async function openRun(id: string) {
    setError("");
    setHistoryLoading(true);
    try {
      const r = await fetch(`/api/runs?id=${encodeURIComponent(id)}`, {
        headers: authHeaders,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Couldn't open that run.");
      setCv(d.run.cv);
      setMatch(null);
      setEnrichNote(null);
      setShowHistory(false);
      setStage("preview");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setHistoryLoading(false);
    }
  }

  function reset() {
    setText("");
    setMatch(null);
    setCv(null);
    setError("");
    setEnrichNote(null);
    setStage("paste");
  }

  const activeIndex = STEPS.findIndex((s) => s.key === stage);

  return (
    <div className="relative z-10 min-h-screen flex flex-col">
      <TopBar />

      <main className="flex-1 w-full max-w-6xl mx-auto px-5 sm:px-8 py-8 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8">
        <Rail steps={STEPS} activeIndex={activeIndex} />

        <section className="min-w-0">
          {stage !== "gate" && historyOn && (
            <div className="mb-5">
              <button
                onClick={() => {
                  setShowHistory((v) => !v);
                  if (!showHistory) loadHistory();
                }}
                className="text-xs font-semibold text-[var(--muted)] hover:text-[var(--violet-lite)] transition"
              >
                {showHistory ? "Hide" : "Show"} past CVs
                {runs.length ? ` (${runs.length})` : ""}
              </button>
              {showHistory && (
                <HistoryList
                  runs={runs}
                  loading={historyLoading}
                  onOpen={openRun}
                />
              )}
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-[#4a2233] bg-[#2a1420] px-4 py-3 text-sm text-[#fca5a5] rise"
            >
              {error}
            </div>
          )}

          {stage === "gate" && (
            <Panel
              eyebrow="Restricted tool"
              title="Sign in to the CV Builder"
              hint="Enter the team password to start building candidate CVs."
            >
              <label className="block text-xs font-medium text-[var(--muted)] mb-2">
                Team password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && password && login()}
                placeholder="••••••••••"
                className="w-full rounded-lg bg-[var(--ink-2)] border border-[var(--panel-line)] px-4 py-3 text-[var(--text)] placeholder:text-[var(--faint)] outline-none focus:border-[var(--violet-lite)] transition"
                autoFocus
              />
              <Primary onClick={login} loading={loading} disabled={!password}>
                Unlock
              </Primary>
            </Panel>
          )}

          {stage === "paste" && (
            <Panel
              eyebrow="Step 02"
              title="Paste the candidate's profile"
              hint="Copy the whole profile — summary, every role, certifications, projects. The more you paste, the fuller the CV."
            >
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={14}
                placeholder="Paste the full profile text here…"
                className="w-full rounded-lg bg-[var(--ink-2)] border border-[var(--panel-line)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--faint)] outline-none focus:border-[var(--violet-lite)] transition font-mono leading-relaxed resize-y"
                autoFocus
              />
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-[var(--faint)] font-mono">
                  {text.trim().length.toLocaleString()} chars
                </span>
                <Primary
                  onClick={identify}
                  loading={loading}
                  disabled={text.trim().length < 40}
                  inline
                >
                  {loading ? "Searching…" : "Find candidate →"}
                </Primary>
              </div>
            </Panel>
          )}

          {stage === "confirm" && match && (
            <Panel
              eyebrow="Step 03"
              title="Is this the right person?"
              hint="One look before we build. If it's not them, start over — we never attach a wrong match to a CV."
            >
              <MatchCard match={match} />
              <div className="mt-6 flex flex-wrap gap-3">
                <Primary onClick={build} loading={loading} inline>
                  {loading ? "Building…" : "Yes, build the CV"}
                </Primary>
                <Ghost onClick={reset}>Not them — start over</Ghost>
              </div>
            </Panel>
          )}

          {stage === "preview" && cv && (
            <Panel
              eyebrow="Step 04"
              title="CV is ready"
              hint="Branded, two-column, ready to send. Download the PDF or build another."
            >
              <CVPreview cv={cv} />

              <ContactBlock
                cv={cv}
                enriching={enriching}
                note={enrichNote}
                onEnrich={enrich}
              />

              <div className="mt-6 flex flex-wrap gap-3">
                <Primary onClick={download} loading={loading} inline>
                  {loading ? "Rendering…" : "↓ Download PDF"}
                </Primary>
                <Ghost onClick={reset}>Build another</Ghost>
              </div>
            </Panel>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}

/* ---------- Shell ---------- */

function TopBar() {
  return (
    <header className="border-b border-[var(--panel-line)] bg-[rgba(15,11,30,0.7)] backdrop-blur">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center gap-3">
        <Image
          src="/logo.png"
          alt="RecruiterGTM"
          width={36}
          height={36}
          className="rounded-lg"
        />
        <div className="leading-tight">
          <div className="font-display font-semibold tracking-tight text-[15px]">
            CV Builder
          </div>
          <div className="text-[11px] text-[var(--muted)]">by RecruiterGTM</div>
        </div>
        <span className="ml-auto text-[11px] font-mono text-[var(--faint)] hidden sm:block">
          paste · match · build
        </span>
      </div>
    </header>
  );
}

function Rail({
  steps,
  activeIndex,
}: {
  steps: { key: Stage; n: string; label: string }[];
  activeIndex: number;
}) {
  return (
    <nav className="hidden lg:block" aria-label="Progress">
      <ol className="sticky top-8 space-y-1">
        {steps.map((s, i) => {
          const state =
            i < activeIndex ? "done" : i === activeIndex ? "active" : "todo";
          return (
            <li key={s.key} className="flex items-center gap-3 py-2.5">
              <span
                className={[
                  "grid place-items-center h-8 w-8 rounded-lg text-[12px] font-mono font-medium border transition",
                  state === "active"
                    ? "bg-[var(--violet)] border-transparent text-white shadow-[0_0_0_4px_rgba(124,58,237,0.18)]"
                    : state === "done"
                    ? "bg-[var(--panel)] border-[var(--panel-line)] text-[var(--violet-lite)]"
                    : "bg-transparent border-[var(--panel-line)] text-[var(--faint)]",
                ].join(" ")}
              >
                {state === "done" ? "✓" : s.n}
              </span>
              <span
                className={[
                  "text-sm transition",
                  state === "active"
                    ? "text-[var(--text)] font-medium"
                    : state === "done"
                    ? "text-[var(--muted)]"
                    : "text-[var(--faint)]",
                ].join(" ")}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[var(--panel-line)] mt-4">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-5 text-[12px] text-[var(--faint)] flex flex-wrap items-center gap-1.5">
        <span>Made by</span>
        <a
          href="https://www.linkedin.com/in/daniyal-aziz-643309246"
          target="_blank"
          rel="noreferrer"
          className="text-[var(--muted)] hover:text-[var(--violet-lite)] underline underline-offset-2 transition"
        >
          Daniyal Aziz
        </a>
        <span>·</span>
        <a
          href="https://recruitergtm.io"
          target="_blank"
          rel="noreferrer"
          className="text-[var(--muted)] hover:text-[var(--violet-lite)] underline underline-offset-2 transition"
        >
          RecruiterGTM
        </a>
      </div>
    </footer>
  );
}

/* ---------- Building blocks ---------- */

function Panel({
  eyebrow,
  title,
  hint,
  children,
}: {
  eyebrow: string;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rise rounded-2xl border border-[var(--panel-line)] bg-[var(--ink-2)]/70 backdrop-blur p-6 sm:p-7 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.8)]">
      <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-[var(--violet-lite)] mb-2">
        {eyebrow}
      </div>
      <h1 className="font-display text-2xl font-semibold tracking-tight mb-1.5">
        {title}
      </h1>
      <p className="text-sm text-[var(--muted)] mb-6 max-w-xl">{hint}</p>
      {children}
    </div>
  );
}

function Primary({
  children,
  onClick,
  loading,
  disabled,
  inline,
}: {
  children: React.ReactNode;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  inline?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className={[
        inline ? "" : "mt-5 w-full",
        "rounded-lg px-5 py-3 font-medium text-white transition",
        "bg-gradient-to-b from-[var(--violet-lite)] to-[var(--violet)]",
        "shadow-[0_8px_24px_-8px_rgba(124,58,237,0.7)]",
        "hover:brightness-110 active:brightness-95",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Ghost({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg px-5 py-3 font-medium text-[var(--muted)] border border-[var(--panel-line)] hover:border-[var(--violet-lite)] hover:text-[var(--text)] transition"
    >
      {children}
    </button>
  );
}

/* ---------- Match card + confidence meter (the signature) ---------- */

function MatchCard({ match }: { match: MatchCandidate }) {
  const conf = match.confidence;
  const filled = conf === "high" ? 4 : conf === "medium" ? 3 : conf === "low" ? 1 : 0;
  const tone =
    conf === "high"
      ? "var(--good)"
      : conf === "medium"
      ? "var(--warn)"
      : "var(--bad)";

  return (
    <div className="rounded-xl border border-[var(--panel-line)] bg-[var(--panel)]/60 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="font-display text-xl font-semibold truncate">
            {match.name}
          </div>
          {match.headline && (
            <div className="text-sm text-[var(--muted)] mt-0.5 line-clamp-2">
              {match.headline}
            </div>
          )}
          {match.company && (
            <div className="text-xs text-[var(--faint)] mt-1">{match.company}</div>
          )}
        </div>
        <span
          className="shrink-0 text-[11px] font-mono uppercase tracking-wide px-2.5 py-1 rounded-full border"
          style={{ color: tone, borderColor: tone }}
        >
          {conf}
        </span>
      </div>

      {/* Confidence meter */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] text-[var(--faint)] mb-1.5">
          <span>Match confidence</span>
          <span className="font-mono">{filled}/4 signals</span>
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-2 flex-1 rounded-full transition"
              style={{
                background: i < filled ? tone : "var(--panel-line)",
              }}
            />
          ))}
        </div>
      </div>

      {match.linkedin && (
        <a
          href={
            match.linkedin.startsWith("http")
              ? match.linkedin
              : `https://${match.linkedin}`
          }
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 text-sm text-[var(--violet-lite)] hover:underline"
        >
          {match.linkedin.replace(/^https?:\/\//, "")} ↗
        </a>
      )}

      {match.confidencePoints?.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {match.confidencePoints.map((p, i) => (
            <li
              key={i}
              className="text-[11px] text-[var(--muted)] bg-[var(--ink-2)] border border-[var(--panel-line)] rounded-md px-2 py-1"
            >
              {p}
            </li>
          ))}
        </ul>
      )}

      {(conf === "low" || conf === "none") && (
        <p className="mt-4 text-xs text-[var(--warn)]">
          Weak match — verify before you send this to a client.
        </p>
      )}
    </div>
  );
}

/* ---------- CV preview (mirrors the PDF) ---------- */

/* ---------- Past runs ---------- */

function HistoryList({
  runs,
  loading,
  onOpen,
}: {
  runs: RunSummary[];
  loading: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="mt-3 rounded-xl border border-[var(--panel-line)] bg-[var(--ink-2)] divide-y divide-[var(--panel-line)] overflow-hidden">
      {loading && (
        <div className="px-4 py-3 text-xs text-[var(--faint)]">Loading…</div>
      )}
      {!loading && runs.length === 0 && (
        <div className="px-4 py-3 text-xs text-[var(--faint)]">
          No CVs yet. Every CV you build gets saved here.
        </div>
      )}
      {runs.map((r) => (
        <button
          key={r.id}
          onClick={() => onOpen(r.id)}
          className="w-full text-left px-4 py-3 hover:bg-[var(--panel)] transition flex items-baseline justify-between gap-3"
        >
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[var(--text)] truncate">
              {r.name}
            </span>
            <span className="block text-[11px] text-[var(--muted)] truncate">
              {[r.company, r.headline].filter(Boolean).join(" · ")}
            </span>
          </span>
          <span className="shrink-0 text-[11px] font-mono text-[var(--faint)]">
            {new Date(r.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </span>
        </button>
      ))}
    </div>
  );
}

/* ---------- Contact enrichment (Prospeo) ---------- */

function ContactBlock({
  cv,
  enriching,
  note,
  onEnrich,
}: {
  cv: CandidateCV;
  enriching: null | "email" | "phone";
  note: { kind: "ok" | "miss"; text: string } | null;
  onEnrich: (mode: "email" | "phone") => void;
}) {
  const email = cv.contact?.email;
  const phone = cv.contact?.phone;
  const busy = enriching !== null;

  return (
    <div className="mt-6 rounded-xl border border-[var(--panel-line)] bg-[var(--ink-2)] p-5">
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <h3 className="font-display font-semibold text-[15px]">Contact details</h3>
        <span className="text-[11px] font-mono text-[var(--faint)]">
          via Prospeo
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {/* Email */}
        <div className="rounded-lg border border-[var(--panel-line)] bg-[var(--panel)] p-4">
          <div className="text-[11px] uppercase tracking-wide text-[var(--faint)] mb-1">
            Work email
          </div>
          {email ? (
            <div className="min-w-0">
              <a
                href={`mailto:${email}`}
                className="block truncate text-sm text-[var(--text)] hover:text-[var(--violet-lite)] transition"
              >
                {email}
              </a>
              {cv.contact?.emailStatus === "verified" && (
                <span className="mt-1 inline-block text-[11px] text-[var(--good)]">
                  Verified
                </span>
              )}
            </div>
          ) : (
            <>
              <p className="text-sm text-[var(--muted)] mb-3">Not looked up yet.</p>
              <button
                onClick={() => onEnrich("email")}
                disabled={busy}
                className="rounded-lg bg-[var(--violet)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--violet-lite)] disabled:opacity-40"
              >
                {enriching === "email" ? "Looking up…" : "Find email"}
              </button>
              <div className="mt-2 text-[11px] font-mono text-[var(--faint)]">
                1 credit
              </div>
            </>
          )}
        </div>

        {/* Phone */}
        <div className="rounded-lg border border-[var(--panel-line)] bg-[var(--panel)] p-4">
          <div className="text-[11px] uppercase tracking-wide text-[var(--faint)] mb-1">
            Mobile
          </div>
          {phone ? (
            <a
              href={`tel:${phone.replace(/\s+/g, "")}`}
              className="block truncate text-sm text-[var(--text)] hover:text-[var(--violet-lite)] transition"
            >
              {phone}
            </a>
          ) : (
            <>
              <p className="text-sm text-[var(--muted)] mb-3">Not looked up yet.</p>
              <button
                onClick={() => onEnrich("phone")}
                disabled={busy}
                className="rounded-lg border border-[var(--violet)] px-4 py-2 text-sm font-semibold text-[var(--violet-lite)] transition hover:bg-[var(--violet)] hover:text-white disabled:opacity-40"
              >
                {enriching === "phone" ? "Looking up…" : "Find phone"}
              </button>
              <div className="mt-2 text-[11px] font-mono text-[var(--faint)]">
                10 credits · includes email
              </div>
            </>
          )}
        </div>
      </div>

      {note && (
        <p
          className={`mt-3 text-xs ${
            note.kind === "ok" ? "text-[var(--good)]" : "text-[var(--warn)]"
          }`}
        >
          {note.text}
        </p>
      )}

      <p className="mt-3 text-[11px] text-[var(--faint)]">
        Anything found is added to the PDF. Nothing is guessed — if Prospeo has no
        record, the field stays empty and no credits are charged.
      </p>
    </div>
  );
}

function CVPreview({ cv }: { cv: CandidateCV }) {
  return (
    <div className="rounded-xl overflow-hidden border border-[var(--panel-line)] bg-white text-[#1a1a1a]">
      <div className="h-1.5 bg-gradient-to-r from-[var(--violet)] to-[var(--violet-lite)]" />
      <div className="grid grid-cols-1 sm:grid-cols-[190px_1fr]">
        <aside className="bg-[#f5f3ff] p-5 space-y-4">
          <div>
            {cv.photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cv.photo}
                alt=""
                className="w-[68px] h-[68px] rounded-full object-cover mb-3"
              />
            )}
            <div className="font-display text-lg font-semibold leading-tight">
              {cv.name}
            </div>
            <div className="text-[11px] text-[#7c3aed] mt-1 leading-snug">
              {cv.headline}
            </div>
          </div>
          {cv.location && (
            <div className="text-[11px] text-[#4b5563]">{cv.location}</div>
          )}
          {cv.contact?.linkedin && (
            <div className="text-[11px] text-[#4b5563] break-all">
              {cv.contact.linkedin.replace(/^https?:\/\//, "")}
            </div>
          )}
          {cv.skills?.technical?.length > 0 && (
            <PreviewChips label="Technical" items={cv.skills.technical} />
          )}
          {cv.skills?.functional?.length > 0 && (
            <PreviewChips label="Functional" items={cv.skills.functional} />
          )}
          {cv.languages?.length > 0 && (
            <div>
              <SideH>Languages</SideH>
              <div className="text-[11px] text-[#4b5563]">
                {cv.languages.join(", ")}
              </div>
            </div>
          )}
          {cv.certifications?.length > 0 && (
            <div>
              <SideH>Certifications ({cv.certifications.length})</SideH>
              <ul className="text-[11px] text-[#4b5563] space-y-1">
                {cv.certifications.slice(0, 6).map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
                {cv.certifications.length > 6 && (
                  <li className="text-[#9ca3af]">
                    +{cv.certifications.length - 6} more
                  </li>
                )}
              </ul>
            </div>
          )}
        </aside>

        <section className="p-5 space-y-4">
          <div className="flex justify-end">
            <span className="font-display text-[13px] font-bold text-[#7c3aed]">
              RecruiterGTM
            </span>
          </div>
          {cv.about && (
            <p className="text-[12px] leading-relaxed text-[#4b5563]">{cv.about}</p>
          )}
          {cv.experience?.length > 0 && (
            <div>
              <MainH>Experience ({cv.experience.length})</MainH>
              <div className="space-y-3">
                {cv.experience.map((e, i) => (
                  <div key={i}>
                    <div className="font-semibold text-[13px] text-[#1a1a1a]">
                      {e.title}
                    </div>
                    <div className="text-[11px] text-[#9ca3af]">
                      {[e.employer, e.dates, e.location]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                    <ul className="ml-4 list-disc text-[11px] text-[#4b5563] mt-1 space-y-0.5">
                      {e.bullets?.slice(0, 3).map((b, j) => (
                        <li key={j}>{b}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
          {cv.projects?.length > 0 && (
            <div>
              <MainH>Key Projects ({cv.projects.length})</MainH>
              <ul className="text-[11px] text-[#4b5563] space-y-1">
                {cv.projects.map((p, i) => (
                  <li key={i}>
                    <span className="font-medium text-[#1a1a1a]">{p.name}</span>
                    {p.dates ? ` — ${p.dates}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function PreviewChips({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <SideH>{label}</SideH>
      <div className="flex flex-wrap gap-1">
        {items.slice(0, 12).map((k, i) => (
          <span
            key={i}
            className="text-[10px] bg-white text-[#5b21b6] rounded px-1.5 py-0.5 border border-[#e5e7eb] max-w-full break-words leading-snug"
          >
            {k}
          </span>
        ))}
        {items.length > 12 && (
          <span className="text-[10px] text-[#9ca3af] px-1 py-0.5">
            +{items.length - 12} more
          </span>
        )}
      </div>
    </div>
  );
}

function SideH({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold uppercase tracking-wider text-[#5b21b6] mb-1.5">
      {children}
    </div>
  );
}

function MainH({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-bold uppercase tracking-wider text-[#5b21b6] border-b border-[#e5e7eb] pb-1 mb-2">
      {children}
    </div>
  );
}
