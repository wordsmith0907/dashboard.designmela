import {
  Lead,
  LegacyLead,
  sources,
  stages,
  temperatures,
  consentStatuses,
  currencies,
  FollowUp,
} from "./domain";
import { dayKey, safeUrl } from "./format";
export const validEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
export const normalizePhone = (s: string) => s.replace(/\D/g, "");
export const validPhone = (s: string) =>
  /^[+\d\s().-]+$/.test(s) &&
  normalizePhone(s).length >= 7 &&
  normalizePhone(s).length <= 15;
export const normalized = (s: string) =>
  s.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
export function scoreLead(lead: Lead, now = Date.now()) {
  const rules: [boolean, number, string][] = [
    [lead.services.length > 0, 15, "Service selected"],
    [lead.estimatedValue > 0, 15, "Budget provided"],
    [Boolean(lead.nextFollowUpAt), 15, "Follow-up scheduled"],
    [
      validEmail(lead.email) || validPhone(lead.phone),
      15,
      "Valid contact details",
    ],
    [
      Boolean(lead.lastContactedAt) &&
        now - Date.parse(lead.lastContactedAt) >= 0 &&
        now - Date.parse(lead.lastContactedAt) <= 30 * 86400000,
      10,
      "Contact logged in last 30 days",
    ],
    [lead.positiveReply, 15, "Positive reply recorded"],
    [lead.proposalRequested, 15, "Proposal requested"],
  ];
  const reasons = rules
    .filter(([yes]) => yes)
    .map(([, points, label]) => `${label}: +${points}`);
  const ruleScore = rules.reduce(
    (sum, [yes, points]) => sum + (yes ? points : 0),
    0,
  );
  if (lead.manualScore !== null)
    reasons.push(
      `Manual override: ${lead.manualScore} (rule total ${ruleScore})`,
    );
  return {
    score: lead.manualScore ?? ruleScore,
    scoreReasons: reasons.length ? reasons : ["No scoring signals recorded: 0"],
  };
}
/** Compatibility projection for the v1 pages. Canonical CRM fields are the v2 names. */
export function upgradeLead(input: LegacyLead | Lead): Lead {
  const old = input as Partial<Lead> & LegacyLead;
  const source =
    old.primarySource ??
    (old.source === "Website"
      ? "Website Form"
      : old.source === "Outbound"
        ? "Cold Email"
        : old.source || "Manual Entry");
  const lead: Lead = {
    ...old,
    city: old.city ?? "",
    primarySource: source as Lead["primarySource"],
    sourceDetails: old.sourceDetails ?? "",
    campaign: old.campaign ?? "",
    referrerName: old.referrerName ?? "",
    landingPageUrl: old.landingPageUrl ?? "",
    socialPostUrl: old.socialPostUrl ?? "",
    importedFilename: old.importedFilename ?? "",
    utmSource: old.utmSource ?? "",
    utmMedium: old.utmMedium ?? "",
    utmCampaign: old.utmCampaign ?? "",
    utmContent: old.utmContent ?? "",
    firstTouchSource: old.firstTouchSource ?? source,
    latestTouchSource: old.latestTouchSource ?? source,
    pipelineStage: old.pipelineStage ?? old.stage,
    temperature: old.temperature ?? "Cold",
    manualScore: old.manualScore ?? null,
    score: 0,
    scoreReasons: [],
    estimatedValue: old.estimatedValue ?? old.value,
    currency: old.currency ?? "INR",
    services: old.services ?? (old.service ? [old.service] : []),
    lastContactedAt: old.lastContactedAt ?? "",
    nextFollowUpAt:
      old.nextFollowUpAt ??
      (old.followUp ? `${old.followUp}T09:00:00+05:30` : ""),
    lostReason: old.lostReason ?? "",
    wonAt: old.wonAt ?? "",
    consentStatus: old.consentStatus ?? "Unknown",
    archivedAt: old.archivedAt ?? "",
    positiveReply: old.positiveReply ?? false,
    proposalRequested: old.proposalRequested ?? false,
    importId: old.importId ?? "",
  };
  return projectLead(lead);
}
export function projectLead(lead: Lead): Lead {
  return {
    ...lead,
    ...scoreLead(lead),
    source: lead.primarySource,
    stage: lead.pipelineStage,
    value: lead.estimatedValue,
    service: lead.services.join(", "),
    followUp: lead.nextFollowUpAt ? lead.nextFollowUpAt.slice(0, 10) : "",
  };
}
export function newLead(): Lead {
  const stamp = new Date().toISOString();
  return upgradeLead({
    id: crypto.randomUUID(),
    createdAt: stamp,
    updatedAt: stamp,
    name: "",
    company: "",
    email: "",
    phone: "",
    country: "",
    source: "Manual Entry",
    service: "",
    stage: "New",
    value: 0,
    followUp: "",
    owner: "Agency owner (demo)",
    tags: "",
    notes: "",
    lastActivity: stamp,
  });
}
export function validateLead(l: Lead): string[] {
  const errors: string[] = [];
  if (!l.name.trim()) errors.push("Name is required");
  if (l.email && !validEmail(l.email)) errors.push("Invalid email address");
  if (l.phone && !validPhone(l.phone))
    errors.push("Phone must contain 7–15 digits; include country code");
  if (!sources.includes(l.primarySource)) errors.push("Invalid primary source");
  if (!stages.includes(l.pipelineStage)) errors.push("Invalid pipeline stage");
  if (!temperatures.includes(l.temperature)) errors.push("Invalid temperature");
  if (!consentStatuses.includes(l.consentStatus))
    errors.push("Invalid consent status");
  if (!currencies.includes(l.currency)) errors.push("Unsupported currency");
  if (!Number.isFinite(l.estimatedValue) || l.estimatedValue < 0)
    errors.push("Estimated value must be a non-negative number");
  if (
    l.manualScore !== null &&
    (!Number.isFinite(l.manualScore) ||
      l.manualScore < 0 ||
      l.manualScore > 100)
  )
    errors.push("Manual score must be 0–100");
  for (const key of [
    "createdAt",
    "nextFollowUpAt",
    "lastContactedAt",
    "wonAt",
  ] as const)
    if (l[key] && Number.isNaN(Date.parse(l[key])))
      errors.push(`Invalid ${key} date`);
  if (l.wonAt && Date.parse(l.wonAt) < Date.parse(l.createdAt))
    errors.push("Won date cannot precede created date");
  for (const key of ["landingPageUrl", "socialPostUrl"] as const)
    if (l[key] && !safeUrl(l[key])) errors.push(`${key} must be HTTP(S)`);
  return errors;
}
export function duplicateMatches(
  lead: Lead,
  existing: Lead[],
): { lead: Lead; reason: string }[] {
  return existing.flatMap((other) => {
    const reason =
      lead.email && normalized(lead.email) === normalized(other.email)
        ? "Email"
        : lead.phone &&
            normalizePhone(lead.phone) === normalizePhone(other.phone)
          ? "Phone"
          : lead.name &&
              normalized(lead.name) === normalized(other.name) &&
              normalized(lead.company) === normalized(other.company)
            ? "Name + company"
            : "";
    return reason ? [{ lead: other, reason }] : [];
  });
}
export type CrmFilters = Record<string, string>;
export function filterLeads(
  leads: Lead[],
  filters: CrmFilters,
  followUps: FollowUp[],
  now = Date.now(),
): Lead[] {
  return leads.filter((l) =>
    Object.entries(filters).every(([k, v]) => {
      if (!v) return true;
      const n = normalized(v);
      switch (k) {
        case "query":
          return [l.name, l.company, l.email, l.phone].some((s) =>
            normalized(s).includes(n),
          );
        case "source":
          return l.primarySource === v;
        case "sourceDetails":
          return normalized(l.sourceDetails).includes(n);
        case "service":
          return l.services.includes(v);
        case "stage":
          return l.pipelineStage === v;
        case "temperature":
          return l.temperature === v;
        case "country":
          return normalized(l.country).includes(n);
        case "tags":
          return l.tags.split(",").some((t) => normalized(t).includes(n));
        case "scoreMin":
          return l.score >= Number(v);
        case "scoreMax":
          return l.score <= Number(v);
        case "valueMin":
          return l.estimatedValue >= Number(v);
        case "valueMax":
          return l.estimatedValue <= Number(v);
        case "createdFrom":
          return l.createdAt.slice(0, 10) >= v;
        case "createdTo":
          return l.createdAt.slice(0, 10) <= v;
        case "followFrom":
          return !!l.nextFollowUpAt && l.nextFollowUpAt.slice(0, 10) >= v;
        case "followTo":
          return !!l.nextFollowUpAt && l.nextFollowUpAt.slice(0, 10) <= v;
        case "archived":
          return v === "all" || (v === "yes" ? !!l.archivedAt : !l.archivedAt);
        case "hasEmail":
          return v === "yes" ? !!l.email : !l.email;
        case "hasPhone":
          return v === "yes" ? !!l.phone : !l.phone;
        case "overdue": {
          const late = followUps.some(
            (f) =>
              f.leadId === l.id && !f.completedAt && Date.parse(f.dueAt) < now,
          );
          return v === "yes" ? late : !late;
        }
        default:
          return true;
      }
    }),
  );
}
// Only closed-vocabulary, numeric and date filters may be persisted. No free text/PII.
export function safeFilterPreference(filters: CrmFilters): CrmFilters {
  const allowed: Record<string, readonly string[]> = {
    source: sources,
    stage: stages,
    temperature: temperatures,
    archived: ["all", "yes", "no"],
    hasEmail: ["yes", "no"],
    hasPhone: ["yes", "no"],
    overdue: ["yes", "no"],
  };
  return Object.fromEntries(
    Object.entries(filters).filter(
      ([k, v]) =>
        allowed[k]?.includes(v) ||
        (["scoreMin", "scoreMax", "valueMin", "valueMax"].includes(k) &&
          /^\d+(\.\d+)?$/.test(v)) ||
        (["createdFrom", "createdTo", "followFrom", "followTo"].includes(k) &&
          /^\d{4}-\d{2}-\d{2}$/.test(v)),
    ),
  );
}
export function followUpGroup(
  f: FollowUp,
  timeZone = "Asia/Kolkata",
  now = new Date(),
) {
  if (f.completedAt) return "Completed";
  if (Date.parse(f.dueAt) < now.getTime()) return "Overdue";
  return dayKey(new Date(f.dueAt), timeZone) === dayKey(now, timeZone)
    ? "Today"
    : "Upcoming";
}
export function analytics(leads: Lead[], followUps: FollowUp[]) {
  const active = leads.filter((l) => !l.archivedAt);
  const count = (values: string[]) =>
    Object.entries(
      values.reduce<Record<string, number>>(
        (a, k) => ({ ...a, [k]: (a[k] ?? 0) + 1 }),
        {},
      ),
    );
  const wins = active.filter(
    (l) =>
      l.pipelineStage === "Won" &&
      l.wonAt &&
      Date.parse(l.wonAt) >= Date.parse(l.createdAt),
  );
  return {
    total: active.length,
    bySource: count(active.map((l) => l.primarySource)),
    byService: count(
      active.flatMap((l) =>
        l.services.length ? l.services : ["Not specified"],
      ),
    ),
    byStage: count(active.map((l) => l.pipelineStage)),
    byTemperature: count(active.map((l) => l.temperature)),
    monthly: count(active.map((l) => l.createdAt.slice(0, 7))).sort(
      ([a], [b]) => a.localeCompare(b),
    ),
    overdue: followUps.filter(
      (f) =>
        !f.completedAt &&
        Date.parse(f.dueAt) < Date.now() &&
        active.some((l) => l.id === f.leadId),
    ).length,
    averageDays: wins.length
      ? wins.reduce(
          (s, l) =>
            s + (Date.parse(l.wonAt) - Date.parse(l.createdAt)) / 86400000,
          0,
        ) / wins.length
      : null,
    sources: Array.from(new Set(active.map((l) => l.primarySource))).map(
      (source) => {
        const rows = active.filter((l) => l.primarySource === source);
        const qualified = rows.filter((l) =>
          ["Qualified", "Proposal", "Won"].includes(l.pipelineStage),
        ).length;
        const won = rows.filter((l) => l.pipelineStage === "Won");
        const values: Record<string, number> = {};
        for (const l of won)
          values[l.currency] = (values[l.currency] ?? 0) + l.estimatedValue;
        return {
          source,
          total: rows.length,
          qualified,
          won: won.length,
          values,
        };
      },
    ),
  };
}
