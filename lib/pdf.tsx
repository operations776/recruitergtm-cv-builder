// Polished two-column CV, RecruiterGTM branded, rendered with @react-pdf/renderer.
// Left sidebar: contact, skills, languages, certs. Right: profile, experience, education.
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Link,
  Image,
} from "@react-pdf/renderer";
import type { CandidateCV } from "./types";

const PURPLE = "#7C3AED";
const DARK = "#5B21B6";
const TINT = "#F5F3FF";
const INK = "#1A1A1A";
const SLATE = "#4B5563";
const MUTED = "#9CA3AF";
const LINE = "#E5E7EB";
const WHITE = "#FFFFFF";

const SIDEBAR_W = 185;

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9.5, color: SLATE, flexDirection: "row" },

  // Sidebar
  sidebar: {
    width: SIDEBAR_W,
    backgroundColor: TINT,
    paddingTop: 28,
    paddingHorizontal: 18,
    paddingBottom: 40,
  },
  photo: {
    width: 74,
    height: 74,
    borderRadius: 37,
    marginBottom: 10,
    objectFit: "cover",
  },
  sideName: { fontFamily: "Helvetica-Bold", fontSize: 16, color: INK, marginBottom: 2 },
  sideHeadline: { fontSize: 9, color: PURPLE, marginBottom: 10, lineHeight: 1.3 },
  sideH: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: DARK,
    letterSpacing: 1,
    marginTop: 14,
    marginBottom: 5,
    textTransform: "uppercase",
  },
  sideItem: { fontSize: 8.5, color: SLATE, marginBottom: 3, lineHeight: 1.35 },
  chip: {
    backgroundColor: WHITE,
    color: DARK,
    fontSize: 7.6,
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderRadius: 3,
    marginRight: 3,
    marginBottom: 3,
    // Keep long skills (e.g. "LLM APIs (GPT, Claude, Gemini)") inside the
    // sidebar instead of bleeding into the main column.
    maxWidth: SIDEBAR_W - 36,
  },
  chipWrap: { flexDirection: "row", flexWrap: "wrap" },
  link: { color: DARK, textDecoration: "none" },

  // Main
  main: { flex: 1, paddingTop: 28, paddingHorizontal: 22, paddingBottom: 34 },
  brandRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 6 },
  brandMark: { fontFamily: "Helvetica-Bold", fontSize: 11, color: PURPLE },
  brandSub: { fontSize: 6.5, color: MUTED, textAlign: "right" },
  h2: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: DARK,
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 5,
    textTransform: "uppercase",
  },
  rule: { borderBottomWidth: 1, borderBottomColor: LINE, marginBottom: 6 },
  about: { fontSize: 9.5, color: SLATE, lineHeight: 1.45 },

  expTitle: { fontFamily: "Helvetica-Bold", fontSize: 10.5, color: INK },
  expMeta: { fontSize: 8.3, color: MUTED, marginBottom: 3 },
  bullet: { flexDirection: "row", marginBottom: 2 },
  bulletDot: { color: PURPLE, marginRight: 5, fontSize: 9.5 },
  bulletText: { flex: 1, fontSize: 9.3, color: SLATE, lineHeight: 1.4 },
  // Plain body text for block sections (projects, quotes). Must NOT use
  // bulletText: its flex:1 is for the bullet row and makes stacked blocks
  // collapse on top of each other.
  bodyText: { fontSize: 9.3, color: SLATE, lineHeight: 1.4 },
  tags: { fontSize: 8, color: MUTED, marginTop: 2 },
  expBlock: { marginBottom: 9 },

  eduTitle: { fontFamily: "Helvetica-Bold", fontSize: 9.8, color: INK },
  eduMeta: { fontSize: 8.3, color: MUTED, marginBottom: 5 },
  quote: {
    borderLeftWidth: 2,
    borderLeftColor: PURPLE,
    paddingLeft: 8,
    marginBottom: 6,
  },
  quoteText: { fontSize: 9, color: SLATE, lineHeight: 1.45, fontStyle: "italic" },
  quoteAuthor: { fontSize: 8, color: MUTED, marginTop: 3 },

  footer: {
    position: "absolute",
    bottom: 14,
    left: SIDEBAR_W,
    right: 0,
    textAlign: "center",
    fontSize: 7,
    color: MUTED,
  },
  topbar: { position: "absolute", top: 0, left: 0, right: 0, height: 6, backgroundColor: PURPLE },
});

