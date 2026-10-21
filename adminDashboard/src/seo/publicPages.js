// Public marketing/legal pages that are pre-rendered to static HTML at build time,
// so search engines and AI crawlers get each page's own title, description and text.
// Titles/descriptions mirror what each page sets in the browser (InfoPage title + subtitle).

export const SITE_URL = "https://bideo.in";

export const PUBLIC_PAGES = [
  { path: "/", file: "home.html", name: "Home" },
  {
    path: "/about",
    name: "About",
    title: "About Bideo — Bideo",
    description: "India's modern mobile-first video sharing platform for watching, creating, and connecting with original regional content.",
  },
  {
    path: "/creators",
    name: "For Creators",
    title: "For Creators on Bideo — Bideo",
    description: "Turn your creativity into a thriving community. Build your audience, publish original videos, and grow with India's mobile-first video platform.",
  },
  {
    path: "/for-creators",
    name: "For Creators",
    title: "For Creators on Bideo — Bideo",
    description: "Turn your creativity into a thriving community. Build your audience, publish original videos, and grow with India's mobile-first video platform.",
  },
  {
    path: "/faq",
    name: "FAQ",
    title: "Frequently Asked Questions (FAQ) — Bideo",
    description: "Find quick answers to common questions about watching, creating, earning, and safety on Bideo.",
  },
  {
    path: "/contact",
    name: "Contact",
    title: "Contact Us & Grievance Redressal — Bideo",
    description: "We are here to help. Reach our dedicated teams for user support, creator partnerships, or legal grievances.",
  },
  { path: "/terms", name: "Terms", title: "Terms and Conditions — Bideo", description: "The rules for using Bideo." },
  { path: "/privacy", name: "Privacy", title: "Privacy Policy — Bideo", description: "How Bideo collects, uses, and protects information." },
  {
    path: "/guidelines",
    name: "Community Guidelines",
    title: "Community Guidelines — Bideo",
    description: "Rules for keeping Bideo safe, respectful, and advertiser-friendly.",
  },
  { path: "/copyright", name: "Copyright", title: "Copyright and DMCA Policy — Bideo", description: "How Bideo handles copyright concerns." },
  {
    path: "/moderation",
    name: "Content Moderation",
    title: "Content Moderation Policy — Bideo",
    description: "How Bideo reviews reports and enforces platform rules.",
  },
  { path: "/cookies", name: "Cookies", title: "Cookie Policy — Bideo", description: "How cookies and similar technologies may be used." },
  {
    path: "/account-deletion",
    name: "Account Deletion",
    title: "Bideo Account & Data Deletion Policy — Bideo",
    description: "Step-by-step instructions and policy details for requesting account deletion on Bideo.",
  },
  {
    path: "/child-safety",
    name: "Child Safety",
    title: "Child Safety Standards & CSAM/CSAE Policy — Bideo",
    description: "Published safety standards, prevention practices, and compliance contacts for Bideo.",
  },
  { path: "/refunds", name: "Refunds", title: "Refund Policy — Bideo", description: "Current status of payments and refunds on Bideo." },
];
