
import { Lead, DuplicateChoice } from "./domain";
import {
  newLead,
  projectLead,
  validateLead,
  duplicateMatches,
} from "./crm";
export const MAX_BYTES = 5 * 1024 * 1024,
  MAX_ROWS = 2000,
  MAX_COLUMNS = 60;
export const importFields = [
  "name",
  "firstName",
  "lastName",
  "company",
  "email",
  "phone",
  "country",
  "city",
  "primarySource",
  "sourceDetails",
  "campaign",
  "services",
  "pipelineStage",
  "temperature",
  "estimatedValue",
  "currency",
  "nextFollowUpAt",
  "tags",
  "notes",
  "createdAt",
  "consentStatus",
] as const;
export type ImportField = (typeof importFields)[number];
export type Mapping = Record<string, ImportField | "">;
export interface ParsedFile {
  headers: string[];
  rows: string[][];
  sheetName: string;
  formulaRows: number[];
}
export interface ValidatedRow {
  rowNumber: number;
  lead: Lead;
  errors: string[];
  matches: { id: string; name: string; reason: string }[];
  fileDuplicate: number | null;
  fields: ImportField[];
}
export interface ImportRequest {
  filename: string;
  rows: ValidatedRow[];
  strategy: DuplicateChoice | "review";
  choices: Record<number, DuplicateChoice>;
  targets: Record<number, string>;
  validOnly: boolean;
  confirmed: boolean;
}
const aliases: Record<string, ImportField> = {
  fullname: "name",
  contactname: "name",
  firstname: "firstName",
  lastname: "lastName",
  companyname: "company",
  emailaddress: "email",
  phonenumber: "phone",
  mobile: "phone",
  primarysource: "primarySource",
  source: "primarySource",
  sourcedetails: "sourceDetails",
  campaignname: "campaign",
  serviceinterestedin: "services",
  service: "services",
  stage: "pipelineStage",
  leadtemperature: "temperature",
  estimatedvalue: "estimatedValue",
  estimatedprojectvalue: "estimatedValue",
  value: "estimatedValue",
  nextfollowupdate: "nextFollowUpAt",
  nextfollowup: "nextFollowUpAt",
  createddate: "createdAt",
  consent: "consentStatus",
};
const key = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
export function suggestMapping(headers: string[]): Mapping {
  const used = new Set<string>();
  return Object.fromEntries(
    headers.map((h) => {
      const field =
        importFields.find((f) => key(f) === key(h)) ?? aliases[key(h)] ?? "";
      if (used.has(field)) return [h, ""];
      used.add(field);
      return [h, field];
    }),
  );
}
export function mappingErrors(mapping: Mapping): string[] {
  const fields = Object.values(mapping).filter(Boolean);
  const errors: string[] = [];
  if (!fields.includes("name") && !fields.includes("firstName"))
    errors.push("Map Full name or First name.");
  if (new Set(fields).size !== fields.length)
    errors.push("Each CRM field may be mapped only once.");
  return errors;
}
export function importDate(value: string): string {
  if (!value) return "";
  if (
    !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(
      value,
    )
  )
    throw new Error("Use YYYY-MM-DD or an ISO timestamp with time zone");
  const datePart = value.slice(0, 10);
  const d = new Date(`${datePart}T00:00:00Z`);
  if (
    Number.isNaN(d.getTime()) ||
    d.toISOString().slice(0, 10) !== datePart ||
    Number.isNaN(Date.parse(value))
  )
    throw new Error("Invalid calendar date");
  return new Date(
    value.length === 10 ? `${value}T09:00:00Z` : value,
  ).toISOString();
}
export function validateRows(
  parsed: ParsedFile,
  mapping: Mapping,
  existing: Lead[],
): ValidatedRow[] {
  const errors = mappingErrors(mapping);
  if (errors.length) throw new Error(errors.join(" "));
  const prior: Lead[] = [];
  return parsed.rows.map((cells, index) => {
    const values: Record<string, string> = {};
    parsed.headers.forEach((h, i) => {
      if (mapping[h]) values[mapping[h]] = cells[i].trim();
    });
    let lead = newLead();
    const errors: string[] = [];
    const fields = Object.values(mapping).filter(Boolean) as ImportField[];
    for (const [field, value] of Object.entries(values)) {
      if (!value) continue;
      if (["firstName", "lastName"].includes(field)) continue;
      if (field === "services") {
        lead.services = value
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter(Boolean);
        continue;
      }
      if (field === "estimatedValue") {
        if (!/^\d+(?:\.\d+)?$/.test(value))
          errors.push(
            "Estimated value must be plain digits with optional decimal point",
          );
        lead.estimatedValue = Number(value);
        continue;
      }
      if (["createdAt", "nextFollowUpAt"].includes(field)) {
        try {
          lead = { ...lead, [field]: importDate(value) };
        } catch (e) {
          errors.push(`${field}: ${(e as Error).message}`);
        }
        continue;
      }
      lead = { ...lead, [field]: value };
    }
    lead.name =
      values.name ||
      [values.firstName, values.lastName].filter(Boolean).join(" ");
    lead.primarySource = (values.primarySource ||
      "CSV/Excel Import") as Lead["primarySource"];
    lead.firstTouchSource = lead.primarySource;
    lead.latestTouchSource = lead.primarySource;
    lead = projectLead(lead);
    if (cells.every((v) => !v.trim())) errors.push("Empty row");
    if (parsed.formulaRows.includes(index + 2))
      errors.push("Formula cells are not imported; paste plain values first");
    errors.push(...validateLead(lead));
    const matches = duplicateMatches(lead, existing).map((m) => ({
      id: m.lead.id,
      name: `${m.lead.name} · ${m.lead.company}`,
      reason: m.reason,
    }));
    const fileMatch = duplicateMatches(lead, prior)[0];
    const fileDuplicate = fileMatch
      ? prior.findIndex((l) => l.id === fileMatch.lead.id) + 2
      : null;
    prior.push(lead);
    return {
      rowNumber: index + 2,
      lead,
      errors,
      matches,
      fileDuplicate,
      fields,
    };
  });
}
export const templateRow = {
  "Full name": "Asha Fictional",
  Company: "Example Studio",
  Email: "asha@example.com",
  Phone: "",
  Country: "India",
  City: "",
  "Primary source": "CSV/Excel Import",
  "Source details": "Fictional template",
  Campaign: "Demo outreach",
  "Service interested in": "Web design",
  "Pipeline stage": "New",
  "Lead temperature": "Warm",
  "Estimated value": "50000",
  Currency: "INR",
  "Next follow-up date": "2026-12-01",
  Tags: "Demo",
  Notes: "Fictional example only",
  "Created date": "2026-10-22",
  "Consent status": "Unknown",
};
