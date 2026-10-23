"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { FollowUp } from "@/lib/domain";
import { followUpGroup } from "@/lib/crm";
import { date } from "@/lib/format";
import { useData } from "./data-context";
import { Badge, Empty } from "./ui";
export function FollowUpForm({
  leadId,
  onDone,
}: {
  leadId: string;
  onDone: () => void;
}) {
  const { provider, mutate, busy } = useData();
  const [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const now = new Date().toISOString();
    if (
      await mutate(
        () =>
          provider.createFollowUp({
            id: crypto.randomUUID(),
            createdAt: now,
            updatedAt: now,
            leadId,
            title: String(f.get("title")).trim(),
            dueAt: new Date(String(f.get("dueAt"))).toISOString(),
            type: String(f.get("type")) as FollowUp["type"],
            priority: String(f.get("priority")) as FollowUp["priority"],
            completedAt: "",
            reminderStatus: "In dashboard",
          }),
        "Follow-up created.",
      )
    )
      onDone();
    else setError("Enter a title and valid date/time.");
  }
  return (
    <form className="inline-form" onSubmit={submit}>
      <h3>Create follow-up</h3>
      <div className="form-grid">
        <label>
          Description
          <input name="title" required />
        </label>
        <label>
          Follow-up date & time (device time zone)
          <input name="dueAt" type="datetime-local" required />
        </label>
        <label>
          Follow-up type
          <select name="type">
            {["Call", "Email", "WhatsApp", "Meeting", "Other"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Priority
          <select name="priority" defaultValue="Medium">
            {["Low", "Medium", "High"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="muted">
        Reminder: In dashboard. Email, WhatsApp and external notifications: Not
        connected.
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="form-actions">
        <button type="button" className="button" onClick={onDone}>
          Cancel
        </button>
        <button className="button primary" disabled={busy}>
          Save follow-up
        </button>
      </div>
    </form>
  );
}
export function FollowUps({
  leadId,
  compact = false,
}: {
  leadId?: string;
  compact?: boolean;
}) {
  const { data, provider, mutate, busy } = useData();
  const [group, setGroup] = useState("Overdue");
  if (!data) return null;
  const rows = data.followUps.filter(
    (f) =>
      (!leadId || f.leadId === leadId) &&
      data.leads.some((l) => l.id === f.leadId && !l.archivedAt),
  );
  const groups = ["Overdue", "Today", "Upcoming", "Completed"];
  const shown = rows
    .filter((f) => followUpGroup(f, data.settings.timeZone) === group)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  return (
    <section className={compact ? "" : "card spaced"}>
      <div className="section-heading">
        <h2>Follow-up control</h2>
        <Badge>In-dashboard reminders</Badge>
      </div>
      <div className="tabs">
        {groups.map((g) => (
          <button
            key={g}
            className={`button small ${group === g ? "primary" : ""}`}
            aria-pressed={group === g}
            onClick={() => setGroup(g)}
          >
            {g} (
            {
              rows.filter((f) => followUpGroup(f, data.settings.timeZone) === g)
                .length
            }
            )
          </button>
        ))}
      </div>
      {shown.length ? (
        shown.map((f) => (
          <div className="followup-row" key={f.id}>
            <label className="check-label">
              <input
                type="checkbox"
                checked={!!f.completedAt}
                disabled={busy}
                aria-label={`Complete ${f.title}`}
                onChange={() =>
                  mutate(
                    () => provider.completeFollowUp(f.id),
                    f.completedAt
                      ? "Follow-up reopened."
                      : "Follow-up completed.",
                  )
                }
              />
              <span>
                <strong>{f.title}</strong>
                <small>
                  {date(f.dueAt, data.settings.timeZone, true)} · {f.type} ·{" "}
                  {f.reminderStatus}
                </small>
              </span>
            </label>
            <Badge>{f.priority}</Badge>
            {!leadId && (
              <Link className="text-link" href={`/crm?record=${f.leadId}`}>
                Open lead ↗
              </Link>
            )}
          </div>
        ))
      ) : (
        <Empty
          title={`No ${group.toLowerCase()} follow-ups`}
          text="Schedule a follow-up from a lead’s details."
        />
      )}
      <p className="muted">
        Email, WhatsApp and external notifications: Not connected.
      </p>
    </section>
  );
}
