/**
 * Inngest serve endpoint. Exposes the durable functions (crons + the human-approval gate) to the Inngest
 * runtime over GET/POST/PUT at /api/inngest. Node runtime — the functions reach @hermes/db (pg) and the
 * AI/email senders, which are server-only. Request signatures are verified by Inngest via
 * INNGEST_SIGNING_KEY (set in fly secrets); no app session is involved on this transport.
 */
import { serve } from "inngest/next";

import { functions, inngest } from "@hermes/inngest";

export const runtime = "nodejs";

export const { GET, POST, PUT } = serve({ client: inngest, functions });