function Bullet({ text }: { text: string }) {
  return (
    <View style={s.bullet}>
      <Text style={s.bulletDot}>•</Text>
      <Text style={s.bulletText}>{text}</Text>
    </View>
  );
}

export function CVDocument({ cv }: { cv: CandidateCV }) {
  const c = cv.contact || {};
  return (
    <Document title={`CV - ${cv.name}`} author="RecruiterGTM">
      <Page size="A4" style={s.page}>
        <View style={s.topbar} fixed />

        {/* ---- Sidebar ---- */}
        <View style={s.sidebar}>
          {!!cv.photo && <Image src={cv.photo} style={s.photo} />}
          <Text style={s.sideName}>{cv.name}</Text>
          {!!cv.headline && <Text style={s.sideHeadline}>{cv.headline}</Text>}

          <Text style={s.sideH}>Contact</Text>
          {!!cv.location && <Text style={s.sideItem}>{cv.location}</Text>}
          {!!c.linkedin && (
            <Text style={s.sideItem}>
              <Link src={normalizeUrl(c.linkedin)} style={s.link}>
                {c.linkedin.replace(/^https?:\/\//, "")}
              </Link>
            </Text>
          )}
          {!!c.email && (
            <Text style={s.sideItem}>
              {c.email}
              {c.emailStatus && c.emailStatus !== "verified"
                ? ` (${c.emailStatus})`
                : ""}
            </Text>
          )}
          {!!c.phone && <Text style={s.sideItem}>{c.phone}</Text>}

          {cv.skills?.technical?.length > 0 && (
            <>
              <Text style={s.sideH}>Technical Skills</Text>
              <View style={s.chipWrap}>
                {cv.skills.technical.map((k, i) => (
                  <Text key={i} style={s.chip}>
                    {k}
                  </Text>
                ))}
              </View>
            </>
          )}

          {cv.skills?.functional?.length > 0 && (
            <>
              <Text style={s.sideH}>Functional</Text>
              <View style={s.chipWrap}>
                {cv.skills.functional.map((k, i) => (
                  <Text key={i} style={s.chip}>
                    {k}
                  </Text>
                ))}
              </View>
            </>
          )}

          {cv.languages?.length > 0 && (
            <>
              <Text style={s.sideH}>Languages</Text>
              {cv.languages.map((l, i) => (
                <Text key={i} style={s.sideItem}>
                  {l}
                </Text>
              ))}
            </>
          )}

          {cv.certifications?.length > 0 && (
            <>
              <Text style={s.sideH}>Certifications</Text>
              {cv.certifications.map((ct, i) => (
                <Text key={i} style={s.sideItem}>
                  {ct}
                </Text>
              ))}
            </>
          )}
        </View>

        {/* ---- Main ---- */}
        <View style={s.main}>
          <View style={s.brandRow}>
            <View>
              <Text style={s.brandMark}>RecruiterGTM</Text>
              <Text style={s.brandSub}>Candidate profile</Text>
            </View>
          </View>

          {!!cv.about && (
            <>
              <Text style={s.h2}>Profile</Text>
              <View style={s.rule} />
              <Text style={s.about}>{cv.about}</Text>
            </>
          )}

          {cv.experience?.length > 0 && (
            <>
              <Text style={s.h2}>Professional Experience</Text>
              <View style={s.rule} />
              {cv.experience.map((e, i) => (
                // Allow long roles to flow across a page break; minPresenceAhead
                // keeps the heading with at least some of its bullets instead of
                // stranding it (or overlaying it) at the bottom of a page.
                <View key={i} style={s.expBlock}>
                  <Text style={s.expTitle} minPresenceAhead={50}>
                    {e.title}
                  </Text>
                  <Text style={s.expMeta}>
                    {[e.employer, e.dates, e.location, e.industry]
                      .filter(Boolean)
                      .join("  ·  ")}
                  </Text>
                  {(e.bullets || []).map((b, j) => (
                    <Bullet key={j} text={b} />
                  ))}
                  {e.tags && e.tags.length > 0 && (
                    <Text style={s.tags}>{e.tags.join("  ·  ")}</Text>
                  )}
                </View>
              ))}
            </>
          )}

          {cv.education?.length > 0 && (
            <>
              <Text style={s.h2}>Education</Text>
              <View style={s.rule} />
              {cv.education.map((e, i) => (
                <View key={i} style={{ marginBottom: 6 }} wrap={false}>
                  <Text style={s.eduTitle}>
                    {[e.degree, e.school].filter(Boolean).join(" — ")}
                  </Text>
                  <Text style={s.eduMeta}>
                    {[e.field, e.dates, e.location].filter(Boolean).join("  ·  ")}
                  </Text>
                </View>
              ))}
            </>
          )}

          {cv.projects?.length > 0 && (
            <>
              <Text style={s.h2}>Key Projects</Text>
              <View style={s.rule} />
              {cv.projects.map((p, i) => (
                // No wrap={false} here: project descriptions can be long, and
                // forcing them to stay whole makes react-pdf overlay them on
                // top of the next block when they don't fit the page.
                <View key={i} style={{ marginBottom: 6 }}>
                  <Text style={s.eduTitle} minPresenceAhead={40}>
                    {p.name}
                  </Text>
                  <Text style={s.eduMeta}>
                    {[p.dates, p.context].filter(Boolean).join("  ·  ")}
                  </Text>
                  {p.description && (
                    <Text style={s.bodyText}>{p.description}</Text>
                  )}
                </View>
              ))}
            </>
          )}

          {cv.volunteering && cv.volunteering.length > 0 && (
            <>
              <Text style={s.h2}>Volunteering</Text>
              <View style={s.rule} />
              {cv.volunteering.map((v, i) => (
                <View key={i} style={{ marginBottom: 4 }} wrap={false}>
                  <Text style={s.eduTitle}>
                    {[v.role, v.organization].filter(Boolean).join(" — ")}
                  </Text>
                  {!!v.dates && <Text style={s.eduMeta}>{v.dates}</Text>}
                </View>
              ))}
            </>
          )}

          {cv.awards && cv.awards.length > 0 && (
            <>
              <Text style={s.h2}>Honors &amp; Awards</Text>
              <View style={s.rule} />
              {cv.awards.map((a, i) => (
                <View key={i} style={{ marginBottom: 4 }} wrap={false}>
                  <Text style={s.eduTitle}>{a.title}</Text>
                  <Text style={s.eduMeta}>
                    {[a.issuer, a.date].filter(Boolean).join("  ·  ")}
                  </Text>
                </View>
              ))}
            </>
          )}

          {cv.recommendation?.text && (
            <>
              <Text style={s.h2}>Recommendation</Text>
              <View style={s.rule} />
              <View style={s.quote}>
                <Text style={s.quoteText}>&ldquo;{cv.recommendation.text}&rdquo;</Text>
                {cv.recommendation.author && (
                  <Text style={s.quoteAuthor}>{cv.recommendation.author}</Text>
                )}
              </View>
            </>
          )}

          {cv.desired &&
            (cv.desired.role ||
              cv.desired.type ||
              cv.desired.cities?.length) && (
              <>
                <Text style={s.h2}>Target Role</Text>
                <View style={s.rule} />
                {cv.desired.role && (
                  <Text style={s.sideItem}>Role: {cv.desired.role}</Text>
                )}
                {cv.desired.type && (
                  <Text style={s.sideItem}>Type: {cv.desired.type}</Text>
                )}
                {cv.desired.level && (
                  <Text style={s.sideItem}>Level: {cv.desired.level}</Text>
                )}
                {cv.desired.cities?.length ? (
                  <Text style={s.sideItem}>
                    Locations: {cv.desired.cities.join(", ")}
                  </Text>
                ) : null}
              </>
            )}

        </View>

        {/* Footer sits at Page level, not inside the flex column — nesting an
            absolutely-positioned fixed element inside the content column made
            react-pdf mis-measure the remaining height and overlap blocks. */}
        <Text style={s.footer} fixed>
          Prepared by RecruiterGTM
        </Text>
      </Page>
    </Document>
  );
}

function normalizeUrl(u: string): string {
  if (!u) return "";
  return u.startsWith("http") ? u : `https://${u}`;
}
