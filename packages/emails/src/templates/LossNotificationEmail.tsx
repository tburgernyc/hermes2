/**
 * LossNotificationEmail — sent to a subcontractor/prospect whose quote was NOT selected (CLAUDE.md §3.1
 * item 5: close the vendor-side loop on loss). Every interpolated value is rendered as a React child, so
 * React Email autoescapes it (CLAUDE.md §7): a vendor/prospect-derived company name can never inject HTML.
 * This template renders ONLY after an admin explicitly approves the notification on the approvals surface
 * (Prime Directive §2 — the loss cascade QUEUES the notification; it never sends automatically).
 */
import { Body, Container, Head, Hr, Html, Preview, Text } from "@react-email/components";

import type { LossNotificationEmailInput } from "../types.js";

const POSTAL_ADDRESS = process.env.OUTREACH_POSTAL_ADDRESS ?? "Burger Consulting LLC, United States";

export function LossNotificationEmail({
  companyName,
  solicitationTitle,
}: LossNotificationEmailInput) {
  return (
    <Html>
      <Head />
      <Preview>Update on your quote submission</Preview>
      <Body style={{ fontFamily: "Arial, sans-serif", backgroundColor: "#f6f6f6" }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "24px", maxWidth: "600px" }}>
          <Text style={{ fontSize: "16px" }}>Hello {companyName},</Text>
          <Text style={{ fontSize: "14px", lineHeight: "20px" }}>
            Thank you for submitting a quote for &quot;{solicitationTitle}&quot;. After review, we have
            selected another subcontractor for this opportunity, and your quote was not selected.
          </Text>
          <Text style={{ fontSize: "14px", lineHeight: "20px" }}>
            We appreciate the time you put into your submission and welcome you to quote on future
            opportunities with Burger Consulting LLC.
          </Text>
          <Hr />
          <Text style={{ fontSize: "12px", color: "#999999" }}>{POSTAL_ADDRESS}</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default LossNotificationEmail;
