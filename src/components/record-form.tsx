"use client";
import { FormEvent, useState } from "react";
import { EditableCollection, RecordOf } from "@/lib/domain";
import { fields, labels, localInput } from "@/lib/fields";
import { safeUrl } from "@/lib/format";
import { useData } from "./data-context";
import { Modal } from "./ui";
import { LeadForm } from "./lead-form";
import { Lead } from "@/lib/domain";
export function RecordForm({
  collection,
  record,
  onClose,
}: {
  collection: EditableCollection;
  record?: RecordOf<EditableCollection>;
  onClose: () => void;
}) {
  return collection === "leads" ? (
    <LeadForm lead={record as Lead | undefined} onClose={onClose} />
  ) : (
    <GenericRecordForm
      collection={collection}
      record={record}
      onClose={onClose}
    />
  );
}
function GenericRecordForm({
  collection,
  record,
  onClose,
}: {
  collection: EditableCollection;
  record?: RecordOf<EditableCollection>;
  onClose: () => void;
}) {
  const { data, provider, mutate, busy } = useData();
  const [error, setError] = useState("");
  if (!data) return null;
  const existing = record as unknown as Record<string, unknown> | undefined;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const values: Record<string, unknown> = {};
    for (const field of fields[collection]) {
      if (
        collection === "content" &&
        field.key === "status" &&
        existing?.status === "Published"
      ) {
        values.status = "Published";
        continue;
      }
      const raw = String(form.get(field.key) ?? "").trim();
      if (field.required && !raw) {
        setError(`${field.label} is required.`);
        return;
      }
      if (field.type === "url" && raw && !safeUrl(raw)) {
        setError("URLs must begin with http:// or https://.");
        return;
      }
      values[field.key] =
        field.type === "number"
          ? Number(raw)
          : field.type === "datetime-local" && raw
            ? new Date(raw).toISOString()
            : raw;
    }
    if (
      values.dueDate &&
      values.startDate &&
      String(values.dueDate) < String(values.startDate)
    ) {
      setError("Due date must be on or after the start date.");
      return;
    }
    if (
      values.dueDate &&
      values.requestedDate &&
      String(values.dueDate) < String(values.requestedDate)
    ) {
      setError("Due date must be on or after the requested date.");
      return;
    }
    if (values.status === "Scheduled" && !values.scheduledAt) {
      setError("Scheduled content needs a date and time.");
      return;
    }
    if (
      collection === "posted" &&
      new Date(String(values.publishedAt)).getTime() > Date.now()
    ) {
      setError("Publication time cannot be in the future.");
      return;
    }
    if (
      collection === "posted" &&
      values.method === "Automation" &&
      !values.runId
    ) {
      setError("Automation publishing requires a run reference.");
      return;
    }
    const stamp = new Date().toISOString();
    const next = {
      ...existing,
      ...values,
      id: record?.id ?? crypto.randomUUID(),
      createdAt: record?.createdAt ?? stamp,
      updatedAt: stamp,
      ...(collection === "leads"
        ? { lastActivity: existing?.lastActivity ?? stamp }
        : {}),
      ...(collection === "content" && existing?.status === "Published"
        ? { status: "Published" }
        : {}),
    };
    if (
      await mutate(
        () =>
          provider.save(
            collection,
            next as unknown as RecordOf<EditableCollection>,
          ),
        `${labels[collection]} ${record ? "updated" : "added"}.`,
      )
    )
      onClose();
    else
      setError("Could not save this record. Review the values and try again.");
  }
  return (
    <Modal
      title={`${record ? "Edit" : "Add"} ${labels[collection]}`}
      onClose={onClose}
      wide
    >
      <p className="muted">
        Demo only · changes last until this page is reloaded. * Required
      </p>
      <form onSubmit={submit}>
        <div className="form-grid">
          {fields[collection].map((field) => {
            let value =
              existing?.[field.key] ??
              (field.key === "owner"
                ? "Agency owner (demo)"
                : field.key === "client"
                  ? "Designmela"
                  : field.type === "number"
                    ? 0
                    : (field.options?.[0] ?? ""));
            if (field.type === "datetime-local")
              value = localInput(String(value));
            const published =
              collection === "content" &&
              field.key === "status" &&
              existing?.status === "Published";
            return (
              <label
                className={field.type === "textarea" ? "span-2" : ""}
                key={field.key}
              >
                {field.label}
                {field.required ? " *" : ""}
                {field.type === "select" ? (
                  <select
                    name={field.key}
                    defaultValue={String(value)}
                    required={field.required}
                    disabled={published}
                  >
                    {field.key === "leadId" ? (
                      <>
                        <option value="">No linked lead</option>
                        {data.leads.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.company} · {l.name}
                          </option>
                        ))}
                      </>
                    ) : (
                      <>
                        {published && <option>Published</option>}
                        {field.options?.map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                      </>
                    )}
                  </select>
                ) : field.type === "textarea" ? (
                  <textarea
                    name={field.key}
                    defaultValue={String(value)}
                    rows={3}
                  />
                ) : (
                  <input
                    name={field.key}
                    type={field.type}
                    defaultValue={String(value)}
                    required={field.required}
                    min={field.min}
                    max={field.max}
                    step={field.type === "number" ? "any" : undefined}
                    maxLength={field.type === "number" ? undefined : 4000}
                  />
                )}
              </label>
            );
          })}
        </div>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            Save {labels[collection]}
          </button>
        </div>
      </form>
    </Modal>
  );
}
