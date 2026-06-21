// Console UI kit data — the FULL operator + subcontractor workflow, end to end.
// Synthetic but shaped like the real hermes2 schema. Truthfulness contract preserved:
// nothing advances without an explicit human action; live submission is gated.
window.CONSOLE = {
  operator: "t.burger@burgergov.com",
  vendorName: "Meridian Federal LLC",
  vendorEmail: "bids@meridianfederal.com",

  // ---- Admin: morning brief ----
  brief: {
    stats: [
      { label: "Awaiting sourcing decision", value: 3, tone: "neutral" },
      { label: "Outreach awaiting approval", value: 2, tone: "warn" },
      { label: "In pricing / bid review", value: 2, tone: "neutral" },
      { label: "Deadlines within 72h", value: 2, tone: "warn" },
      { label: "New contact inquiries", value: 2, tone: "warn" },
    ],
  },
  triaged: [
    { id: "s1", title: "Logistics scheduling system modernization", agency: "DLA Troop Support", feasibility: 88, fit: "High" },
    { id: "s2", title: "Section 508 audit & accessible UI remediation", agency: "Dept. of Veterans Affairs", feasibility: 81, fit: "High" },
    { id: "s3", title: "Records database migration to PostgreSQL", agency: "GSA FAS", feasibility: 74, fit: "Medium" },
  ],
  outreach: [
    { id: "o1", subject: "Subcontractor capability — accessible UI remediation (VA)", prospect: "Meridian Federal LLC" },
    { id: "o2", subject: "Teaming inquiry — PostgreSQL migration (GSA)", prospect: "Anchor Data Systems" },
  ],
  pricing: [
    { id: "s4", title: "Cybersecurity dashboard build-out" },
    { id: "s5", title: "Grants management web application" },
  ],
  deadlines: [
    { id: "s1", title: "Logistics scheduling system modernization", due: "2026-06-22 17:00 EDT" },
    { id: "s2", title: "Section 508 audit & accessible UI remediation", due: "2026-06-23 12:00 EDT" },
  ],

  // ---- Admin: solicitations kanban (5 operator phases) ----
  board: [
    { title: "Triage", items: [
      { id: "s2", title: "Section 508 audit & accessible UI remediation", agency: "Dept. of Veterans Affairs", status: "Triage complete", feasibility: 81, fit: "High", gate: true },
      { id: "s3", title: "Records database migration to PostgreSQL", agency: "GSA FAS", status: "Triage complete", feasibility: 74, fit: "Medium", gate: true },
    ] },
    { title: "Sourcing", items: [
      { id: "s1", title: "Logistics scheduling system modernization", agency: "DLA Troop Support", status: "Sourcing in progress", feasibility: 88, fit: "High" },
    ] },
    { title: "Pricing", items: [
      { id: "s4", title: "Cybersecurity dashboard build-out", agency: "DHS CISA", status: "Pricing pending", feasibility: 79, fit: "High" },
    ] },
    { title: "Proposal", items: [
      { id: "s5", title: "Grants management web application", agency: "HHS", status: "Proposal draft", feasibility: 83, fit: "High" },
    ] },
    { title: "Submitted", items: [
      { id: "s6", title: "Case management API integration", agency: "USDA", status: "Submitted", feasibility: 85, fit: "High" },
    ] },
  ],

  // ---- Admin: solicitation detail (triage + ranked quotes) ----
  solicitationDetail: {
    id: "s2",
    title: "Section 508 audit & accessible UI remediation",
    agency: "Dept. of Veterans Affairs",
    notice: "36C10B26R0042",
    status: "Sourcing in progress",
    deadline: "2026-06-23 12:00 EDT",
    feasibility: 81,
    fit: "High",
    contractType: "FFP",
    naics: "541511",
    concerns: ["Key personnel must include a certified accessibility specialist — confirm before award."],
    scope: "The contractor shall conduct a full Section 508 conformance audit of the VA claims portal, remediate all Level A and AA failures per WCAG 2.1, and deliver automated and manual testing artifacts. Period of performance: 12 months from award. Key personnel must include a certified accessibility specialist.",
    quotes: [
      { id: "q1", vendor: "Meridian Federal LLC", status: "Submitted", total: "$248,500.00", rank: 1, rationale: "Strongest accessibility past performance; certified specialist named. Pricing 4% below benchmark median." },
      { id: "q2", vendor: "Anchor Data Systems", status: "Submitted", total: "$262,000.00", rank: 2, rationale: "Solid testing methodology; specialist certification not yet evidenced. Pricing at benchmark median." },
      { id: "q3", vendor: "Cobalt Civic Tech", status: "Submitted", total: "$291,750.00", rank: 3, rationale: "Capable team; highest price and lighter 508-specific past performance." },
    ],
  },

  // ---- Admin: priced bid decision-brief ----
  proposal: {
    title: "Section 508 audit & accessible UI remediation",
    status: "Draft",
    contractType: "FFP",
    provisional: true,
    watermark: "PROVISIONAL — dry-run baseline · not for submission",
    scenarios: [
      { label: "Conservative", price: "$268,200", feePct: "8.0%", marginPct: "11.4%", vsBench: "+2.1%" },
      { label: "Target", price: "$261,000", feePct: "10.0%", marginPct: "13.8%", vsBench: "−0.6%" },
      { label: "Aggressive", price: "$252,400", feePct: "12.5%", marginPct: "16.2%", vsBench: "−3.9%" },
    ],
    compliance: [
      { item: "FAR 52.204-24 representation present", passed: true },
      { item: "Section 508 VPAT attached", passed: true },
      { item: "Key personnel resumes — certified specialist", passed: false, note: "Awaiting signed certification" },
      { item: "SAM.gov registration active at submission", passed: true },
    ],
    bidChecklist: [
      { item: "Technical volume assembled", passed: true },
      { item: "Price volume reconciled to line items", passed: true },
      { item: "Subcontractor teaming agreement executed", passed: false, note: "Pending counsel review" },
      { item: "Representations & certifications complete", passed: true },
    ],
    blockers: [
      "CAGE code not yet assigned (pending) — required for SAM submission.",
      "Subcontractor teaming agreement awaiting counsel signature.",
      "Certified accessibility specialist certification not yet on file.",
    ],
  },

  // ---- Admin: contact inquiries (from the marketing site) ----
  inquiries: [
    { id: "i1", name: "Dana Whitfield", email: "dwhitfield@primecontractor.com", company: "Atlas Integrated Systems (Prime)", intent: "Teaming", status: "NEW", date: "2026-06-19", message: "We're bidding a VA modernization vehicle and need a 541511 partner with Section 508 depth. Are you available to discuss a teaming arrangement?" },
    { id: "i2", name: "Capt. R. Alvarez", email: "r.alvarez@agency.gov", company: "DLA Troop Support", intent: "Capability", status: "NEW", date: "2026-06-18", message: "Requesting a capability statement for upcoming logistics scheduling modernization work under 541512." },
    { id: "i3", name: "Priya Natarajan", email: "pnatarajan@anchordata.com", company: "Anchor Data Systems", intent: "Subcontractor", status: "Reviewed", date: "2026-06-15", message: "Interested in subcontracting on database migration efforts. PostgreSQL and accessibility experience available." },
  ],

  // ---- Admin: prospects (discovery + qualify) ----
  prospects: [
    { id: "p1", company: "Meridian Federal LLC", email: "bids@meridianfederal.com", status: "Qualified", source: "AI discovery", score: 92, naics: "541511, 541512" },
    { id: "p2", company: "Anchor Data Systems", email: "pnatarajan@anchordata.com", status: "Contacted", source: "Inbound inquiry", score: 84, naics: "541512" },
    { id: "p3", company: "Cobalt Civic Tech", email: "team@cobaltcivic.com", status: "Discovered", source: "AI discovery", score: 77, naics: "541511, 541519" },
    { id: "p4", company: "Northwind Systems Group", email: "rfp@northwindsg.com", status: "Discovered", source: "AI discovery", score: 71, naics: "541512" },
  ],

  // ---- Admin: vendors (promote / vet / link / invite) ----
  vendors: {
    qualifiedProspects: [{ id: "p1", company: "Meridian Federal LLC" }],
    pendingVendors: [{ id: "v2", company: "Anchor Data Systems" }],
    vettedVendors: [{ id: "v1", company: "Meridian Federal LLC" }, { id: "v3", company: "Cobalt Civic Tech" }],
    unlinkedUsers: [{ id: "u2", email: "ops@cobaltcivic.com" }],
    inviteLink: "https://burgergov.com/invite/eyJhbGciOiJFUzI1Ni…s9-VENDOR_INVITE-single-use",
  },

  // ---- Vendor: dashboard ----
  vendorStats: [
    { label: "Open RFQs to bid", value: 3, tone: "neutral" },
    { label: "Active quotes", value: 2, tone: "neutral" },
    { label: "Awaiting your docs", value: 1, tone: "warn" },
    { label: "Awarded YTD", value: 1, tone: "neutral" },
  ],
  rfqs: [
    { id: "r1", title: "Accessible UI remediation — claims portal", agency: "Dept. of Veterans Affairs", naics: "541511", deadline: "2026-06-30", contractType: "FFP" },
    { id: "r2", title: "PostgreSQL records migration", agency: "GSA FAS", naics: "541512", deadline: "2026-07-08", contractType: "T&M" },
    { id: "r3", title: "Logistics scheduling modernization", agency: "DLA Troop Support", naics: "541511", deadline: "2026-07-15", contractType: "FFP" },
  ],

  // ---- Vendor: quote submission target (the form's solicitation) ----
  quoteTarget: {
    title: "Accessible UI remediation — claims portal",
    agency: "Dept. of Veterans Affairs",
    notice: "SP4701-26-R-0042",
    contractType: "FFP",
    deadline: "2026-06-30",
    scope: "Remediate all Level A and AA Section 508 / WCAG 2.1 failures across the claims portal, deliver automated and manual testing artifacts, and provide a certified accessibility specialist as key personnel. Period of performance: 12 months.",
    costTypes: ["Labor", "Material", "ODC", "Subcontract", "Travel"],
  },

  // ---- Vendor: my quotes ----
  myQuotes: [
    { id: "mq1", title: "Accessible UI remediation — claims portal", agency: "Dept. of Veterans Affairs", total: "$248,500.00", status: "Submitted", date: "2026-06-17" },
    { id: "mq2", title: "PostgreSQL records migration", agency: "GSA FAS", total: "$176,300.00", status: "Under review", date: "2026-06-12" },
  ],

  // ---- Vendor: single quote detail ----
  quote: {
    title: "Accessible UI remediation — claims portal",
    notice: "SP4701-26-R-0042",
    status: "Submitted",
    total: "$248,500.00",
    pop: "12 months",
    payWhenPaid: true,
    notes: "Certified accessibility specialist (IAAP CPACC) named as key personnel; resume attached.",
    lines: [
      { cost: "Labor", desc: "Senior accessibility engineer (1,040 hrs)", qty: 1040, rate: "$165.00", ext: "$171,600.00" },
      { cost: "Labor", desc: "UX designer — remediation & testing (480 hrs)", qty: 480, rate: "$135.00", ext: "$64,800.00" },
      { cost: "Material", desc: "Automated audit tooling licenses", qty: 4, rate: "$2,000.00", ext: "$8,000.00" },
      { cost: "Travel", desc: "On-site validation sessions", qty: 1, rate: "$4,100.00", ext: "$4,100.00" },
    ],
  },

  // ---- Vendor: my subcontracts ----
  contracts: [
    { id: "c1", title: "Grants management web application", contractType: "FFP", value: "$214,000.00", status: "Active", esign: "Signed" },
    { id: "c2", title: "Case management API integration", contractType: "T&M", value: "$98,750.00", status: "Awarded", esign: "Awaiting signature" },
  ],

  // ---- Vendor: compliance documents ----
  documents: [
    { name: "W-9 (2026).pdf", type: "Tax", status: "Verified", tone: "success" },
    { name: "Certificate of Insurance.pdf", type: "Insurance", status: "Verified", tone: "success" },
    { name: "Capability statement.pdf", type: "Capability", status: "Scanning", tone: "info" },
    { name: "Past performance — VA.pdf", type: "Reference", status: "Action needed", tone: "warn" },
  ],

  // ---- Split-view approval detail (release gate) ----
  approvalDetail: {
    title: "Section 508 audit & accessible UI remediation",
    notice: "36C10B26R0042",
    agency: "Dept. of Veterans Affairs",
    feasibility: 81,
    sourceLines: [
      "1.0 The contractor shall conduct a full Section 508 conformance audit of the claims portal.",
      "2.1 Remediation of all Level A and AA failures per WCAG 2.1 is required.",
      "2.2 Automated and manual testing artifacts shall be delivered.",
      "3.0 Period of performance: 12 months from award.",
      "4.1 Key personnel must include a certified accessibility specialist.",
    ],
    evalLines: [
      { item: "Conformance audit", markup: "Standard", vendor: "Meridian Federal", flag: false },
      { item: "WCAG 2.1 AA remediation", markup: "Standard", vendor: "Meridian Federal", flag: false },
      { item: "Testing artifacts", markup: "Standard", vendor: "Anchor Data Systems", flag: false },
      { item: "Certified specialist (key personnel)", markup: "Review", vendor: "Low confidence — confirm cert", flag: true },
    ],
  },
};
