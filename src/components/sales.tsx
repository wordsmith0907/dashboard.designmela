"use client";
import { FormEvent, useState } from "react";
import { useData } from "./data-context";
import { Modal, Empty, Badge } from "./ui";
import { Quote, QuoteItem, quoteTotals } from "@/lib/business";
import { Database } from "@/lib/domain";
import { money, downloadCsv } from "@/lib/format";
type Kind = "quotes" | "proposals" | "payments" | "services";
const config: Record<Kind, [string, string, string?][]> = {
  quotes: [
    ["title", "Quote title"],
    ["leadId", "Related lead", "lead"],
    ["currency", "Currency", "currency"],
    ["discount", "Discount amount", "number"],
    ["tax", "Tax percentage (enter explicitly)", "number"],
    ["validUntil", "Valid until", "date"],
    ["notes", "Notes", "textarea"],
    ["status", "Status", "Draft,Sent,Accepted,Rejected,Expired"],
  ],
  proposals: [
    ["title", "Proposal title"],
    ["leadId", "Related lead", "lead"],
    ["quoteId", "Related quote ID"],
    ["scope", "Scope", "textarea"],
    ["deliverables", "Deliverables", "textarea"],
    ["timeline", "Timeline"],
    ["revisions", "Revisions"],
    ["price", "Price", "number"],
    ["currency", "Currency", "currency"],
    ["validUntil", "Valid until", "date"],
    ["status", "Status", "Draft,Sent,Accepted,Rejected"],
    ["sentAt", "Sent date", "date"],
    ["decisionAt", "Accepted/rejected date", "date"],
    ["followUpAt", "Follow-up date", "date"],
  ],
  payments: [
    ["title", "Payment description"],
    ["leadId", "Related lead", "lead"],
    ["amount", "Amount", "number"],
    ["currency", "Currency", "currency"],
    ["dueDate", "Due date", "date"],
    ["status", "Status", "Due,Paid,Overdue"],
    ["notes", "Notes", "textarea"],
  ],
  services: [
    ["name", "Service name"],
    ["description", "Description", "textarea"],
    ["basePrice", "Base price", "number"],
    ["unit", "Unit"],
    ["duration", "Estimated duration"],
  ],
};
export function Sales() {
  const { data, provider, mutate, busy } = useData();
  const [kind, setKind] = useState<Kind>("quotes");
  const [edit, setEdit] = useState<Record<string, unknown> | null>(null);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [error, setError] = useState("");
  const [print, setPrint] = useState<Quote | null>(null);
  if (!data) return null;
  const rows = data[kind];
  function open(r?: object) {
    setEdit(
      r
        ? { ...r }
        : {
            currency: data!.settings.currency,
            discount: 0,
            tax: 0,
            active: true,
          },
    );
    setItems(
      r && "items" in r
        ? (r as Quote).items
        : [{ description: "", quantity: 1, price: 0 }],
    );
    setError("");
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const now = new Date().toISOString();
    const record: Record<string, unknown> = {
      ...edit,
      id: edit?.id ?? crypto.randomUUID(),
      createdAt: edit?.createdAt ?? now,
      updatedAt: now,
    };
    for (const [key, , type] of config[kind])
      record[key] =
        type === "number"
          ? Number(f.get(key))
          : String(f.get(key) ?? "").trim();
    if (!String(record.title ?? record.name).trim()) {
      setError("A title or name is required.");
      return;
    }
    if (kind === "quotes") {
      record.items = items;
      try {
        quoteTotals(record as unknown as Quote);
      } catch (err) {
        setError((err as Error).message);
        return;
      }
    }
    if (kind === "proposals") record.projectId = record.projectId ?? "";
    if (kind === "services") record.active = f.has("active");
    if (
      await mutate(
        () => provider.save(kind, record as unknown as Database[Kind][number]),
        "Record saved in Demo Mode.",
      )
    )
      setEdit(null);
    else setError("Unable to save this record.");
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">SALES WORKSPACE</span>
          <h1>From conversation to commitment.</h1>
          <p>Manual tracking · no invoices sent or payments collected.</p>
        </div>
        <button className="button primary" onClick={() => open()}>
          Add {kind.slice(0, -1)}
        </button>
      </div>
      <div className="tabs">
        {(["quotes", "proposals", "payments", "services"] as Kind[]).map(
          (k) => (
            <button
              className={`button ${kind === k ? "primary" : ""}`}
              key={k}
              onClick={() => setKind(k)}
            >
              {k}
            </button>
          ),
        )}
        <button
          className="button"
          disabled={!rows.length}
          onClick={() =>
            downloadCsv(
              rows.map((r) => ({ ...r })),
              `designmela-${kind}.csv`,
            )
          }
        >
          Export CSV
        </button>
      </div>
      <section className="card">
        {rows.length ? (
          rows.map((r) => (
            <div className="workflow-row" key={r.id}>
              <div>
                <strong>{"title" in r ? r.title : r.name}</strong>
                <p>
                  {"status" in r ? (
                    <Badge>{r.status}</Badge>
                  ) : "active" in r ? (
                    r.active ? (
                      "Active"
                    ) : (
                      "Inactive"
                    )
                  ) : (
                    ""
                  )}
                </p>
                {"items" in r && (
                  <span>{money(quoteTotals(r).total, r.currency)}</span>
                )}
              </div>
              <div className="tabs">
                <button className="button small" onClick={() => open(r)}>
                  Edit
                </button>
                {"items" in r && (
                  <button className="button small" onClick={() => setPrint(r)}>
                    Print / PDF
                  </button>
                )}
                {"projectId" in r && (
                  <button
                    className="button small"
                    disabled={busy || r.status !== "Accepted" || !!r.projectId}
                    onClick={() =>
                      mutate(
                        () => provider.convertProposal(r.id),
                        "Project created from accepted proposal.",
                      )
                    }
                  >
                    {r.projectId ? "Project created" : "Convert to project"}
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <Empty
            title={`No ${kind} yet`}
            text="Add a fictional record to begin."
          />
        )}
      </section>
      {edit && (
        <Modal
          title={`Edit ${kind.slice(0, -1)}`}
          onClose={() => setEdit(null)}
          wide
        >
          <form onSubmit={save}>
            <div className="form-grid">
              {config[kind].map(([key, label, type = "text"]) => (
                <label key={key}>
                  {label}
                  {type === "lead" ? (
                    <select name={key} defaultValue={String(edit[key] ?? "")}>
                      <option value="">No related lead</option>
                      {data.leads.map((l) => (
                        <option value={l.id} key={l.id}>
                          {l.name} · {l.company}
                        </option>
                      ))}
                    </select>
                  ) : type === "currency" || type.includes(",") ? (
                    <select
                      name={key}
                      defaultValue={String(
                        edit[key] ??
                          (type === "currency" ? "INR" : type.split(",")[0]),
                      )}
                    >
                      {(type === "currency"
                        ? ["INR", "USD", "GBP", "EUR", "AED"]
                        : type.split(",")
                      ).map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  ) : type === "textarea" ? (
                    <textarea
                      name={key}
                      defaultValue={String(edit[key] ?? "")}
                      rows={3}
                    />
                  ) : (
                    <input
                      name={key}
                      type={type}
                      min={type === "number" ? 0 : undefined}
                      step={type === "number" ? "0.01" : undefined}
                      defaultValue={String(edit[key] ?? "")}
                    />
                  )}
                </label>
              ))}
            </div>
            {kind === "quotes" && (
              <>
                <h3>Line items</h3>
                <label>
                  Add from catalogue
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const service = data.services.find(
                        (s) => s.id === e.target.value,
                      );
                      if (service)
                        setItems([
                          ...items,
                          {
                            description: service.name,
                            quantity: 1,
                            price: service.basePrice,
                          },
                        ]);
                      e.target.value = "";
                    }}
                  >
                    <option value="">Choose a service…</option>
                    {data.services
                      .filter((s) => s.active)
                      .map((s) => (
                        <option value={s.id} key={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </label>
                {items.map((item, i) => (
                  <div className="form-grid spaced" key={i}>
                    <label>
                      Item {i + 1}
                      <input
                        required
                        value={item.description}
                        onChange={(e) =>
                          setItems(
                            items.map((r, j) =>
                              j === i
                                ? { ...r, description: e.target.value }
                                : r,
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      Quantity
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) =>
                          setItems(
                            items.map((r, j) =>
                              j === i
                                ? { ...r, quantity: Number(e.target.value) }
                                : r,
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      Unit price
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.price}
                        onChange={(e) =>
                          setItems(
                            items.map((r, j) =>
                              j === i
                                ? { ...r, price: Number(e.target.value) }
                                : r,
                            ),
                          )
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="button"
                      onClick={() => setItems(items.filter((_, j) => j !== i))}
                    >
                      Remove item
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="button spaced"
                  onClick={() =>
                    setItems([
                      ...items,
                      { description: "", quantity: 1, price: 0 },
                    ])
                  }
                >
                  Add custom item
                </button>
              </>
            )}
            {kind === "services" && (
              <label className="check-label">
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={Boolean(edit.active)}
                />
                Active
              </label>
            )}
            <p className="muted">
              Tax and discount are user-entered. No legal/tax assumptions or
              delivery actions are applied.
            </p>
            {error && <p role="alert">{error}</p>}
            <button
              className="button primary spaced"
              disabled={busy || (kind === "quotes" && !items.length)}
            >
              Save record
            </button>
          </form>
        </Modal>
      )}
      {print && (
        <Modal title={print.title} onClose={() => setPrint(null)} wide>
          <div className="print-quote">
            <h2>Designmela · Quote</h2>
            <p>
              {data.leads.find((l) => l.id === print.leadId)?.company} · Valid
              until {print.validUntil || "Not set"}
            </p>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Quantity</th>
                  <th>Unit price</th>
                </tr>
              </thead>
              <tbody>
                {print.items.map((i, n) => (
                  <tr key={n}>
                    <td>{i.description}</td>
                    <td>{i.quantity}</td>
                    <td>{money(i.price, print.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              Discount {money(print.discount, print.currency)} · Tax {print.tax}
              %
            </p>
            <h3>Total {money(quoteTotals(print).total, print.currency)}</h3>
            <p>{print.notes}</p>
          </div>
          <button className="button primary" onClick={() => window.print()}>
            Print / Save as PDF
          </button>
        </Modal>
      )}
    </>
  );
}
