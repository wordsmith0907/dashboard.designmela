import type { Client, Service, Quote, Proposal, Payment } from "./business";
export const stages = [
  "New",
  "Contacted",
  "Qualified",
  "Meeting",
  "Proposal",
  "Won",
  "Lost",
] as const;
export const auditStatuses = [
  "Requested",
  "Reviewing",
  "Draft ready",
  "Sent",
  "Follow-up",
  "Converted",
  "Closed",
] as const;
export const projectStatuses = [
  "Planned",
  "Active",
  "Waiting for client",
  "Review",
  "Completed",
  "On hold",
] as const;
export const contentStatuses = [
  "Idea",
  "Drafting",
  "Designing",
  "Internal review",
  "Client approval",
  "Approved",
  "Scheduled",
  "Published",
  "Failed",
  "Archived",
] as const;
export const runStatuses = [
  "Queued",
  "Running",
  "Successful",
  "Failed",
  "Cancelled",
] as const;
export const platforms = [
  "Instagram",
  "LinkedIn",
  "Facebook",
  "YouTube",
  "Website",
];
export const services = ["Brand identity", "Web design", "Social media", "SEO"];
export const sources = [
  "Website Form",
  "Website Audit",
  "WhatsApp",
  "Instagram",
  "Facebook",
  "LinkedIn",
  "Google Search",
  "Google Maps",
  "Referral",
  "Cold Email",
  "Cold Call",
  "Advertisement",
  "Networking",
  "CSV/Excel Import",
  "Manual Entry",
  "Other",
] as const;
export const temperatures = ["Hot", "Warm", "Cold"] as const;
export const consentStatuses = [
  "Unknown",
  "Granted",
  "Denied",
  "Not required",
] as const;
export const currencies = ["INR", "USD", "EUR", "GBP", "AED"] as const;
export const activityTypes = [
  "Lead created",
  "Imported",
  "Note added",
  "Email logged",
  "WhatsApp logged",
  "Call logged",
  "Meeting logged",
  "Follow-up created",
  "Pipeline stage changed",
  "Proposal sent",
  "Lead won",
  "Lead lost",
  "Lead archived",
  "Lead updated",
] as const;
export interface Entity {
  id: string;
  createdAt: string;
  updatedAt: string;
}
export interface User extends Entity {
  name: string;
  email: string;
  role: "owner" | "member";
}
export interface LegacyLead extends Entity {
  name: string;
  company: string;
  email: string;
  phone: string;
  country: string;
  source: string;
  service: string;
  stage: (typeof stages)[number];
  value: number;
  followUp: string;
  owner: string;
  tags: string;
  notes: string;
  lastActivity: string;
}
export interface Lead extends LegacyLead {
  city: string;
  primarySource: (typeof sources)[number];
  sourceDetails: string;
  campaign: string;
  referrerName: string;
  landingPageUrl: string;
  socialPostUrl: string;
  importedFilename: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  firstTouchSource: string;
  latestTouchSource: string;
  pipelineStage: (typeof stages)[number];
  temperature: (typeof temperatures)[number];
  score: number;
  scoreReasons: string[];
  manualScore: number | null;
  estimatedValue: number;
  currency: (typeof currencies)[number];
  services: string[];
  lastContactedAt: string;
  nextFollowUpAt: string;
  lostReason: string;
  wonAt: string;
  consentStatus: (typeof consentStatuses)[number];
  archivedAt: string;
  positiveReply: boolean;
  proposalRequested: boolean;
  importId: string;
}
export interface LeadActivity extends Entity {
  leadId: string;
  type: (typeof activityTypes)[number];
  description: string;
  actor: string;
}
export interface FollowUp extends Entity {
  leadId: string;
  title: string;
  dueAt: string;
  type: "Call" | "Email" | "WhatsApp" | "Meeting" | "Other";
  priority: "Low" | "Medium" | "High";
  completedAt: string;
  reminderStatus: "In dashboard" | "Dismissed";
}
export type DuplicateChoice = "skip" | "update" | "separate";
export interface LeadImportRow {
  rowNumber: number;
  status: "Created" | "Updated" | "Skipped" | "Failed" | "Undone" | "Retained";
  leadId: string;
  message: string;
  createdVersion?: string;
  undoOutcome?: "Deleted" | "Preserved" | "Skipped" | "Failed";
  undoMessage?: string;
}
export interface LeadImport extends Entity {
  filename: string;
  importedBy: string;
  totalRows: number;
  successfulRows: number;
  updatedRows: number;
  skippedRows: number;
  failedRows: number;
  status: "Completed" | "Completed with errors" | "Undone" | "Partially undone";
  rows: LeadImportRow[];
  undoSummary?: { deleted: number; preserved: number; skipped: number; failed: number };
}
export interface SavedFilter {
  id: string;
  label: string;
  filters: Record<string, string>;
}
export interface AuditEvent extends Entity {
  actor: string;
  action: string;
  recordIds: string[];
  description: string;
}
export interface Activity extends Entity {
  leadId: string;
  kind: "Note" | "Activity";
  description: string;
}
export interface Task extends Entity {
  title: string;
  leadId: string;
  auditId: string;
  dueDate: string;
  done: boolean;
}
export interface Audit extends Entity {
  title: string;
  leadId: string;
  website: string;
  type: string;
  status: (typeof auditStatuses)[number];
  score: number;
  requestedDate: string;
  dueDate: string;
  owner: string;
  findings: string;
  recommendations: string;
  reportUrl: string;
}
export interface Project extends Entity {
  name: string;
  leadId: string;
  client: string;
  service: string;
  status: (typeof projectStatuses)[number];
  priority: "Low" | "Medium" | "High";
  startDate: string;
  dueDate: string;
  progress: number;
  nextAction: string;
  notes: string;
}
export interface ContentItem extends Entity {
  title: string;
  client: string;
  type: string;
  platform: string;
  campaign: string;
  status: (typeof contentStatuses)[number];
  scheduledAt: string;
  caption: string;
  assetUrl: string;
  approvalNotes: string;
}
export interface PublishedPost extends Entity {
  contentId: string;
  title: string;
  platform: string;
  client: string;
  campaign: string;
  publishedAt: string;
  liveUrl: string;
  assetUrl: string;
  scheduledAt: string;
  method: "Manual" | "Automation";
  runId: string;
  initialStatus: string;
  notes: string;
  metrics: {
    likes: number | null;
    clicks: number | null;
    reach: number | null;
    engagement: number | null;
    conversions: number | null;
  };
}
export interface AutomationWorkflow extends Entity {
  name: string;
  category: string;
  status: string;
  lastRun: string;
  nextRun: string;
  successes: number;
  failures: number;
  lastError: string;
  n8nId: string;
  workflowUrl: string;
}
export interface AutomationRun extends Entity {
  workflowId: string;
  status: (typeof runStatuses)[number];
  startedAt: string;
  error: string;
}
export interface Notification extends Entity {
  title: string;
  read: boolean;
}
export interface Settings {
  agency: string;
  user: string;
  email: string;
  currency: string;
  timeZone: string;
  appearance: "Comfortable" | "Compact";
}
export interface Database {
  clients: Client[];
  services: Service[];
  quotes: Quote[];
  proposals: Proposal[];
  payments: Payment[];
  users: User[];
  leads: Lead[];
  leadActivities: LeadActivity[];
  followUps: FollowUp[];
  imports: LeadImport[];
  auditEvents: AuditEvent[];
  activities: Activity[];
  tasks: Task[];
  audits: Audit[];
  projects: Project[];
  content: ContentItem[];
  posted: PublishedPost[];
  workflows: AutomationWorkflow[];
  runs: AutomationRun[];
  notifications: Notification[];
  settings: Settings;
}
export type Collection = Exclude<keyof Database, "settings">;
export type RecordOf<K extends Collection> = Database[K][number];
export type EditableCollection =
  "leads" | "audits" | "projects" | "content" | "posted";
export const emptyMetrics = () => ({
  likes: null,
  clicks: null,
  reach: null,
  engagement: null,
  conversions: null,
});
