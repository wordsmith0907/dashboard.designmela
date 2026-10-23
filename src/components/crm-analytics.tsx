"use client";
import { useData } from "./data-context";
import { analytics } from "@/lib/crm";
import { money } from "@/lib/format";
import { Empty } from "./ui";
export function CrmAnalytics() {
  const { data } = useData();
  if (!data) return null;
  const a = analytics(data.leads, data.followUps);
  if (!a.total)
    return (
      <Empty
        title="No leads to measure"
        text="Add or import fictional leads to see calculated analytics."
      />
    );
  return (
    <>
      <p className="notice">
        Demo data · calculated from current non-archived records. Conversion is
        a current-stage snapshot, not historical cohort attribution. Values are
        grouped by currency.
      </p>
      <div className="mini-stats">
        <div>
          <span>Total leads</span>
          <strong>{a.total}</strong>
        </div>
        <div>
          <span>Overdue follow-ups</span>
          <strong>{a.overdue}</strong>
        </div>
        <div>
          <span>Average conversion time</span>
          <strong>
            {a.averageDays === null
              ? "Not available"
              : `${a.averageDays.toFixed(1)} days`}
          </strong>
        </div>
      </div>
      <div className="settings-grid">
        {Object.entries({
          "Leads by source": a.bySource,
          "Leads by service": a.byService,
          "Leads by stage": a.byStage,
          "Leads by temperature": a.byTemperature,
          "Monthly lead trend": a.monthly,
        }).map(([title, rows]) => (
          <section className="card" key={title}>
            <h2>{title} · Demo data</h2>
            {rows.map(([label, n]) => (
              <div className="analytics-bar" key={label}>
                <span>{label}</span>
                <progress max={Math.max(...rows.map((r) => r[1]))} value={n} />
                <strong>{n}</strong>
              </div>
            ))}
          </section>
        ))}
      </div>
      <section className="card spaced">
        <h2>Source conversions · Demo data</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Source</th>
                <th>Qualified or later</th>
                <th>Won clients</th>
                <th>Won value</th>
              </tr>
            </thead>
            <tbody>
              {a.sources.map((s) => (
                <tr key={s.source}>
                  <td>{s.source}</td>
                  <td>
                    {s.qualified}/{s.total} (
                    {Math.round((s.qualified / s.total) * 100)}%)
                  </td>
                  <td>
                    {s.won}/{s.total} ({Math.round((s.won / s.total) * 100)}%)
                  </td>
                  <td>
                    {Object.entries(s.values)
                      .map(([c, v]) => money(v, c))
                      .join(" · ") || "No wins"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
