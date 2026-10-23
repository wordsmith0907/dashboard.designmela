import {
  auditStatuses,
  contentStatuses,
  projectStatuses,
  stages,
  platforms,
  services,
  sources,
  EditableCollection,
} from "./domain";
export interface Field {
  key: string;
  label: string;
  type?:
    | "text"
    | "email"
    | "tel"
    | "url"
    | "number"
    | "date"
    | "datetime-local"
    | "textarea"
    | "select";
  options?: readonly string[];
  required?: boolean;
  min?: number;
  max?: number;
}
const f = (
  key: string,
  label: string,
  type: Field["type"] = "text",
  required = false,
  options?: readonly string[],
): Field => ({ key, label, type, required, options });
export const fields: Record<EditableCollection, Field[]> = {
  leads: [
    f("name", "Contact name", "text", true),
    f("company", "Company", "text", true),
    f("email", "Email", "email"),
    f("phone", "Phone", "tel"),
    f("country", "Country"),
    f("source", "Source", "select", true, sources),
    f("service", "Service", "select", true, services),
    f("stage", "Pipeline stage", "select", true, stages),
    { ...f("value", "Estimated value", "number", true), min: 0 },
    f("followUp", "Next follow-up", "date"),
    f("owner", "Assigned owner", "text", true),
    f("tags", "Tags (comma separated)"),
    f("notes", "Notes", "textarea"),
  ],
  audits: [
    f("title", "Audit title", "text", true),
    f("leadId", "Related lead", "select"),
    f("website", "Website URL", "url", true),
    f("type", "Audit type", "text", true),
    f("status", "Status", "select", true, auditStatuses),
    {
      ...f("score", "Fictional demo score (0–100)", "number", true),
      min: 0,
      max: 100,
    },
    f("requestedDate", "Requested date", "date", true),
    f("dueDate", "Due date", "date", true),
    f("owner", "Assigned owner", "text", true),
    f("findings", "Findings summary", "textarea"),
    f("recommendations", "Recommendations", "textarea"),
    f("reportUrl", "Report URL", "url"),
  ],
  projects: [
    f("name", "Project name", "text", true),
    f("leadId", "Related lead", "select"),
    f("client", "Client", "text", true),
    f("service", "Service", "select", true, services),
    f("status", "Status", "select", true, projectStatuses),
    f("priority", "Priority", "select", true, ["Low", "Medium", "High"]),
    f("startDate", "Start date", "date", true),
    f("dueDate", "Due date", "date", true),
    { ...f("progress", "Progress (%)", "number", true), min: 0, max: 100 },
    f("nextAction", "Next action", "text", true),
    f("notes", "Notes", "textarea"),
  ],
  content: [
    f("title", "Content title", "text", true),
    f("client", "Client or Designmela", "text", true),
    f("type", "Content type", "select", true, [
      "Carousel",
      "Reel",
      "Article",
      "Static post",
      "Video",
    ]),
    f("platform", "Platform", "select", true, platforms),
    f("campaign", "Campaign"),
    f(
      "status",
      "Status",
      "select",
      true,
      contentStatuses.filter((s) => s !== "Published"),
    ),
    f(
      "scheduledAt",
      "Scheduled date & time (device time zone)",
      "datetime-local",
    ),
    f("caption", "Caption", "textarea"),
    f("assetUrl", "Asset URL", "url"),
    f("approvalNotes", "Approval notes", "textarea"),
  ],
  posted: [
    f("title", "Post title", "text", true),
    f("platform", "Platform", "select", true, platforms),
    f("client", "Client or Designmela", "text", true),
    f("campaign", "Campaign"),
    f(
      "publishedAt",
      "Published date & time (device time zone)",
      "datetime-local",
      true,
    ),
    f("liveUrl", "Live post URL", "url", true),
    f("assetUrl", "Asset URL", "url"),
    f(
      "scheduledAt",
      "Original scheduled time (device time zone)",
      "datetime-local",
    ),
    f("method", "Publishing method", "select", true, ["Manual", "Automation"]),
    f("runId", "Automation run reference"),
    f("initialStatus", "Initial status", "text", true),
    f("notes", "Notes", "textarea"),
  ],
};
export const labels: Record<EditableCollection, string> = {
  leads: "lead",
  audits: "audit",
  projects: "project",
  content: "content item",
  posted: "published post",
};
export function localInput(value: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
