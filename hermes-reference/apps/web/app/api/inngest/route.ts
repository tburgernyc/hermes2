/**
 * apps/web/app/api/inngest/route.ts
 * Serves the Inngest functions. This is the endpoint Inngest (dev + Cloud) calls to run the durable
 * workflows defined in inngest/functions.ts.
 */
import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { functions } from "@/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
