import {
  Database,
  Lead,
  LeadActivity,
  FollowUp,
  LeadImport,
  DuplicateChoice,
  Collection,
} from "./domain";
import { projectLead, validateLead, duplicateMatches } from "./crm";
import type { ImportRequest } from "./lead-import";
export type BulkAction = {
  type: "stage" | "tag" | "temperature" | "source" | "followUp" | "archive";
  value: string;
};
const base = () => {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), createdAt: now, updatedAt: now };
};
function importVersion(data: Database, id: string) {
  return JSON.stringify({
    lead: data.leads.find((l) => l.id === id),
    followUps: data.followUps.filter((f) => f.leadId === id),
    activities: data.leadActivities.filter((a) => a.leadId === id),
  });
}
export function event(
  data: Database,
  leadId: string,
  type: LeadActivity["type"],
  description: string,
) {
  data.leadActivities.push({
    ...base(),
    leadId,
    type,
    description,
    actor: data.settings.user,
  });
}
export function audit(
  data: Database,
  action: string,
  recordIds: string[],
  description: string,
) {
  data.auditEvents.push({
    ...base(),
    actor: data.settings.user,
    action,
    recordIds,
    description,
  });
}
export function saveLead(data: Database, input: Lead) {
  const existing = data.leads.find((l) => l.id === input.id);
  const now = new Date().toISOString();
  const lead = projectLead({
    ...input,
    updatedAt: now,
    firstTouchSource:
      existing?.firstTouchSource ||
      input.firstTouchSource ||
      input.primarySource,
    latestTouchSource:
      existing && existing.primarySource !== input.primarySource
        ? input.primarySource
        : input.latestTouchSource || input.primarySource,
  });
  if (
    existing?.pipelineStage !== lead.pipelineStage &&
    lead.pipelineStage === "Won" &&
    !lead.wonAt
  )
    lead.wonAt = now;
  const errors = validateLead(lead);
  if (errors.length) throw new Error(errors.join(". "));
  if (existing) {
    data.leads[data.leads.indexOf(existing)] = lead;
    if (existing.pipelineStage !== lead.pipelineStage)
      event(
        data,
        lead.id,
        lead.pipelineStage === "Won"
          ? "Lead won"
          : lead.pipelineStage === "Lost"
            ? "Lead lost"
            : "Pipeline stage changed",
        `${existing.pipelineStage} → ${lead.pipelineStage}`,
      );
    else if (!existing.archivedAt && lead.archivedAt)
      event(data, lead.id, "Lead archived", "Archived by the user.");
    else
      event(
        data,
        lead.id,
        "Lead updated",
        "Lead details updated. Original first-touch source retained.",
      );
  } else {
    data.leads.push(lead);
    event(data, lead.id, "Lead created", "Lead manually created.");
  }
  if (lead.nextFollowUpAt && lead.nextFollowUpAt !== existing?.nextFollowUpAt)
    addFollowUp(data, {
      ...base(),
      leadId: lead.id,
      title: `Follow up with ${lead.name}`,
      dueAt: lead.nextFollowUpAt,
      type: "Other",
      priority: "Medium",
      completedAt: "",
      reminderStatus: "In dashboard",
    });
  return lead;
}
export function syncNextFollowUp(data: Database, leadId: string) {
  const l = data.leads.find((l) => l.id === leadId);
  if (!l) return;
  l.nextFollowUpAt =
    data.followUps
      .filter((f) => f.leadId === leadId && !f.completedAt)
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0]?.dueAt ?? "";
  Object.assign(l, projectLead(l));
}
export function addFollowUp(data: Database, f: FollowUp) {
  if (!data.leads.some((l) => l.id === f.leadId))
    throw new Error("Related lead not found.");
  if (!f.title.trim() || !f.dueAt || Number.isNaN(Date.parse(f.dueAt)))
    throw new Error("A title and valid follow-up time are required.");
  data.followUps.push({ ...f, dueAt: new Date(f.dueAt).toISOString() });
  event(
    data,
    f.leadId,
    "Follow-up created",
    `${f.title} · ${f.type} · ${f.priority} priority`,
  );
  syncNextFollowUp(data, f.leadId);
  const l = data.leads.find((l) => l.id === f.leadId)!;
  l.updatedAt = new Date().toISOString();
}
export function bulkChange(data: Database, ids: string[], action: BulkAction) {
  if (!ids.length) throw new Error("Select at least one lead.");
  if (ids.some((id) => !data.leads.some((l) => l.id === id)))
    throw new Error("Selection includes a missing lead.");
  for (const id of new Set(ids)) {
    const lead = { ...data.leads.find((l) => l.id === id)! };
    switch (action.type) {
      case "stage":
        lead.pipelineStage = action.value as Lead["pipelineStage"];
        break;
      case "temperature":
        lead.temperature = action.value as Lead["temperature"];
        break;
      case "source":
        lead.primarySource = action.value as Lead["primarySource"];
        break;
      case "tag":
        if (!action.value.trim()) throw new Error("Enter a tag.");
        lead.tags = Array.from(
          new Set([
            ...lead.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
            action.value.trim(),
          ]),
        ).join(", ");
        break;
      case "archive":
        lead.archivedAt = new Date().toISOString();
        break;
      case "followUp":
        if (!action.value || Number.isNaN(Date.parse(action.value)))
          throw new Error("Choose a valid follow-up time.");
        lead.nextFollowUpAt = new Date(action.value).toISOString();
        break;
    }
    saveLead(data, lead);
  }
  audit(
    data,
    "Bulk change",
    ids,
    `${action.type}: ${action.type === "archive" ? "Archived" : action.value}`,
  );
}
const protectedImportFields = new Set([
  "notes",
  "primarySource",
  "sourceDetails",
  "campaign",
  "firstTouchSource",
  "latestTouchSource",
  "importedFilename",
  "importId",
  "createdAt",
]);
export function applyImport(
  data: Database,
  request: ImportRequest,
): LeadImport {
  if (!request.confirmed)
    throw new Error("Confirm the import before processing records.");
  if (!request.rows.length || request.rows.length > 2000)
    throw new Error("Import must contain 1–2000 rows.");
  if (!request.validOnly && request.rows.some((r) => r.errors.length))
    throw new Error("Correct invalid rows or choose valid rows only.");
  const report: LeadImport = {
    ...base(),
    filename: request.filename,
    importedBy: data.settings.user,
    totalRows: request.rows.length,
    successfulRows: 0,
    updatedRows: 0,
    skippedRows: 0,
    failedRows: 0,
    status: "Completed",
    rows: [],
  };
  for (const row of request.rows) {
    const errors = [...row.errors, ...validateLead(row.lead)];
    if (errors.length) {
      report.failedRows++;
      report.rows.push({
        rowNumber: row.rowNumber,
        status: "Failed",
        leadId: "",
        message: Array.from(new Set(errors)).join("; "),
      });
      continue;
    }
    const matches = duplicateMatches(row.lead, data.leads);
    const conflict = matches.length > 0 || row.fileDuplicate !== null;
    const choice: DuplicateChoice | undefined = conflict
      ? request.strategy === "review"
        ? request.choices[row.rowNumber]
        : request.strategy
      : "separate";
    if (!choice) throw new Error(`Choose an action for row ${row.rowNumber}.`);
    if (conflict && choice === "skip") {
      report.skippedRows++;
      report.rows.push({
        rowNumber: row.rowNumber,
        status: "Skipped",
        leadId: matches[0]?.lead.id ?? "",
        message: "Duplicate skipped.",
      });
      continue;
    }
    if (conflict && choice === "update" && matches.length) {
      let target = matches[0].lead;
      if (matches.length > 1) {
        const selected = matches.find(
          (m) => m.lead.id === request.targets[row.rowNumber],
        );
        if (!selected)
          throw new Error(
            `Row ${row.rowNumber} matches multiple records. Review and select a target, skip, or create separately.`,
          );
        target = selected.lead;
      }
      let updated = { ...target };
      for (const field of row.fields) {
        if (
          !protectedImportFields.has(field) &&
          !["firstName", "lastName"].includes(field)
        )
          updated = { ...updated, [field]: row.lead[field as keyof Lead] };
      }
      if (row.fields.includes("firstName") && !row.fields.includes("name"))
        updated.name = row.lead.name;
      if (row.lead.notes && row.lead.notes !== target.notes)
        updated.notes = [
          target.notes,
          `Imported note (${request.filename}): ${row.lead.notes}`,
        ]
          .filter(Boolean)
          .join("\n");
      const saved = saveLead(data, updated);
      event(
        data,
        saved.id,
        "Imported",
        `Updated from ${request.filename}, row ${row.rowNumber}. Source attribution retained; incoming notes appended.`,
      );
      report.updatedRows++;
      report.rows.push({
        rowNumber: row.rowNumber,
        status: "Updated",
        leadId: saved.id,
        message:
          "Updated mapped fields; source history and activities preserved, notes appended.",
      });
    } else {
      const lead = saveLead(data, {
        ...row.lead,
        id: crypto.randomUUID(),
        importedFilename: request.filename,
        importId: report.id,
      });
      event(
        data,
        lead.id,
        "Imported",
        `Created from ${request.filename}, row ${row.rowNumber}.`,
      );
      report.successfulRows++;
      report.rows.push({
        rowNumber: row.rowNumber,
        status: "Created",
        leadId: lead.id,
        message: "Created.",
        createdVersion: importVersion(data, lead.id),
      });
    }
  }
  report.status = report.failedRows ? "Completed with errors" : "Completed";
  data.imports.push(report);
  audit(
    data,
    "Import",
    report.rows.map((r) => r.leadId).filter(Boolean),
    `${report.id}: ${report.successfulRows} created, ${report.updatedRows} updated, ${report.skippedRows} skipped, ${report.failedRows} failed`,
  );
  return report;
}
export function undoImport(data: Database, id: string) {
  const report = data.imports.find((i) => i.id === id);
  if (!report) throw new Error("Import not found.");
  if (["Undone", "Partially undone"].includes(report.status))
    throw new Error("This import was already reviewed for undo.");
  const removed: string[] = [];
  const summary = { deleted: 0, preserved: 0, skipped: 0, failed: 0 };
  for (const row of report.rows) {
    if (row.status !== "Created") {
      row.undoOutcome = "Skipped";
      row.undoMessage = "Not created by this import; no undo attempted.";
      summary.skipped++;
      continue;
    }
    const lead = data.leads.find((l) => l.id === row.leadId);
    if (!lead) {
      row.undoOutcome = "Skipped";
      row.undoMessage = "Lead is already absent; nothing was deleted.";
      summary.skipped++;
      continue;
    }
    // Missing provenance is an undo failure, never permission to delete.
    if (!row.createdVersion || lead.importId !== report.id) {
      row.undoOutcome = "Failed";
      row.undoMessage = "Import provenance could not be verified; lead preserved.";
      summary.failed++;
      continue;
    }
    const relationships = relatedLeadCollections(data, lead.id);
    if (importVersion(data, lead.id) !== row.createdVersion || relationships.length) {
      row.status = "Retained";
      row.undoOutcome = "Preserved";
      row.undoMessage = relationships.length
        ? `Preserved: referenced by ${relationships.join(", ")}.`
        : "Preserved: lead, activities or follow-ups changed after import.";
      row.message = row.undoMessage;
      summary.preserved++;
    } else {
      removed.push(lead.id);
      data.leads = data.leads.filter((l) => l.id !== lead.id);
      data.followUps = data.followUps.filter((f) => f.leadId !== lead.id);
      data.leadActivities = data.leadActivities.filter(
        (a) => a.leadId !== lead.id,
      );
      row.status = "Undone";
      row.message = "Unchanged imported record removed.";
      row.undoOutcome = "Deleted";
      row.undoMessage = "Unchanged import-created lead and its import-created timeline/follow-ups deleted.";
      summary.deleted++;
    }
  }
  report.undoSummary = summary;
  report.status = summary.preserved || summary.failed || report.rows.some(r => r.status === "Updated")
    ? "Partially undone"
    : "Undone";
  report.updatedAt = new Date().toISOString();
  audit(
    data,
    "Undo import",
    removed,
    `Undo ${report.id}: ${summary.deleted} deleted, ${summary.preserved} preserved, ${summary.skipped} skipped, ${summary.failed} failed. Updated/existing records are never removed.`,
  );
}

type LeadReferenceCollection = {
  [K in Collection]: "leadId" extends keyof Database[K][number] ? K : never
}[Collection];
// Exhaustive: adding an entity with leadId requires an explicit undo decision.
// Only import-created follow-ups/timeline may be removed; their exact snapshot
// is checked above. Notes and communications are covered by both activity stores.
const leadRelationships = {
  clients: true, quotes: true, proposals: true, payments: true,
  projects: true, audits: true, tasks: true, activities: true,
  leadActivities: false, followUps: false,
} satisfies Record<LeadReferenceCollection, boolean>;

function relatedLeadCollections(data: Database, leadId: string): string[] {
  return (Object.keys(leadRelationships) as LeadReferenceCollection[])
    .filter(key => leadRelationships[key] && data[key].some(record => record.leadId === leadId));
}
