// Dev-only harness: render the PDF component from sample CV data to a real
// file, so we can eyeball the layout without live API keys.
// Run: node scripts/render-sample.mjs
import React from "react";
import { renderToFile } from "@react-pdf/renderer";
import { CVDocument } from "../lib/pdf.tsx";

const cv = {
  name: "Adrian Ruxanda",
  headline: "IT Manager & Team Lead — IT Coordinator at Dentons Romania",
  location: "Bucuresti / Ramnicu Valcea, Romania",
  contact: {
    linkedin: "linkedin.com/in/adrianruxanda",
    emailStatus: "unknown",
  },
  about:
    "Results-oriented IT Operations Leader with 18+ years building and scaling resilient IT ecosystems for multinational organizations. Deep experience across legal and industrial sectors, supervising complex infrastructure (600+ users, 500+ endpoints) and leading high-stakes digital transformations. Recently spearheaded a 25% reduction in vendor and telecom costs while overseeing IT budgets up to 150K EUR.",
  experience: [
    {
      title: "Information Technology Coordinator",
      employer: "Dentons Romania",
      dates: "Oct 2024 - Present",
      location: "Bucuresti",
      industry: "Legal",
      bullets: [
        "Oversee IT operations tailored to the needs of a global law firm.",
        "Provide strategic guidance for technology solutions supporting legal and business functions.",
        "Coordinate vendors and stakeholders to optimize IT resources and system reliability.",
        "Ensure seamless IT service delivery including user support and optimization.",
      ],
      tags: ["Management", "ITIL", "Project Planning", "Incident Management"],
    },
    {
      title: "Senior IT ServiceDesk Engineer / Oracle Key User - Operations Manager",
      employer: "CIECH Soda Romania",
      dates: "Feb 2006 - Oct 2024",
      location: "Ramnicu Valcea",
      industry: "Chemistry",
      bullets: [
        "Provided Level 1 & 2 support for business and production.",
        "Oversaw IT infrastructure and mobile contracts; supported ERP transitions (Oracle & SAP).",
        "Managed incidents and assets via ServiceNow.",
      ],
      tags: [],
    },
  ],
  education: [
    {
      degree: "Bachelor's degree",
      school: "Universitatea Constantin Brancoveanu",
      field: "Management & Marketing in International Affairs",
      dates: "2001 - 2005",
      location: "Ramnicu Valcea",
    },
    {
      degree: "English C1",
      school: "International English School",
      dates: "2016",
    },
  ],
  skills: {
    technical: [
      "ITIL", "ServiceNow", "SCCM", "Active Directory", "TCP/IP", "LAN/WAN",
      "Windows Remote Desktop", "Microsoft 365", "TeamViewer", "Mobile Device Mgmt",
    ],
    functional: [
      "IT service management", "Incident management", "Vendor management",
      "Budgeting & cost control", "GDPR", "Team management",
    ],
  },
  certifications: [
    "CompTIA A+ (220-901 / 220-902) — 2018",
    "Data Protection Officer training — 2018",
  ],
  languages: ["English - Advanced (C1)", "French - Beginner"],
  desired: {
    role: "IT Coordinator / IT Service Manager",
    type: "Full time / Part time (remote-friendly)",
    level: "Senior (>5 yrs)",
    cities: ["Bucuresti", "Cluj-Napoca", "Remote"],
  },
  meta: { recency: "Actively open" },
};

await renderToFile(
  React.createElement(CVDocument, { cv }),
  "./sample-cv.pdf"
);
console.log("Wrote sample-cv.pdf");
