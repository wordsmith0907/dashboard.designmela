"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Lead,
  sources,
  stages,
  temperatures,
  services,
  SavedFilter,
} from "@/lib/domain";
import { filterLeads, safeFilterPreference } from "@/lib/crm";
import { date, money, downloadCsv } from "@/lib/format";
import { BulkAction } from "@/lib/crm-operations";
import { useData } from "./data-context";
import { Badge, Confirm, Empty, Modal, Skeleton } from "./ui";
import { LeadForm } from "./lead-form";
import { LeadDetails } from "./lead-details";
import { ImportWizard, ImportHistory, DownloadTemplate } from "./lead-import";
import { CrmAnalytics } from "./crm-analytics";
import { FollowUps } from "./follow-ups";
export function CrmPage() {
  const { data, provider, mutate, busy, toast } = useData();
  const params = useSearchParams();
  const [filters, setFilters] = useState<Record<string, string>>({
    archived: "no",
    stage: params.get("stage") ?? "",
  });
  const [tab, setTab] = useState("Leads");
  const [board, setBoard] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [form, setForm] = useState<Lead | "new" | null>(null);
  const [id, setId] = useState<string | null>(params.get("record"));
  const [importing, setImporting] = useState(false);
  const [history, setHistory] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [action, setAction] = useState<BulkAction["type"]>("stage");
  const [value, setValue] = useState("New");
  const [pending, setPending] = useState<{
    ids: string[];
    action: BulkAction;
  } | null>(null);
  const [page, setPage] = useState(0);
  const [saved, setSaved] = useState<SavedFilter[]>([]);
  const [sort, setSort] = useState("newest");
  if (!data) return <Skeleton />;
  const rows = filterLeads(data.leads, filters, data.followUps).sort((a, b) =>
    sort === "value"
      ? b.estimatedValue - a.estimatedValue
      : sort === "followUp"
        ? (a.nextFollowUpAt || "9999").localeCompare(b.nextFollowUpAt || "9999")
        : b.createdAt.localeCompare(a.createdAt),
  );
  const visible = rows.slice(page * 25, (page + 1) * 25);
  const update = (key: string, v: string) => {
    setFilters({ ...filters, [key]: v });
    setPage(0);
  };
  const enumFilters = [
    ["source", "Source", sources],
    ["service", "Service", services],
    ["stage", "Stage", stages],
    ["temperature", "Temperature", temperatures],
    ["archived", "Archived status", ["no", "yes", "all"]],
    ["hasEmail", "Has email", ["yes", "no"]],
    ["hasPhone", "Has phone", ["yes", "no"]],
    ["overdue", "Has overdue follow-up", ["yes", "no"]],
  ] as const;
  function saveView() {
    const next = [
      ...saved,
      {
        id: crypto.randomUUID(),
        label: `View ${saved.length + 1}`,
        filters: safeFilterPreference(filters),
      },
    ];
    localStorage.setItem("designmela.crm.views", JSON.stringify(next));
    setSaved(next);
    toast(
      "Saved non-sensitive filters only. Search, tags, country and source details are not saved.",
    );
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">CRM 2.0 · LEADS INBOX</span>
          <h1>Good relationships start here.</h1>
          <p>Capture, qualify, follow up and convert.</p>
        </div>
        <button className="button primary" onClick={() => setForm("new")}>
          Add lead
        </button>
      </div>
      <div className="tabs">
        {["Leads", "Pipeline", "Follow-ups", "Analytics"].map((t) => (
          <button
            className={`button ${tab === t ? "primary" : ""}`}
            key={t}
            onClick={() => {
              setTab(t);
              setBoard(t === "Pipeline");
            }}
          >
            {t}
          </button>
        ))}
        <button className="button" onClick={() => setHistory(true)}>
          Imports
        </button>
      </div>
      {tab === "Analytics" ? (
        <CrmAnalytics />
      ) : tab === "Follow-ups" ? (
        <FollowUps />
      ) : (
        <>
          <div className="mini-stats">
            <div>
              <span>New leads</span>
              <strong>
                {
                  data.leads.filter(
                    (l) => !l.archivedAt && l.pipelineStage === "New",
                  ).length
                }
              </strong>
            </div>
            <div>
              <span>Qualified leads</span>
              <strong>
                {
                  data.leads.filter(
                    (l) => !l.archivedAt && l.pipelineStage === "Qualified",
                  ).length
                }
              </strong>
            </div>
            <div>
              <span>Filtered leads</span>
              <strong>{rows.length}</strong>
            </div>
            <div>
              <span>Open pipeline by currency</span>
              {Object.entries(
                data.leads
                  .filter(
                    (l) =>
                      !l.archivedAt &&
                      !["Won", "Lost"].includes(l.pipelineStage),
                  )
                  .reduce<Record<string, number>>(
                    (a, l) => ({
                      ...a,
                      [l.currency]: (a[l.currency] ?? 0) + l.estimatedValue,
                    }),
                    {},
                  ),
              ).map(([c, v]) => (
                <small key={c}>{money(v, c)}</small>
              ))}
            </div>
          </div>
          <section className="card records-card">
            <div className="section-heading">
              <h2>
                Your leads <Badge>Demo data</Badge>
              </h2>
              <div className="tabs">
                <button
                  className="button small"
                  onClick={() => setImporting(true)}
                >
                  Import Leads
                </button>
                <DownloadTemplate />
                <button
                  className="button small"
                  disabled={!rows.length}
                  onClick={() =>
                    downloadCsv(
                      rows.map((l) => ({ ...l })),
                      "designmela-leads.csv",
                    )
                  }
                >
                  Export filtered
                </button>
                <button
                  className="button small"
                  onClick={() => setBoard(!board)}
                >
                  {board ? "Table view" : "Kanban view"}
                </button>
              </div>
            </div>
            <div className="filters">
              <input
                aria-label="Search leads"
                placeholder="Search leads…"
                value={filters.query ?? ""}
                onChange={(e) => update("query", e.target.value)}
              />
              <button
                className="button small"
                onClick={() => setAdvanced(true)}
              >
                Filters
              </button>
              <button className="button small" onClick={saveView}>
                Save view
              </button>
              <button
                className="button small"
                onClick={() => {
                  try {
                    const parsed = JSON.parse(
                      localStorage.getItem("designmela.crm.views") ?? "[]",
                    );
                    if (Array.isArray(parsed))
                      setSaved(
                        parsed.map((v, i) => ({
                          id: String(i),
                          label: `View ${i + 1}`,
                          filters: safeFilterPreference(v.filters ?? {}),
                        })),
                      );
                  } catch {
                    toast("Saved views could not be loaded.");
                  }
                }}
              >
                Load saved views
              </button>
              {saved.map((v) => (
                <button
                  className="button small"
                  key={v.id}
                  onClick={() => {
                    setFilters(v.filters);
                    setPage(0);
                  }}
                >
                  {v.label}
                </button>
              ))}
              <select
                aria-label="Sort leads"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="newest">Newest</option>
                <option value="value">Estimated value</option>
                <option value="followUp">Follow-up date</option>
              </select>
              <button
                className="text-button"
                onClick={() => {
                  setFilters({ archived: "no" });
                  setPage(0);
                }}
              >
                Clear all filters
              </button>
            </div>
            {selected.length > 0 && (
              <div className="bulk-toolbar">
                <strong>{selected.length} selected</strong>
                <select
                  aria-label="Bulk action"
                  value={action}
                  onChange={(e) => {
                    setAction(e.target.value as BulkAction["type"]);
                    setValue("");
                  }}
                >
                  {[
                    "stage",
                    "tag",
                    "temperature",
                    "source",
                    "followUp",
                    "archive",
                  ].map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
                {["stage", "temperature", "source"].includes(action) ? (
                  <select
                    aria-label="Bulk value"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                  >
                    <option value="">Choose…</option>
                    {(action === "stage"
                      ? stages
                      : action === "temperature"
                        ? temperatures
                        : sources
                    ).map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                ) : (
                  action !== "archive" && (
                    <input
                      aria-label="Bulk value"
                      type={action === "followUp" ? "datetime-local" : "text"}
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                    />
                  )
                )}
                <button
                  className="button"
                  disabled={busy || (action !== "archive" && !value)}
                  onClick={() =>
                    setPending({
                      ids: selected,
                      action: { type: action, value },
                    })
                  }
                >
                  Apply to selected
                </button>
                <button
                  className="button"
                  onClick={() =>
                    downloadCsv(
                      data.leads
                        .filter((l) => selected.includes(l.id))
                        .map((l) => ({ ...l })),
                      "designmela-selected.csv",
                    )
                  }
                >
                  Export selected
                </button>
                <button className="text-button" onClick={() => setSelected([])}>
                  Clear selection
                </button>
              </div>
            )}
            {!rows.length ? (
              <Empty
                title="No matching leads"
                text="Clear filters or add a fictional lead."
              />
            ) : board ? (
              <div className="kanban">
                {stages.map((stage) => (
                  <section
                    key={stage}
                    className="kanban-column"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      const leadId = e.dataTransfer.getData("text/plain");
                      if (data.leads.some((l) => l.id === leadId))
                        setPending({
                          ids: [leadId],
                          action: { type: "stage", value: stage },
                        });
                    }}
                  >
                    <h3>
                      {stage} (
                      {rows.filter((l) => l.pipelineStage === stage).length})
                    </h3>
                    {rows
                      .filter((l) => l.pipelineStage === stage)
                      .slice(0, 50)
                      .map((l) => (
                        <article
                          className="kanban-card"
                          key={l.id}
                          draggable
                          onDragStart={(e) =>
                            e.dataTransfer.setData("text/plain", l.id)
                          }
                        >
                          <button
                            className="record-title"
                            onClick={() => setId(l.id)}
                          >
                            {l.name}
                          </button>
                          <p>
                            {l.services.join(", ")} · {l.primarySource}
                          </p>
                          <Badge>{l.temperature}</Badge>
                          <p>
                            {money(l.estimatedValue, l.currency)} ·{" "}
                            {date(l.nextFollowUpAt)}
                          </p>
                          <label>
                            Stage
                            <select
                              value={l.pipelineStage}
                              onChange={(e) =>
                                setPending({
                                  ids: [l.id],
                                  action: {
                                    type: "stage",
                                    value: e.target.value,
                                  },
                                })
                              }
                            >
                              {stages.map((s) => (
                                <option key={s}>{s}</option>
                              ))}
                            </select>
                          </label>
                        </article>
                      ))}
                  </section>
                ))}
              </div>
            ) : (
              <div className="table-scroll crm-table">
                <table>
                  <thead>
                    <tr>
                      <th>
                        <input
                          aria-label="Select visible leads"
                          type="checkbox"
                          checked={
                            !!visible.length &&
                            visible.every((l) => selected.includes(l.id))
                          }
                          onChange={(e) =>
                            setSelected(
                              e.target.checked
                                ? Array.from(
                                    new Set([
                                      ...selected,
                                      ...visible.map((l) => l.id),
                                    ]),
                                  )
                                : selected.filter(
                                    (id) => !visible.some((l) => l.id === id),
                                  ),
                            )
                          }
                        />
                      </th>
                      {[
                        "Lead / Company",
                        "Source / service",
                        "Stage",
                        "Temperature / score",
                        "Value",
                        "Next follow-up",
                        "Last activity",
                        "Actions",
                      ].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((l) => (
                      <tr key={l.id}>
                        <td>
                          <input
                            aria-label={`Select ${l.name}`}
                            type="checkbox"
                            checked={selected.includes(l.id)}
                            onChange={(e) =>
                              setSelected(
                                e.target.checked
                                  ? [...selected, l.id]
                                  : selected.filter((id) => id !== l.id),
                              )
                            }
                          />
                        </td>
                        <td>
                          <button
                            className="record-title"
                            onClick={() => setId(l.id)}
                          >
                            {l.name}
                          </button>
                          <small>{l.company}</small>
                        </td>
                        <td>
                          {l.primarySource}
                          <small>
                            {l.services.join(", ") || "No service selected"}
                          </small>
                        </td>
                        <td>
                          <Badge>{l.pipelineStage}</Badge>
                        </td>
                        <td>
                          {l.temperature}
                          <small>{l.score}/100</small>
                        </td>
                        <td>{money(l.estimatedValue, l.currency)}</td>
                        <td>
                          {date(l.nextFollowUpAt, data.settings.timeZone, true)}
                        </td>
                        <td>{date(l.lastActivity, data.settings.timeZone)}</td>
                        <td>
                          <button
                            className="button small"
                            onClick={() => setId(l.id)}
                          >
                            View
                          </button>
                          <button
                            className="button small"
                            aria-label={`Archive ${l.name}`}
                            onClick={() =>
                              setPending({
                                ids: [l.id],
                                action: { type: "archive", value: "" },
                              })
                            }
                          >
                            Archive
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="table-footer">
              {rows.length} records · Demo data
              <div className="tabs">
                <button disabled={page === 0} onClick={() => setPage(page - 1)}>
                  Previous
                </button>
                <span>Page {page + 1}</span>
                <button
                  disabled={(page + 1) * 25 >= rows.length}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </section>
        </>
      )}
      {advanced && (
        <Modal title="CRM filters" onClose={() => setAdvanced(false)} wide>
          <div className="form-grid">
            {enumFilters.map(([key, label, opts]) => (
              <label key={key}>
                {label}
                <select
                  value={filters[key] ?? ""}
                  onChange={(e) => update(key, e.target.value)}
                >
                  <option value="">Any</option>
                  {opts.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
            ))}
            {[
              "sourceDetails",
              "country",
              "tags",
              "scoreMin",
              "scoreMax",
              "valueMin",
              "valueMax",
              "createdFrom",
              "createdTo",
              "followFrom",
              "followTo",
            ].map((k) => (
              <label key={k}>
                {k.replace(/([A-Z])/g, " $1")}
                <input
                  type={
                    /From|To/.test(k)
                      ? "date"
                      : /Min|Max/.test(k)
                        ? "number"
                        : "text"
                  }
                  min={0}
                  value={filters[k] ?? ""}
                  onChange={(e) => update(k, e.target.value)}
                />
              </label>
            ))}
          </div>
          <button
            className="button primary spaced"
            onClick={() => setAdvanced(false)}
          >
            Show {rows.length} leads
          </button>
        </Modal>
      )}
      {form && (
        <LeadForm
          lead={form === "new" ? undefined : form}
          onClose={() => setForm(null)}
        />
      )}{" "}
      {id && !form && (
        <LeadDetails
          id={id}
          onClose={() => setId(null)}
          onEdit={(l) => {
            setId(null);
            setForm(l);
          }}
        />
      )}
      {importing && <ImportWizard onClose={() => setImporting(false)} />}{" "}
      {history && <ImportHistory onClose={() => setHistory(false)} />}{" "}
      {pending && (
        <Confirm
          title="Confirm lead changes"
          text={`${pending.action.type}: ${pending.action.value || "Archive"} for ${pending.ids.length} lead(s). First-touch attribution and activity history will be preserved.`}
          onClose={() => setPending(null)}
          busy={busy}
          onConfirm={async () => {
            if (
              await mutate(
                () => provider.bulkLeads(pending.ids, pending.action),
                "Lead changes saved.",
              )
            ) {
              setPending(null);
              setSelected([]);
            }
          }}
        />
      )}
    </>
  );
}
