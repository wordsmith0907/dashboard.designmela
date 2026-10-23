export const websiteEventNames = [
  "page_viewed",
  "cta_clicked",
  "form_opened",
  "form_started",
  "form_submitted",
  "meeting_booked",
  "lead_qualified",
  "proposal_created",
  "client_won",
] as const;
export interface WebsiteEvent {
  event: (typeof websiteEventNames)[number];
  ctaId: string;
  page: string;
  sessionId: string;
  occurredAt: string;
}
export function validateWebsiteEvent(input: unknown): WebsiteEvent {
  if (!input || typeof input !== "object") throw new Error("Invalid event");
  const v = input as Record<string, unknown>;
  if (
    Object.keys(v).some(
      (k) => !["event", "ctaId", "page", "sessionId", "occurredAt"].includes(k),
    )
  )
    throw new Error("Unexpected fields; personal information is not accepted");
  if (
    !websiteEventNames.includes(v.event as WebsiteEvent["event"]) ||
    typeof v.ctaId !== "string" ||
    !/^([a-z0-9_]{1,80})$/.test(v.ctaId) ||
    typeof v.page !== "string" ||
    !/^\/[a-zA-Z0-9/_-]{0,120}$/.test(v.page) ||
    typeof v.sessionId !== "string" ||
    !/^[-a-zA-Z0-9]{16,64}$/.test(v.sessionId) ||
    typeof v.occurredAt !== "string" ||
    Number.isNaN(Date.parse(v.occurredAt))
  )
    throw new Error("Invalid event values");
  return v as unknown as WebsiteEvent;
}
