import { readDataset } from "@/lib/data/load";

/** The whole tournament dataset as one static JSON file, consumed by the chart builder in the browser. */
export const dynamic = "force-static";

export function GET() {
  const dataset = readDataset();
  return Response.json(dataset, {
    headers: { "Cache-Control": "public, max-age=300, s-maxage=900, stale-while-revalidate=3600" },
  });
}
