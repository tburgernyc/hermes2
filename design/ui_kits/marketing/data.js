// Public brand content for Burger Consulting LLC (platform brand: BurgerGov).
// Truthfulness contract: every value is literally true today; anything not yet
// issued is an explicit placeholder. No fabricated performance metrics.
window.SITE = {
  brand: "BurgerGov",
  legal: "Burger Consulting LLC",
  domain: "burgergov.com",
  tagline:
    "Federal software, systems design, and IT services — built to spec, owned end to end.",

  hero: {
    kicker: "Burger Consulting LLC · AI-First Software & Systems",
    title: "Software, systems, and interfaces — built to spec and owned end to end.",
    lede:
      "An AI-first, founder-led firm building software, systems, and the interfaces on top — for government and private-sector clients alike. Scoped precisely, built to standard, and answered for by the engineer who writes the code.",
  },

  // Factual "at a glance" facts — not performance metrics.
  facts: [
    { k: "Discipline", v: "Federal IT services" },
    { k: "Core NAICS", v: "541511 · 541512 · 541519" },
    { k: "Business size", v: "Small business" },
    { k: "Standard", v: "Section 508 / WCAG 2.1 AA" },
  ],

  principal: { name: "Timothy Burger", title: "Founder & Principal Engineer", initials: "TB" },
  stack: ["Python", "JavaScript / TypeScript", "Rust", "SQL / Databases", "Section 508 / WCAG 2.1 AA"],

  nav: [
    { href: "capabilities", label: "Capabilities" },
    { href: "about", label: "About" },
    { href: "contact", label: "Contact" },
  ],

  naics: [
    { code: "541511", label: "Custom Computer Programming Services" },
    { code: "541512", label: "Computer Systems Design Services" },
    { code: "541519", label: "Other Computer Related Services" },
  ],

  // Capability matrix — each NAICS code mapped to the work it covers.
  capabilities: [
    {
      code: "541511",
      name: "Custom Software Development",
      summary: "Writing, modifying, testing, and supporting software built around a specific need — for agencies, companies, and founders alike.",
      work: [
        "Custom software, web & mobile applications",
        "Database-backed application development",
        "Bespoke integrations & APIs",
        "Software analysis, testing & ongoing support",
      ],
    },
    {
      code: "541512",
      name: "Systems Design & Integration",
      summary: "Planning and designing systems that integrate hardware, software, and communications — from enterprise rollouts to a growing company's stack.",
      work: [
        "Systems integration & IT architecture",
        "Enterprise & network design",
        "Implementation, configuration & rollout",
        "Training and post-deployment support",
      ],
    },
    {
      code: "541519",
      name: "Specialized IT Services",
      summary: "Specialized technology services beyond programming and systems design, scoped to whatever the client runs on.",
      work: [
        "IT disaster recovery & continuity",
        "Software installation & configuration",
        "Technical training & enablement",
        "Infrastructure troubleshooting & management",
      ],
    },
  ],

  adjacency:
    "Federal credentials are not a fence. Once registered, a firm may compete for work beyond the codes it first applied under. We lead with the disciplines above — and selectively take on adjacent, complementary efforts where our software and systems expertise clearly applies.",

  // AI-first positioning — a client-facing capability, not a description of our own process.
  ai: {
    title: "AI woven through everything we build.",
    lede: "We design, build, and automate with AI at the core — and bring proven expertise integrating it into real products and operations that hold up in production.",
    pillars: [
      { name: "Design & build with AI", text: "Modern AI tooling accelerates how we generate software and UI/UX — more iterations, faster, without compromising craft or review." },
      { name: "Automate the busywork", text: "We design AI-driven workflows and integrations that remove manual steps, so teams spend their time on judgment, not repetition." },
      { name: "Implemented, not theorized", text: "Working AI integrations in production — our expertise is making them reliable, governed, and genuinely useful to the business." },
    ],
  },

  // Delivery approach — replaces any "autonomous engine" framing.
  approach: [
    { name: "Built to spec", text: "Scope, data model, and acceptance criteria are agreed and documented up front — no surprises at delivery." },
    { name: "Compliance-minded", text: "Experience in regulated domains means data sensitivity and audit-readiness are designed in, not bolted on." },
    { name: "Accessible by default", text: "Section 508 and WCAG 2.1 AA are the baseline standard on every interface we ship." },
    { name: "Personally accountable", text: "One owner writes the code, owns the data model, and answers for the outcome." },
  ],

  // Two real subcontractor paths (mirrors hermes2):
  //  · paths[0] = /quote/[token]  — one-time, no account, quick quote
  //  · paths[1] = /invite + /login — full portal account for ongoing work
  partner: {
    intro:
      "We identify and contact subcontractors directly when their capabilities fit a specific solicitation. Your invitation always arrives as a secure link in your email — there is nothing to apply for here. Depending on the opportunity, that link opens one of two paths.",
    paths: [
      {
        tag: "Path A · No account",
        name: "Submit a one-time quote",
        text: "For a single solicitation, your link opens a secure quote form directly — review the scope, enter line items, attach your document, and submit. No account, no password.",
        bullets: ["Opens straight from your email link", "Single-use, tied to one solicitation", "Upload a PDF or DOCX (max 25 MB)"],
        cta: "How it works",
      },
      {
        tag: "Path B · Portal account",
        name: "Work from the subcontractor portal",
        text: "For ongoing work, your link helps you set a password once. After that, sign in anytime to track open RFQs, prepare quotes, and manage subcontracts and documents across multiple sessions.",
        bullets: ["Set a password once, then sign in anytime", "Track Open RFQs, Quotes, Subcontracts & Documents", "Built for repeat, multi-session work"],
        cta: "Sign in to the portal →",
      },
    ],
  },

  credentials: [
    { label: "SAM.gov registration", value: "Active", state: "confirmed" },
    { label: "Unique Entity ID (UEI)", value: "Provided on request", state: "assigned" },
    { label: "CAGE code", value: "Pending assignment", state: "pending" },
    { label: "Business size", value: "Small business", state: "confirmed" },
  ],
};
