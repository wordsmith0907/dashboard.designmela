"use client";
import { FormEvent, useState } from "react";
import {
  EditableCollection,
  RecordOf,
  Lead,
  Audit,
  ContentItem,
  platforms,
} from "@/lib/domain";
import { fields } from "@/lib/fields";
import { date, safeUrl } from "@/lib/format";
import { useData } from "./data-context";
import { Badge, Modal } from "./ui";
import { LeadDetails } from "./lead-details";
export function Details({
  collection,
  id,
  onClose,
  onEdit,
}: {
  collection: EditableCollection;
  id: string;
  onClose: () => void;
  onEdit: (r: RecordOf<EditableCollection>) => void;
}) {
  return collection === "leads" ? (
    <LeadDetails id={id} onClose={onClose} onEdit={onEdit} />
  ) : (
    <GenericDetails
      collection={collection}
      id={id}
      onClose={onClose}
      onEdit={onEdit}
    />
  );
}
function GenericDetails({
  collection,
  id,
  onClose,
  onEdit,
}: {
  collection: EditableCollection;
  id: string;
  onClose: () => void;
  onEdit: (r: RecordOf<EditableCollection>) => void;
}) {
  const { data, provider, mutate, busy } = useData();
  const [action, setAction] = useState<
    "Note" | "Activity" | "Task" | "Publish" | null
  >(null);
  const [error, setError] = useState("");
  const record = data?.[collection].find((r) => r.id === id);
  if (!record || !data) return null;
  const values = record as unknown as Record<string, unknown>;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const f = new FormData(event.currentTarget);
    const stamp = new Date().toISOString();
    const base = {
      id: crypto.randomUUID(),
      createdAt: stamp,
      updatedAt: stamp,
    };
    let ok = false;
    if (action === "Publish") {
      ok = await mutate(
        () =>
          provider.publish(id, {
            liveUrl: String(f.get("url")).trim(),
            publishedAt: new Date(String(f.get("publishedAt"))).toISOString(),
            platform: String(f.get("platform")),
          }),
        "Publication recorded. Find it on Posted. No social platform was contacted.",
      );
    } else {
      const title = String(f.get("text") ?? "").trim();
      if (!title) {
        setError("Please enter a description.");
        return;
      }
      if (action === "Task") {
        ok = await mutate(
          () =>
            provider.save("tasks", {
              ...base,
              title,
              leadId: collection === "leads" ? id : (record as Audit).leadId,
              auditId: collection === "audits" ? id : "",
              dueDate: String(f.get("dueDate")),
              done: false,
            }),
          "Follow-up task created.",
        );
      } else {
        ok = await mutate(async () => {
          await provider.save("activities", {
            ...base,
            leadId: id,
            kind: action as "Note" | "Activity",
            description: title,
          });
          await provider.save("leads", {
            ...(record as Lead),
            lastActivity: stamp,
            updatedAt: stamp,
          });
        }, `${action} added.`);
      }
    }
    if (ok) setAction(null);
    else
      setError(
        "Could not save. Check the URL, platform and publication time (which cannot be in the future), then try again.",
      );
  }
  return (
    <Modal title={String(values.title ?? values.name)} onClose={onClose} wide>
      <div className="detail-toolbar">
        <Badge>{String(values.status ?? values.stage ?? "Published")}</Badge>
        <button className="button small" onClick={() => onEdit(record)}>
          Edit details
        </button>
        {collection === "leads" && (
          <>
            <button className="button small" onClick={() => setAction("Note")}>
              Add note
            </button>
            <button
              className="button small"
              onClick={() => setAction("Activity")}
            >
              Add activity
            </button>
          </>
        )}
        {["leads", "audits"].includes(collection) && (
          <button className="button small" onClick={() => setAction("Task")}>
            Create follow-up
          </button>
        )}
        {collection === "audits" && (record as Audit).status !== "Sent" && (
          <button
            className="button small"
            disabled={busy}
            onClick={() =>
              mutate(
                () =>
                  provider.save("audits", {
                    ...(record as Audit),
                    status: "Sent",
                    updatedAt: new Date().toISOString(),
                  }),
                "Audit marked as sent. No email was sent.",
              )
            }
          >
            Mark as sent
          </button>
        )}
        {collection === "content" &&
          (record as ContentItem).status !== "Published" &&
          !data.posted.some((p) => p.contentId === id) && (
            <button
              className="button primary small"
              onClick={() => setAction("Publish")}
            >
              Record publication
            </button>
          )}
      </div>
      {action && (
        <form className="inline-form" onSubmit={submit}>
          <h3>
            {action === "Publish"
              ? "Record a published post"
              : action === "Task"
                ? "Create follow-up task"
                : `Add ${action.toLowerCase()}`}
          </h3>
          {action === "Publish" ? (
            <>
              <p className="muted">
                This records publication only. Nothing is sent to a social
                platform.
              </p>
              <label>
                Live post URL
                <input name="url" type="url" required placeholder="https://…" />
              </label>
              <label>
                Published date & time (device time zone)
                <input name="publishedAt" type="datetime-local" required />
              </label>
              <label>
                Platform
                <select name="platform" defaultValue={String(values.platform)}>
                  {platforms.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <>
              <label>
                Description
                <textarea name="text" required rows={3} />
              </label>
              {action === "Task" && (
                <label>
                  Follow-up date
                  <input name="dueDate" type="date" required />
                </label>
              )}
            </>
          )}
          {error && <p role="alert">{error}</p>}
          <div className="form-actions">
            <button
              type="button"
              className="button"
              onClick={() => setAction(null)}
            >
              Cancel
            </button>
            <button className="button primary" disabled={busy}>
              Save {action === "Publish" ? "publication" : action.toLowerCase()}
            </button>
          </div>
        </form>
      )}
      <dl className="detail-grid">
        {fields[collection].map((f) => {
          let v = String(values[f.key] ?? "");
          if (f.key === "leadId")
            v = data.leads.find((l) => l.id === v)?.company ?? "No linked lead";
          if (f.type === "date" || f.type === "datetime-local")
            v = date(v, data.settings.timeZone, f.type === "datetime-local");
          return (
            <div key={f.key} className={f.type === "textarea" ? "span-2" : ""}>
              <dt>{f.label}</dt>
              <dd>
                {f.type === "url" && safeUrl(v) ? (
                  <a href={v} target="_blank" rel="noopener noreferrer">
                    {v} ↗
                  </a>
                ) : (
                  v || "Not set"
                )}
              </dd>
            </div>
          );
        })}
        <div>
          <dt>Created</dt>
          <dd>{date(record.createdAt, data.settings.timeZone, true)}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{date(record.updatedAt, data.settings.timeZone, true)}</dd>
        </div>
        {collection === "leads" && (
          <div>
            <dt>Last activity</dt>
            <dd>
              {date(
                (record as Lead).lastActivity,
                data.settings.timeZone,
                true,
              )}
            </dd>
          </div>
        )}
      </dl>
      {collection === "leads" && (
        <section>
          <h3>Notes & activity</h3>
          {data.activities
            .filter((a) => a.leadId === id)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map((a) => (
              <div className="timeline-item" key={a.id}>
                <strong>{a.kind}</strong>
                <p>{a.description}</p>
                <small>{date(a.createdAt, data.settings.timeZone, true)}</small>
              </div>
            ))}
          <h3>Follow-up tasks</h3>
          {data.tasks
            .filter((t) => t.leadId === id)
            .map((t) => (
              <p key={t.id}>
                {t.done ? "✓" : "○"} {t.title} · {date(t.dueDate)}
              </p>
            ))}
        </section>
      )}
      {collection === "posted" && (
        <p className="notice">
          Performance metrics are not connected. Likes, clicks, reach,
          engagement and conversions remain empty.
        </p>
      )}
    </Modal>
  );
}
