import { validateWebsiteEvent } from "@/lib/website-events";
const buckets = new Map<string, { count: number; until: number }>();
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const allowed = (process.env.WEBSITE_ALLOWED_ORIGINS ?? "")
    .split(",")
    .filter(Boolean);
  if (!origin || !allowed.includes(origin))
    return Response.json({ error: "Origin not allowed" }, { status: 403 });
  if (Number(request.headers.get("content-length") ?? 0) > 2048)
    return Response.json({ error: "Payload too large" }, { status: 413 });
  const now = Date.now();
  for (const [k, v] of buckets) if (v.until < now) buckets.delete(k);
  const bucket = buckets.get(origin) ?? { count: 0, until: now + 60000 };
  if (++bucket.count > 100)
    return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
  buckets.set(origin, bucket);
  try {
    const text = await request.text();
    if (text.length > 2048)
      return Response.json({ error: "Payload too large" }, { status: 413 });
    validateWebsiteEvent(JSON.parse(text));
    return Response.json(
      { error: "Tracking storage is not connected; event was not stored." },
      { status: 503 },
    );
  } catch {
    return Response.json({ error: "Invalid event payload" }, { status: 400 });
  }
}
