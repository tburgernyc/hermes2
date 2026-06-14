/**
 * OutreachEmail — the subcontractor outreach message. Every interpolated value is rendered as a React
 * child, so React Email autoescapes it (CLAUDE.md §7): a vendor/prospect-derived string can never inject
 * HTML. Includes the signed quote/opt-out links and a CAN-SPAM-compliant footer (physical address +
 * one-click opt-out). This template renders ONLY after a human approves the campaign.
 */
import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

import type { OutreachEmailInput } from "../types.js";

const POSTAL_ADDRESS = process.env.OUTREACH_POSTAL_ADDRESS ?? "Burger Consulting LLC, United States";

export function OutreachEmail({ prospectName, bodyText, quoteUrl, optoutUrl }: OutreachEmailInput) {
  // Split the pre-composed plain-text body into paragraphs; each is escaped as a React child.
  const paragraphs = bodyText.split("\n").filter((line) => line.trim().length > 0);
  return (
    <Html>
      <Head />
      <Preview>Subcontracting opportunity from Burger Consulting</Preview>
      <Body style={{ fontFamily: "Arial, sans-serif", backgroundColor: "#f6f6f6" }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "24px", maxWidth: "600px" }}>
          <Text style={{ fontSize: "16px" }}>Hello {prospectName},</Text>
          {paragraphs.map((line, i) => (
            <Text key={i} style={{ fontSize: "14px", lineHeight: "20px" }}>
              {line}
            </Text>
          ))}
          <Section style={{ textAlign: "center", margin: "24px 0" }}>
            <Button
              href={quoteUrl}
              style={{
                backgroundColor: "#1a4d8f",
                color: "#ffffff",
                padding: "12px 20px",
                borderRadius: "4px",
                textDecoration: "none",
                fontSize: "14px",
              }}
            >
              Review the opportunity &amp; submit a quote
            </Button>
          </Section>
          <Hr />
          <Text style={{ fontSize: "12px", color: "#666666" }}>
            You received this because Burger Consulting LLC identified your firm as a potential
            subcontractor. If you would prefer not to receive these, you can{" "}
            <Link href={optoutUrl}>opt out here</Link>.
          </Text>
          <Text style={{ fontSize: "12px", color: "#999999" }}>{POSTAL_ADDRESS}</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default OutreachEmail;
