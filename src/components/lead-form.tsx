"use client";
import { FormEvent, useState } from "react";
import {
  Lead,
  sources,
  stages,
  temperatures,
  currencies,
  consentStatuses,
  services,
} from "@/lib/domain";
import { newLead, projectLead, validateLead } from "@/lib/crm";
import { localInput } from "@/lib/fields";
import { useData } from "./data-context";
import { Modal } from "./ui";
const textFields: [keyof Lead, string, string?][] = [
  ["name", "Contact name"],
  ["company", "Company"],
  ["email", "Email", "email"],
  ["phone", "Phone", "tel"],
  ["country", "Country"],
  ["city", "City"],
  ["sourceDetails", "Source details"],
  ["campaign", "Campaign"],
  ["referrerName", "Referrer name"],
  ["landingPageUrl", "Landing-page URL", "url"],
  ["socialPostUrl", "Social-post URL", "url"],
  ["utmSource", "UTM source"],
  ["utmMedium", "UTM medium"],
  ["utmCampaign", "UTM campaign"],
  ["utmContent", "UTM content"],
  ["estimatedValue", "Estimated project value", "number"],
  ["tags", "Tags (comma separated)"],
  ["lostReason", "Lost reason"],
  ["lastContactedAt", "Last contacted (device time zone)", "datetime-local"],
  ["nextFollowUpAt", "Next follow-up (device time zone)", "datetime-local"],
  ["wonAt", "Won date (device time zone)", "datetime-local"],
];
export function LeadForm({
  lead,
  onClose,
}: {
  lead?: Lead;
  onClose: () => void;
}) {
  const { provider, mutate, busy } = useData();
  const [draft] = useState(() => lead ?? newLead());
  const [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    let next = { ...draft };
    for (const [key, , type] of textFields) {
      const value = String(f.get(key) ?? "").trim();
      next = {
        ...next,
        [key]:
          type === "number"
            ? Number(value)
            : type === "datetime-local" && value
              ? new Date(value).toISOString()
              : value,
      };
    }
    for (const key of [
      "primarySource",
      "pipelineStage",
      "temperature",
      "currency",
      "consentStatus",
    ])
      next = { ...next, [key]: String(f.get(key)) };
    next.services = f.getAll("services").map(String);
    next.notes = String(f.get("notes") ?? "").trim();
    next.positiveReply = f.has("positiveReply");
    next.proposalRequested = f.has("proposalRequested");
    next.manualScore =
      f.get("manualScore") === "" ? null : Number(f.get("manualScore"));
    next = projectLead(next);
    const errors = validateLead(next);
    if (errors.length) {
      setError(errors.join(". "));
      return;
    }
    if (
      await mutate(
        () => provider.save("leads", next),
        lead ? "Lead updated." : "Lead created.",
      )
    )
      onClose();
    else setError("Could not save. Check your values and try again.");
  }
  return (
    <Modal title={lead ? "Edit lead" : "Add lead"} onClose={onClose} wide>
      <p className="notice">
        Fictional demo records only. Original first-touch source is preserved.
        Changes reset on reload.
      </p>
      <form onSubmit={submit}>
        <div className="form-grid">
          {textFields.map(([key, label, type = "text"]) => (
            <label key={key}>
              {label}
              {key === "name" ? " *" : ""}
              <input
                name={key}
                type={type}
                required={key === "name"}
                defaultValue={
                  type === "datetime-local"
                    ? localInput(String(draft[key]))
                    : String(draft[key])
                }
                min={type === "number" ? 0 : undefined}
                step={type === "number" ? "0.01" : undefined}
              />
            </label>
          ))}
          {(
            [
              ["primarySource", "Primary source", sources],
              ["pipelineStage", "Pipeline stage", stages],
              ["temperature", "Lead temperature", temperatures],
              ["currency", "Currency", currencies],
              ["consentStatus", "Consent status", consentStatuses],
            ] as const
          ).map(([key, label, options]) => (
            <label key={key}>
              {label}
              <select name={key} defaultValue={String(draft[key])}>
                {options.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          ))}
          <label>
            Manual score override (blank = rule score)
            <input
              name="manualScore"
              type="number"
              min="0"
              max="100"
              defaultValue={draft.manualScore ?? ""}
            />
          </label>
          <fieldset className="span-2">
            <legend>Services interested in</legend>
            <div className="badge-wrap">
              {Array.from(new Set([...services, ...draft.services])).map(
                (s) => (
                  <label className="check-label" key={s}>
                    <input
                      type="checkbox"
                      name="services"
                      value={s}
                      defaultChecked={draft.services.includes(s)}
                    />
                    {s}
                  </label>
                ),
              )}
            </div>
          </fieldset>
          <label className="check-label">
            <input
              type="checkbox"
              name="positiveReply"
              defaultChecked={draft.positiveReply}
            />
            Positive reply recorded
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              name="proposalRequested"
              defaultChecked={draft.proposalRequested}
            />
            Proposal requested
          </label>
          <label className="span-2">
            Notes
            <textarea name="notes" defaultValue={draft.notes} rows={3} />
          </label>
        </div>
        <p className="muted">
          First touch: {draft.firstTouchSource}. Current score: {draft.score}
          /100. Recalculated when saved.
        </p>
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            Save lead
          </button>
        </div>
      </form>
    </Modal>
  );
}
