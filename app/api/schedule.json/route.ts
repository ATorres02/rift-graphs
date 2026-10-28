import { readDataset } from "@/lib/data/load";
import { toScheduleEntries } from "@/lib/ingest/trigger";

/** Series status only (a few KB), read every few minutes by the Cloudflare cron in worker/index.ts. */
export const dynamic = "force-static";

export function GET() {
  return Response.json(toScheduleEntries(readDataset().series), {
    headers: { "Cache-Control": "public, max-age=60" },
  });
}
