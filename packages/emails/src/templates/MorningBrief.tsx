/**
 * MorningBrief — the operator's daily internal digest (an email to the admin, not a third party). Lists
 * triage recommendations awaiting review, outreach awaiting approval, freshly received quotes, deadlines,
 * and overdue AR, with a link to /admin/approvals. Informational only — it takes no action.
 */
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Text,
} from "@react-email/components";

import type { BriefItem, MorningBriefInput } from "../types.js";

function ItemList({ title, items }: { title: string; items: BriefItem[] }) {
  return (
    <>
      <Heading as="h3" style={{ fontSize: "14px", marginBottom: "4px" }}>
        {title} ({items.length})
      </Heading>
      {items.length === 0 ? (
        <Text style={{ fontSize: "13px", color: "#999999" }}>None.</Text>
      ) : (
        items.map((item, i) => (
          <Text key={i} style={{ fontSize: "13px", margin: "2px 0" }}>
            • {item.label}
            {item.detail ? ` — ${item.detail}` : ""}
          </Text>
        ))
      )}
    </>
  );
}

export function MorningBrief({
  orgName,
  dateLabel,
  triageReady,
  awaitingApproval,
  rankedQuotes,
  deadlines,
  arOverdue,
  injectionAlert,
  approvalsUrl,
}: MorningBriefInput) {
  return (
    <Html>
      <Head />
      <Preview>
        {orgName} morning brief — {dateLabel}
      </Preview>
      <Body style={{ fontFamily: "Arial, sans-serif", backgroundColor: "#f6f6f6" }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "24px", maxWidth: "640px" }}>
          <Heading as="h2" style={{ fontSize: "18px" }}>
            {orgName} — morning brief ({dateLabel})
          </Heading>
          {injectionAlert ? (
            <Text
              style={{
                fontSize: "13px",
                color: "#7f1d1d",
                backgroundColor: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "4px",
                padding: "8px 10px",
                margin: "0 0 12px",
              }}
            >
              ⚠ {injectionAlert}
            </Text>
          ) : null}
          <ItemList title="Triage recommendations awaiting your review" items={triageReady} />
          <Hr />
          <ItemList title="Outreach awaiting your approval" items={awaitingApproval} />
          <Hr />
          <Text style={{ fontSize: "13px" }}>Quotes received (pending ranking): {rankedQuotes}</Text>
          <Hr />
          <ItemList title="Deadlines within 72 hours" items={deadlines} />
          <Hr />
          <ItemList title="Overdue accounts receivable" items={arOverdue} />
          <Hr />
          <Text style={{ fontSize: "13px" }}>
            Review and approve at <Link href={approvalsUrl}>{approvalsUrl}</Link>. Nothing is sent or
            advanced without your explicit approval.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default MorningBrief;
