"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  Download,
  Search,
  LayoutGrid,
  List,
  ArrowUpRight,
  Copy,
  Trash2,
  Image as ImageIcon,
} from "lucide-react";
import {
  EditableCollection,
  RecordOf,
  Lead,
  Project,
  PublishedPost,
  stages,
  auditStatuses,
  projectStatuses,
  contentStatuses,
} from "@/lib/domain";
import { labels } from "@/lib/fields";
import {
  date,
  money,
  overdue,
  downloadCsv,
  safeUrl,
  dayKey,
} from "@/lib/format";
import { useData } from "./data-context";
import { Badge, Empty, Skeleton, Confirm, Progress } from "./ui";
import { RecordForm } from "./record-form";
import { Details } from "./details";
const meta: Record<
  EditableCollection,
  { title: string; sub: string; eyebrow: string }
> = {
  leads: {
    title: "Good relationships start here.",
    sub: "Every conversation, every opportunity. All in one place.",
    eyebrow: "YOUR PIPELINE",
  },
  audits: {
    title: "Find the opportunity.",
    sub: "Turn thoughtful reviews into clear next steps.",
    eyebrow: "AUDIT WORKSPACE",
  },
  projects: {
    title: "From possibility to progress.",
    sub: "Keep your client work moving, one milestone at a time.",
    eyebrow: "PROJECT WORKSPACE",
  },
  content: {
    title: "Make something worth sharing.",
    sub: "A clear path from the first idea to the final post.",
    eyebrow: "CONTENT STUDIO",
  },
  posted: {
    title: "Out in the world.",
    sub: "Your complete publishing history, thoughtfully organised.",
    eyebrow: "PUBLISHED CONTENT",
  },
};
export function RecordsPage({
  collection,
}: {
  collection: EditableCollection;
}) {
  const { data, provider, mutate, toast, busy } = useData();
  const params = useSearchParams();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState("newest");
  const [board, setBoard] = useState(false);
  const [form, setForm] = useState<RecordOf<EditableCollection> | "new" | null>(
    null,
  );
  const [selected, setSelected] = useState<string | null>(params.get("record"));
  const [deleted, setDeleted] = useState<Lead | null>(null);
  if (!data) return <Skeleton />;
  const timeZone = data.settings.timeZone;
  const raw = data[collection] as RecordOf<EditableCollection>[];
  const keys =
    collection === "leads"
      ? ["stage", "source", "service"]
      : collection === "audits"
        ? ["status"]
        : collection === "projects"
          ? ["status", "priority"]
          : collection === "content"
            ? ["platform", "status", "client"]
            : ["platform", "client", "campaign"];
  const rows = raw
    .filter((row) => {
      const r = row as unknown as Record<string, unknown>;
      return (
        Object.values(r).some(
          (v) =>
            typeof v === "string" &&
            v.toLowerCase().includes(query.toLowerCase()),
        ) &&
        Object.entries(filters).every(
          ([key, value]) =>
            !value ||
            (key === "date"
              ? String(
                  r[collection === "posted" ? "publishedAt" : "scheduledAt"] ??
                    "",
                ).length > 0 &&
                dayKey(
                  new Date(
                    String(
                      r[
                        collection === "posted" ? "publishedAt" : "scheduledAt"
                      ],
                    ),
                  ),
                  timeZone,
                ) === value
              : r[key] === value),
        )
      );
    })
    .sort((a, b) =>
      sort === "value"
        ? (b as Lead).value - (a as Lead).value
        : sort === "followUp"
          ? ((a as Lead).followUp || "9999").localeCompare(
              (b as Lead).followUp || "9999",
            )
          : b.createdAt.localeCompare(a.createdAt),
    );
  const choices =
    collection === "leads"
      ? stages
      : collection === "audits"
        ? auditStatuses
        : collection === "projects"
          ? projectStatuses
          : contentStatuses;
  const title = (r: RecordOf<EditableCollection>) =>
    "title" in r ? r.title : r.name;
  const status = (r: RecordOf<EditableCollection>) =>
    "stage" in r ? r.stage : "status" in r ? r.status : "Published";
  const open = (id: string) => setSelected(id);
  const clear = () => {
    setFilters({});
    setQuery("");
  };
  async function stageChange(r: RecordOf<EditableCollection>, value: string) {
    await mutate(
      () =>
        provider.save(collection, {
          ...r,
          [collection === "leads" ? "stage" : "status"]: value,
          updatedAt: new Date().toISOString(),
        } as RecordOf<EditableCollection>),
      "Stage updated.",
    );
  }
  const countMonth = data.posted.filter(
    (p) =>
      dayKey(new Date(p.publishedAt), timeZone).slice(0, 7) ===
      dayKey(new Date(), timeZone).slice(0, 7),
  ).length;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{meta[collection].eyebrow}</span>
          <h1>{meta[collection].title}</h1>
          <p>{meta[collection].sub}</p>
        </div>
        {collection !== "posted" && (
          <button className="button primary" onClick={() => setForm("new")}>
            <Plus size={17} />
            Add {labels[collection]}
          </button>
        )}
      </div>
      {collection === "leads" && (
        <div className="mini-stats">
          <div>
            <span>All leads</span>
            <strong>{data.leads.length.toString().padStart(2, "0")}</strong>
          </div>
          <div>
            <span>Open pipeline</span>
            <strong>
              {money(
                data.leads
                  .filter((l) => !["Won", "Lost"].includes(l.stage))
                  .reduce((s, l) => s + l.value, 0),
                data.settings.currency,
              )}
            </strong>
          </div>
          <div>
            <span>Follow-ups due</span>
            <strong>
              {
                data.leads.filter(
                  (l) =>
                    l.followUp &&
                    l.followUp <= dayKey(new Date(), timeZone) &&
                    !["Won", "Lost"].includes(l.stage),
                ).length
              }
            </strong>
          </div>
          <div>
            <span>Relationships won</span>
            <strong>
              {data.leads.filter((l) => l.stage === "Won").length}
            </strong>
          </div>
        </div>
      )}
      {collection === "posted" && (
        <div className="mini-stats">
          <div>
            <span>Published this month</span>
            <strong>{countMonth.toString().padStart(2, "0")}</strong>
          </div>
          <div>
            <span>All-time records</span>
            <strong>{data.posted.length}</strong>
          </div>
          <div className="platform-breakdown">
            <span>Platform breakdown · all records</span>
            {Array.from(new Set(data.posted.map((p) => p.platform))).map(
              (p) => (
                <small key={p}>
                  {p}{" "}
                  <b>{data.posted.filter((r) => r.platform === p).length}</b>
                </small>
              ),
            )}
          </div>
          <div>
            <span>Performance metrics</span>
            <strong className="smaller">Not connected</strong>
          </div>
        </div>
      )}
      {collection === "audits" && (
        <p className="notice">
          All scores and findings are fictional demo examples. No live websites
          have been audited.
        </p>
      )}
      {collection === "content" && (
        <p className="notice">
          Workflow tracking only. Scheduled items are not sent to social
          platforms. Use “Record publication” in an item’s details.
        </p>
      )}
      <section className="card records-card">
        <div className="section-heading">
          <h2>
            {collection === "leads"
              ? "Your leads"
              : collection === "posted"
                ? "Publishing history"
                : `All ${collection}`}{" "}
            <span className="count">{rows.length}</span>
          </h2>
          <div className="button-group">
            {["leads", "content"].includes(collection) && (
              <>
                <button
                  className={`icon-button ${!board ? "selected" : ""}`}
                  aria-label="List view"
                  aria-pressed={!board}
                  onClick={() => setBoard(false)}
                >
                  <List size={19} />
                </button>
                <button
                  className={`icon-button ${board ? "selected" : ""}`}
                  aria-label="Board view"
                  aria-pressed={board}
                  onClick={() => setBoard(true)}
                >
                  <LayoutGrid size={18} />
                </button>
              </>
            )}
            {["leads", "posted"].includes(collection) && (
              <button
                className="button small"
                disabled={!rows.length}
                onClick={() => {
                  downloadCsv(
                    rows.map((r) => ({ ...r })),
                    `designmela-${collection}.csv`,
                  );
                  toast("CSV prepared for download.");
                }}
              >
                <Download size={16} />
                Export CSV
              </button>
            )}
          </div>
        </div>
        <div className="filters">
          <label className="search-field">
            <Search size={16} />
            <input
              aria-label={`Search ${collection}`}
              placeholder={`Search ${collection}…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          {keys.map((key) => (
            <label key={key} className="filter-select">
              <span className="sr-only">Filter by {key}</span>
              <select
                aria-label={`Filter by ${key}`}
                value={filters[key] ?? ""}
                onChange={(e) =>
                  setFilters({ ...filters, [key]: e.target.value })
                }
              >
                <option value="">
                  All{" "}
                  {key === "priority"
                    ? "priorities"
                    : key === "status"
                      ? "statuses"
                      : `${key}s`}
                </option>
                {Array.from(
                  new Set(
                    raw.map((r) =>
                      String((r as unknown as Record<string, unknown>)[key]),
                    ),
                  ),
                )
                  .sort()
                  .map((v) => (
                    <option key={v}>{v}</option>
                  ))}
              </select>
            </label>
          ))}
          {["content", "posted"].includes(collection) && (
            <label className="date-filter">
              <span>
                {collection === "posted" ? "Published" : "Scheduled"} date
              </span>
              <input
                aria-label="Filter by date"
                type="date"
                value={filters.date ?? ""}
                onChange={(e) =>
                  setFilters({ ...filters, date: e.target.value })
                }
              />
            </label>
          )}
          {collection === "leads" && (
            <select
              aria-label="Sort leads"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="newest">Newest first</option>
              <option value="followUp">Follow-up date</option>
              <option value="value">Highest value</option>
            </select>
          )}
          {(query || Object.values(filters).some(Boolean)) && (
            <button className="text-button" onClick={clear}>
              Clear filters
            </button>
          )}
        </div>
        {!rows.length ? (
          <Empty
            title="No records found"
            text={
              raw.length
                ? "Try clearing your search or filters."
                : collection === "posted"
                  ? "Record a publication from Content to see it here."
                  : "Add your first demo record to get started."
            }
          />
        ) : board ? (
          <div className="kanban">
            {choices.map((s) => (
              <section className="kanban-column" key={s}>
                <h3>
                  {s}
                  <span>{rows.filter((r) => status(r) === s).length}</span>
                </h3>
                {rows
                  .filter((r) => status(r) === s)
                  .map((r) => (
                    <article className="kanban-card" key={r.id}>
                      <button
                        className="record-title"
                        onClick={() => open(r.id)}
                      >
                        {title(r)}
                      </button>
                      <p>
                        {"company" in r
                          ? r.company
                          : "client" in r
                            ? r.client
                            : ""}
                      </p>
                      {"value" in r && (
                        <strong>
                          {money(r.value, data.settings.currency)}
                        </strong>
                      )}
                      <label>
                        <span className="sr-only">Stage for {title(r)}</span>
                        <select
                          disabled={busy || status(r) === "Published"}
                          value={status(r)}
                          onChange={(e) => stageChange(r, e.target.value)}
                        >
                          {choices
                            .filter(
                              (c) =>
                                collection !== "content" ||
                                c !== "Published" ||
                                status(r) === "Published",
                            )
                            .map((c) => (
                              <option key={c}>{c}</option>
                            ))}
                        </select>
                      </label>
                    </article>
                  ))}
              </section>
            ))}
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>
                    {collection === "leads"
                      ? "Contact / company"
                      : collection === "posted"
                        ? "Published post"
                        : "Name / client"}
                  </th>
                  <th>{collection === "posted" ? "Platform" : "Status"}</th>
                  <th>
                    {collection === "leads"
                      ? "Service"
                      : collection === "audits"
                        ? "Demo score"
                        : collection === "projects"
                          ? "Progress"
                          : "Platform / campaign"}
                  </th>
                  <th>
                    {collection === "leads"
                      ? "Value"
                      : collection === "posted"
                        ? "Published"
                        : "Due / scheduled"}
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const v = r as unknown as Record<string, unknown>;
                  const due = String(v.dueDate ?? v.scheduledAt ?? "");
                  const late =
                    overdue(due, timeZone) &&
                    ![
                      "Completed",
                      "Closed",
                      "Sent",
                      "Converted",
                      "Published",
                      "Archived",
                    ].includes(status(r));
                  return (
                    <tr key={r.id}>
                      <td>
                        <div className="name-cell">
                          <span
                            className={`record-avatar ${collection === "posted" ? "asset-placeholder" : ""}`}
                          >
                            {collection === "posted" ? (
                              <ImageIcon size={19} />
                            ) : (
                              title(r).slice(0, 2).toUpperCase()
                            )}
                          </span>
                          <div>
                            <button
                              className="record-title"
                              onClick={() => open(r.id)}
                            >
                              {title(r)}
                            </button>
                            <small>
                              {String(
                                v.company ??
                                  v.client ??
                                  data.leads.find((l) => l.id === v.leadId)
                                    ?.company ??
                                  "No linked lead",
                              )}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <Badge>
                          {collection === "posted"
                            ? String(v.platform)
                            : status(r)}
                        </Badge>
                        {collection === "projects" && (
                          <small>{String(v.priority)} priority</small>
                        )}
                      </td>
                      <td>
                        {collection === "projects" ? (
                          <Progress value={(r as Project).progress} />
                        ) : collection === "audits" ? (
                          <span>
                            {String(v.score)}
                            <small>Fictional / 100</small>
                          </span>
                        ) : collection === "leads" ? (
                          String(v.service)
                        ) : (
                          <span>
                            {String(v.platform)}
                            <small>{String(v.campaign) || "No campaign"}</small>
                          </span>
                        )}
                      </td>
                      <td>
                        {collection === "leads" ? (
                          <>
                            <strong>
                              {money((r as Lead).value, data.settings.currency)}
                            </strong>
                            <small>
                              Follow-up {date((r as Lead).followUp, timeZone)}
                            </small>
                          </>
                        ) : (
                          <>
                            <span className={late ? "overdue" : ""}>
                              {date(
                                collection === "posted"
                                  ? String(v.publishedAt)
                                  : due,
                                timeZone,
                                collection === "posted",
                              )}
                            </span>
                            {late && <small className="overdue">Overdue</small>}
                          </>
                        )}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="button small"
                            onClick={() => open(r.id)}
                          >
                            View
                          </button>
                          {collection === "leads" && (
                            <button
                              className="icon-button"
                              aria-label={`Delete ${title(r)}`}
                              onClick={() => setDeleted(r as Lead)}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                          {collection === "posted" && (
                            <>
                              <a
                                className="icon-button"
                                aria-label={`Open ${title(r)} live URL`}
                                href={
                                  safeUrl((r as PublishedPost).liveUrl)
                                    ? (r as PublishedPost).liveUrl
                                    : undefined
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ArrowUpRight size={17} />
                              </a>
                              <button
                                className="icon-button"
                                aria-label={`Copy ${title(r)} live URL`}
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(
                                      (r as PublishedPost).liveUrl,
                                    );
                                    toast("Live URL copied.");
                                  } catch {
                                    toast(
                                      "Clipboard unavailable. Open the details to select and copy the URL.",
                                    );
                                  }
                                }}
                              >
                                <Copy size={15} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="table-footer">
          {rows.length} {rows.length === 1 ? "record" : "records"} · Fictional
          demo data<span>Changes are saved for this session</span>
        </div>
      </section>
      {form && (
        <RecordForm
          collection={collection}
          record={form === "new" ? undefined : form}
          onClose={() => setForm(null)}
        />
      )}
      {selected && !form && (
        <Details
          collection={collection}
          id={selected}
          onClose={() => setSelected(null)}
          onEdit={(r) => {
            setSelected(null);
            setForm(r);
          }}
        />
      )}
      {deleted && (
        <Confirm
          title="Delete this demo lead?"
          text={`Delete ${deleted.name} and their notes/activity? Audit and project links will be cleared; tasks and other records are retained.`}
          busy={busy}
          onClose={() => setDeleted(null)}
          onConfirm={async () => {
            if (
              await mutate(
                () => provider.deleteLead(deleted.id),
                "Demo lead deleted.",
              )
            )
              setDeleted(null);
          }}
        />
      )}
    </>
  );
}
