"use client";
import { useState, FormEvent } from "react";
import { Lead, activityTypes } from "@/lib/domain";
import { date, money } from "@/lib/format";
import { useData } from "./data-context";
import { Badge, Modal } from "./ui";
import { FollowUpForm, FollowUps } from "./follow-ups";
export function LeadDetails({
  id,
  onClose,
  onEdit,
}: {
  id: string;
  onClose: () => void;
  onEdit: (lead: Lead) => void;
}) {
  const { data, provider, mutate, busy } = useData();
  const [action, setAction] = useState<"note" | "activity" | "followUp" | null>(
    null,
  );
  const [error, setError] = useState("");
  const lead = data?.leads.find((l) => l.id === id);
  if (!lead || !data) return null;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (
      await mutate(
        () =>
          provider.logLeadActivity(
            id,
            action === "note"
              ? "Note added"
              : (String(f.get("type")) as (typeof activityTypes)[number]),
            String(f.get("description")),
          ),
        "Activity recorded. No external communication was sent.",
      )
    )
      setAction(null);
    else setError("Enter a description and try again.");
  }
  const timeline = [
    ...data.leadActivities
      .filter((a) => a.leadId === id)
      .map((a) => ({
        id: a.id,
        title: a.type,
        description: a.description,
        at: a.createdAt,
      })),
    ...data.activities
      .filter((a) => a.leadId === id)
      .map((a) => ({
        id: a.id,
        title: `Legacy ${a.kind}`,
        description: a.description,
        at: a.createdAt,
      })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <Modal title={lead.name} onClose={onClose} wide drawer>
      <div className="detail-toolbar">
        <Badge>{lead.pipelineStage}</Badge>
        <Badge>{lead.temperature}</Badge>
        {lead.archivedAt && <Badge>Archived</Badge>}
        <button className="button small" onClick={() => onEdit(lead)}>
          Edit details
        </button>
        <button className="button small" onClick={() => setAction("note")}>
          Add note
        </button>
        <button className="button small" onClick={() => setAction("activity")}>
          Log activity
        </button>
        <button className="button small" onClick={() => setAction("followUp")}>
          Create follow-up
        </button>
      </div>
      {action === "followUp" && (
        <FollowUpForm leadId={id} onDone={() => setAction(null)} />
      )}{" "}
      {(action === "note" || action === "activity") && (
        <form className="inline-form" onSubmit={submit}>
          <h3>{action === "note" ? "Add note" : "Log a manual activity"}</h3>
          {action === "activity" && (
            <label>
              Activity type
              <select name="type">
                {activityTypes
                  .filter(
                    (t) =>
                      ![
                        "Imported",
                        "Lead created",
                        "Follow-up created",
                        "Pipeline stage changed",
                        "Lead updated",
                      ].includes(t),
                  )
                  .map((t) => (
                    <option key={t}>{t}</option>
                  ))}
              </select>
            </label>
          )}
          <label>
            Description
            <textarea name="description" required rows={3} />
          </label>
          <p className="muted">
            Logging records what you report. It does not send an email, WhatsApp
            message or make a call. Won/lost/archive entries also update lead
            status.
          </p>
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
              Save {action === "note" ? "note" : "activity"}
            </button>
          </div>
        </form>
      )}
      <dl className="detail-grid">
        {Object.entries({
          Company: lead.company,
          Email: lead.email,
          Phone: lead.phone,
          Country: lead.country,
          City: lead.city,
          "Primary source": lead.primarySource,
          "Source details": lead.sourceDetails,
          "First-touch source": lead.firstTouchSource,
          "Latest-touch source": lead.latestTouchSource,
          Campaign: lead.campaign,
          Referrer: lead.referrerName,
          "Landing page": lead.landingPageUrl,
          "Social post": lead.socialPostUrl,
          "Imported filename": lead.importedFilename,
          "UTM source": lead.utmSource,
          "UTM medium": lead.utmMedium,
          "UTM campaign": lead.utmCampaign,
          "UTM content": lead.utmContent,
          Services: lead.services.join(", "),
          Value: money(lead.estimatedValue, lead.currency),
          Consent: lead.consentStatus,
          Tags: lead.tags,
          "Lost reason": lead.lostReason,
          "Last contacted": date(
            lead.lastContactedAt,
            data.settings.timeZone,
            true,
          ),
          "Won date": date(lead.wonAt, data.settings.timeZone, true),
          Created: date(lead.createdAt, data.settings.timeZone, true),
          Updated: date(lead.updatedAt, data.settings.timeZone, true),
          Notes: lead.notes,
        }).map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v || "Not set"}</dd>
          </div>
        ))}
      </dl>
      <div className="notice">
        <strong>
          Lead score: {lead.score}/100 ·{" "}
          {lead.manualScore === null ? "Rule-based" : "Manual override"}
        </strong>
        <ul>
          {lead.scoreReasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p>No AI score. Edit the lead to record signals or adjust the score.</p>
      </div>
      <div className="tabs">
        <button
          className="button"
          disabled={busy || data.clients.some((c) => c.leadId === id)}
          onClick={() => {
            if (window.confirm("Convert this lead to a client and mark Won?"))
              void mutate(
                () => provider.convertLead(id),
                "Lead converted to client.",
              );
          }}
        >
          Convert to client
        </button>
        {lead.phone && (
          <a
            className="button"
            href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open WhatsApp
          </a>
        )}
        <a className="button" href="/clients">
          Clients
        </a>
      </div>
      <FollowUps leadId={id} compact />
      <h3>Lead timeline</h3>
      {timeline.map((a) => (
        <div className="timeline-item" key={a.id}>
          <strong>{a.title}</strong>
          <p>{a.description}</p>
          <small>{date(a.at, data.settings.timeZone, true)}</small>
        </div>
      ))}
    </Modal>
  );
}
