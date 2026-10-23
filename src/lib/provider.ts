import {
  Collection,
  Database,
  RecordOf,
  ContentItem,
  PublishedPost,
  emptyMetrics,
  Lead,
  LeadActivity,
  FollowUp,
  LeadImport,
} from "./domain";
import { projectLead, upgradeLead } from "./crm";
import {
  saveLead,
  addFollowUp,
  syncNextFollowUp,
  bulkChange,
  applyImport,
  undoImport,
  event,
  audit,
  BulkAction,
} from "./crm-operations";
import type { ImportRequest } from "./lead-import";
import { Quote, quoteTotals } from "./business";
import { seed } from "./seed";
import { safeUrl } from "./format";
export interface AuthProvider {
  getUser(): Promise<Database["users"][number] | null>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
}
export interface DataProvider {
  readonly mode: "demo" | "connected";
  load(): Promise<Database>;
  save<K extends Collection>(collection: K, record: RecordOf<K>): Promise<void>;
  deleteLead(id: string): Promise<void>;
  publish(
    contentId: string,
    details: Pick<PublishedPost, "liveUrl" | "publishedAt" | "platform">,
  ): Promise<void>;
  saveSettings(settings: Database["settings"]): Promise<void>;
  reset(): Promise<void>;
  logLeadActivity(
    leadId: string,
    type: LeadActivity["type"],
    description: string,
  ): Promise<void>;
  createFollowUp(followUp: FollowUp): Promise<void>;
  completeFollowUp(id: string): Promise<void>;
  bulkLeads(ids: string[], action: BulkAction): Promise<void>;
  importLeads(request: ImportRequest): Promise<LeadImport>;
  undoLeadImport(id: string): Promise<void>;
  convertLead(id: string): Promise<void>;
  convertProposal(id: string): Promise<void>;
}
/** Per-browser-instance memory only. Never import a shared mutable instance on the server. */
export class DemoProvider implements DataProvider {
  readonly mode = "demo" as const;
  private data: Database = seed();
  constructor(private actorId = "user-1") {}
  private authorize() {
    if (
      !this.data.users.some((u) => u.id === this.actorId && u.role === "owner")
    )
      throw new Error(
        "Owner access is required. Demo authorization boundary only.",
      );
  }
  private transaction<T>(action: (data: Database) => T): T {
    this.authorize();
    const draft = structuredClone(this.data);
    const result = action(draft);
    this.data = draft;
    return structuredClone(result);
  }
  async load() {
    this.authorize();
    return structuredClone(this.data);
  }
  async save<K extends Collection>(collection: K, record: RecordOf<K>) {
    this.authorize();
    if (collection === "leads") {
      this.transaction((d) => saveLead(d, upgradeLead(record as Lead)));
      return;
    }
    if (collection === "quotes") quoteTotals(record as Quote);
    if (
      ["imports", "auditEvents", "leadActivities", "followUps"].includes(
        collection,
      )
    )
      throw new Error("Use the dedicated CRM operation.");
    const rows = this.data[collection] as RecordOf<K>[];
    if (
      collection === "content" &&
      (record as ContentItem).status === "Scheduled" &&
      !(record as ContentItem).scheduledAt
    )
      throw new Error("Add a scheduled date and time in Edit details first.");
    if (
      collection === "content" &&
      (record as ContentItem).status === "Published" &&
      !this.data.posted.some((p) => p.contentId === record.id)
    )
      throw new Error(
        "Use Record publication and provide the live post details.",
      );
    const index = rows.findIndex((r) => r.id === record.id);
    if (index < 0) rows.push(structuredClone(record));
    else rows[index] = structuredClone(record);
  }
  async deleteLead(id: string) {
    this.authorize();
    if (!this.data.leads.some((l) => l.id === id))
      throw new Error("This lead no longer exists.");
    this.data.leads = this.data.leads.filter((l) => l.id !== id);
    this.data.activities = this.data.activities.filter((a) => a.leadId !== id);
    this.data.tasks = this.data.tasks.map((t) =>
      t.leadId === id ? { ...t, leadId: "" } : t,
    );
    this.data.audits = this.data.audits.map((a) =>
      a.leadId === id ? { ...a, leadId: "" } : a,
    );
    this.data.projects = this.data.projects.map((p) =>
      p.leadId === id ? { ...p, leadId: "" } : p,
    );
    this.data.leadActivities = this.data.leadActivities.filter(
      (a) => a.leadId !== id,
    );
    this.data.followUps = this.data.followUps.filter((f) => f.leadId !== id);
    audit(
      this.data,
      "Delete lead",
      [id],
      "Permanent deletion through provider API. UI defaults to archive.",
    );
  }
  async publish(
    contentId: string,
    details: Pick<PublishedPost, "liveUrl" | "publishedAt" | "platform">,
  ) {
    this.authorize();
    const item = this.data.content.find((c) => c.id === contentId);
    if (!item) throw new Error("Content item not found.");
    if (
      !safeUrl(details.liveUrl) ||
      !details.platform ||
      !details.publishedAt ||
      Number.isNaN(Date.parse(details.publishedAt))
    )
      throw new Error(
        "Enter a valid HTTP(S) live URL, platform and publication date.",
      );
    if (new Date(details.publishedAt).getTime() > Date.now())
      throw new Error("Publication time cannot be in the future.");
    if (this.data.posted.some((p) => p.contentId === contentId))
      throw new Error(
        "Publication already recorded. Edit its metadata on Posted.",
      );
    const stamp = new Date().toISOString();
    this.data.posted.push({
      id: crypto.randomUUID(),
      createdAt: stamp,
      updatedAt: stamp,
      contentId,
      title: item.title,
      client: item.client,
      campaign: item.campaign,
      assetUrl: item.assetUrl,
      scheduledAt: item.scheduledAt,
      method: "Manual",
      runId: "",
      initialStatus: "Published",
      notes: "Publication manually recorded in Demo Mode.",
      metrics: emptyMetrics(),
      ...details,
    });
    item.status = "Published";
    item.platform = details.platform;
    item.updatedAt = stamp;
  }
  async saveSettings(settings: Database["settings"]) {
    this.authorize();
    this.data.settings = structuredClone(settings);
  }
  async reset() {
    this.authorize();
    this.data = seed();
  }
  async logLeadActivity(
    leadId: string,
    type: LeadActivity["type"],
    description: string,
  ) {
    this.transaction((d) => {
      const lead = d.leads.find((l) => l.id === leadId);
      if (!lead || !description.trim())
        throw new Error("Lead and description are required.");
      event(d, leadId, type, description.trim());
      const now = new Date().toISOString();
      lead.lastActivity = now;
      lead.updatedAt = now;
      if (
        [
          "Email logged",
          "WhatsApp logged",
          "Call logged",
          "Meeting logged",
        ].includes(type)
      )
        lead.lastContactedAt = now;
      if (type === "Lead won") {
        lead.pipelineStage = "Won";
        lead.wonAt = now;
      }
      if (type === "Lead lost") lead.pipelineStage = "Lost";
      if (type === "Lead archived") lead.archivedAt = now;
      Object.assign(lead, projectLead(lead));
    });
  }
  async createFollowUp(f: FollowUp) {
    this.transaction((d) => addFollowUp(d, f));
  }
  async completeFollowUp(id: string) {
    this.transaction((d) => {
      const f = d.followUps.find((f) => f.id === id);
      if (!f) throw new Error("Follow-up not found.");
      f.completedAt = f.completedAt ? "" : new Date().toISOString();
      f.updatedAt = new Date().toISOString();
      syncNextFollowUp(d, f.leadId);
      const l = d.leads.find((l) => l.id === f.leadId);
      if (l) l.updatedAt = f.updatedAt;
      event(
        d,
        f.leadId,
        "Lead updated",
        f.completedAt ? "Follow-up completed." : "Follow-up reopened.",
      );
    });
  }
  async bulkLeads(ids: string[], action: BulkAction) {
    this.transaction((d) => bulkChange(d, ids, action));
  }
  async importLeads(request: ImportRequest) {
    return this.transaction((d) => applyImport(d, request));
  }
  async undoLeadImport(id: string) {
    this.transaction((d) => undoImport(d, id));
  }
  async convertLead(id: string) {
    this.transaction((d) => {
      const l = d.leads.find((l) => l.id === id);
      if (!l) throw new Error("Lead not found.");
      if (d.clients.some((c) => c.leadId === id))
        throw new Error("Lead is already a client.");
      const stamp = new Date().toISOString();
      d.clients.push({
        id: crypto.randomUUID(),
        createdAt: stamp,
        updatedAt: stamp,
        name: l.name,
        company: l.company,
        leadId: id,
        notes: l.notes,
      });
      saveLead(d, { ...l, pipelineStage: "Won", wonAt: l.wonAt || stamp });
      event(d, id, "Lead updated", "Converted to client.");
    });
  }
  async convertProposal(id: string) {
    this.transaction((d) => {
      const p = d.proposals.find((p) => p.id === id);
      if (!p || p.status !== "Accepted" || p.projectId)
        throw new Error(
          "Choose an accepted proposal that has not been converted.",
        );
      const stamp = new Date().toISOString();
      const projectId = crypto.randomUUID();
      d.projects.push({
        id: projectId,
        createdAt: stamp,
        updatedAt: stamp,
        name: p.title,
        leadId: p.leadId,
        client: d.leads.find((l) => l.id === p.leadId)?.company || "Designmela",
        service: p.scope,
        status: "Planned",
        priority: "Medium",
        startDate: stamp.slice(0, 10),
        dueDate: "",
        progress: 0,
        nextAction: "Confirm kickoff and due date",
        notes: `Proposal ${p.id}\n${p.deliverables}\nTimeline: ${p.timeline}\nRevisions: ${p.revisions}\nValue: ${p.currency} ${p.price}`,
      });
      p.projectId = projectId;
      p.updatedAt = stamp;
      event(
        d,
        p.leadId,
        "Lead updated",
        "Accepted proposal converted into a project.",
      );
    });
  }
}
