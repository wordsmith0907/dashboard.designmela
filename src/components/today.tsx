"use client";
import Link from "next/link";
import { useState } from "react";
import {
  Users,
  ScanSearch,
  FolderKanban,
  CalendarClock,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  CircleCheck,
  Sparkles,
} from "lucide-react";
import { useData } from "./data-context";
import { Badge, Empty, Progress, Skeleton } from "./ui";
import { date, dayKey } from "@/lib/format";
import { FollowUps } from "./follow-ups";
export function Today() {
  const { data, provider, mutate, busy } = useData();
  const [monthOffset, setMonthOffset] = useState(0);
  if (!data) return <Skeleton />;
  const today = dayKey(new Date(), data.settings.timeZone);
  const todayDate = new Date(`${today}T12:00:00Z`);
  const month = new Date(
    Date.UTC(
      todayDate.getUTCFullYear(),
      todayDate.getUTCMonth() + monthOffset,
      1,
    ),
  );
  const days = new Date(
    Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const first = (month.getUTCDay() + 6) % 7;
  const activeProjects = data.projects.filter(
    (p) => !["Completed", "On hold"].includes(p.status),
  );
  const approvals = data.content.filter((c) =>
    ["Internal review", "Client approval"].includes(c.status),
  );
  const failures = data.runs.filter((r) => r.status === "Failed");
  const tasks = data.tasks
    .filter((t) => t.dueDate <= today)
    .sort((a, b) => Number(a.done) - Number(b.done));
  const stats = [
    {
      label: "New leads",
      value: data.leads.filter((l) => l.stage === "New").length,
      icon: Users,
      href: "/crm",
      note: "Conversations to start",
      color: "lime",
    },
    {
      label: "Active audits",
      value: data.audits.filter(
        (a) => !["Closed", "Converted", "Sent"].includes(a.status),
      ).length,
      icon: ScanSearch,
      href: "/audits",
      note: "Opportunities in review",
      color: "lavender",
    },
    {
      label: "Active projects",
      value: activeProjects.length,
      icon: FolderKanban,
      href: "/projects",
      note: "Good things in motion",
      color: "peach",
    },
    {
      label: "Posts scheduled",
      value: data.content.filter((c) => c.status === "Scheduled").length,
      icon: CalendarClock,
      href: "/content",
      note: "Ready for their moment",
      color: "blue",
    },
  ];
  const activityDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(todayDate.getTime() - (6 - i) * 86400000);
    const key = d.toISOString().slice(0, 10);
    return {
      label: new Intl.DateTimeFormat("en", {
        weekday: "short",
        timeZone: "UTC",
      }).format(d),
      leads: data.leads.filter(
        (l) => dayKey(new Date(l.createdAt), data.settings.timeZone) === key,
      ).length,
      activity: data.activities.filter(
        (a) => dayKey(new Date(a.createdAt), data.settings.timeZone) === key,
      ).length,
    };
  });
  const max = Math.max(
    2,
    ...activityDays.map((d) => Math.max(d.leads, d.activity)),
  );
  return (
    <>
      <div className="page-heading today-heading">
        <div>
          <span className="eyebrow">YOUR DAILY PERSPECTIVE</span>
          <h1>
            A good day to make things happen<span className="lime-dot">.</span>
          </h1>
          <p>Here’s what’s moving at Designmela. Let’s make it a good one.</p>
        </div>
        <span className="date-chip">
          <CalendarClock size={16} />
          {date(today)}
        </span>
      </div>
      <div className="stats-grid">
        {stats.map((s) => (
          <Link href={s.href} className="stat-card" key={s.label}>
            <div className="stat-top">
              <span className={`stat-icon ${s.color}`}>
                <s.icon size={20} />
              </span>
              <ArrowUpRight size={17} />
            </div>
            <div className="stat-value">
              {String(s.value).padStart(2, "0")}
              <span>{s.label}</span>
            </div>
            <p>{s.note}</p>
          </Link>
        ))}
      </div>
      <div className="today-grid">
        <div className="today-main">
          <FollowUps compact />
          <section className="card activity-card">
            <div className="section-heading">
              <div>
                <h2>The week in motion · Demo data</h2>
                <p>A little progress, every day.</p>
              </div>
              <span className="period-pill">Last 7 days</span>
            </div>
            <div className="chart-legend">
              <span>
                <i className="legend-lime" />
                New leads
              </span>
              <span>
                <i className="legend-purple" />
                Activities
              </span>
            </div>
            <div
              className="activity-chart"
              role="img"
              aria-label={`Seven-day activity. ${activityDays.map((d) => `${d.label}: ${d.leads} leads, ${d.activity} activities`).join(". ")}`}
            >
              <div className="chart-y">
                <span>{max}</span>
                <span>{Math.round(max / 2)}</span>
                <span>0</span>
              </div>
              <div className="chart-columns">
                {activityDays.map((d, i) => (
                  <div className="chart-day" key={i}>
                    <div className="bar-pair">
                      <span
                        className="bar leads-bar"
                        style={{ height: `${(d.leads / max) * 100}%` }}
                      />
                      <span
                        className="bar activity-bar"
                        style={{ height: `${(d.activity / max) * 100}%` }}
                      />
                    </div>
                    <span>{d.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <details className="chart-data">
              <summary>View chart data</summary>
              <table>
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>New leads</th>
                    <th>Activities</th>
                  </tr>
                </thead>
                <tbody>
                  {activityDays.map((d) => (
                    <tr key={d.label}>
                      <td>{d.label}</td>
                      <td>{d.leads}</td>
                      <td>{d.activity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </section>
          <section className="card">
            <div className="section-heading">
              <div>
                <h2>
                  Today’s focus{" "}
                  <span className="count">
                    {tasks.filter((t) => !t.done).length}
                  </span>
                </h2>
                <p>Small steps. Meaningful momentum.</p>
              </div>
              <CircleCheck size={20} />
            </div>
            {tasks.length ? (
              tasks.map((t) => (
                <label
                  className={`task-row ${t.done ? "completed" : ""}`}
                  key={t.id}
                >
                  <input
                    type="checkbox"
                    checked={t.done}
                    disabled={busy}
                    onChange={() =>
                      mutate(
                        () =>
                          provider.save("tasks", {
                            ...t,
                            done: !t.done,
                            updatedAt: new Date().toISOString(),
                          }),
                        t.done ? "Task reopened." : "Task completed.",
                      )
                    }
                  />
                  <span>
                    <strong>{t.title}</strong>
                    <small>
                      {data.leads.find((l) => l.id === t.leadId)?.company ??
                        "Agency task"}{" "}
                      · {t.dueDate < today ? "Overdue" : "Today"}
                    </small>
                  </span>
                  <Badge>
                    {t.done
                      ? "Completed"
                      : t.dueDate < today
                        ? "Overdue"
                        : "To do"}
                  </Badge>
                </label>
              ))
            ) : (
              <Empty
                title="A clear day ahead"
                text="Create follow-ups from a lead or audit."
              />
            )}
          </section>
          <section className="card">
            <div className="section-heading">
              <div>
                <h2>Work in progress</h2>
                <p>Turning ideas into something real.</p>
              </div>
              <Link href="/projects" className="text-link">
                All projects <ArrowUpRight size={15} />
              </Link>
            </div>
            {activeProjects.length ? (
              activeProjects.slice(0, 4).map((p, i) => (
                <Link
                  href={`/projects?record=${p.id}`}
                  key={p.id}
                  className="project-row"
                >
                  <div className={`project-initial tone-${i}`}>
                    {p.client.slice(0, 1)}
                  </div>
                  <div className="project-info">
                    <strong>{p.name}</strong>
                    <small>
                      {p.client} · {p.service}
                    </small>
                  </div>
                  <Badge>{p.status}</Badge>
                  <Progress value={p.progress} />
                </Link>
              ))
            ) : (
              <Empty
                title="No active projects"
                text="Add a project to start tracking progress."
              />
            )}
          </section>
          <section className="card">
            <div className="section-heading">
              <h2>Recent activity</h2>
              <span className="muted">Across your workspace</span>
            </div>
            {data.activities.length ? (
              data.activities
                .slice()
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .slice(0, 4)
                .map((a) => (
                  <div className="timeline-row" key={a.id}>
                    <span className="timeline-dot" />
                    <div>
                      <p>{a.description}</p>
                      <small>
                        {date(a.createdAt, data.settings.timeZone, true)}
                      </small>
                    </div>
                  </div>
                ))
            ) : (
              <Empty
                title="Your story starts here"
                text="Add activities from a lead’s details."
              />
            )}
          </section>
        </div>
        <aside className="control-column">
          <section className="card calendar">
            <div className="section-heading">
              <h2>
                {new Intl.DateTimeFormat("en", {
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                }).format(month)}
              </h2>
              <div className="button-group">
                <button
                  className="icon-button"
                  aria-label="Previous month"
                  onClick={() => setMonthOffset(monthOffset - 1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Next month"
                  onClick={() => setMonthOffset(monthOffset + 1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
            <div className="calendar-grid">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <span className="calendar-weekday" key={`w-${i}`}>
                  {d}
                </span>
              ))}
              {Array.from({ length: first }, (_, i) => (
                <span key={`blank-${i}`} />
              ))}
              {Array.from({ length: days }, (_, i) => {
                const key = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
                return (
                  <span
                    key={i}
                    className={key === today ? "calendar-today" : ""}
                    aria-current={key === today ? "date" : undefined}
                  >
                    {i + 1}
                  </span>
                );
              })}
            </div>
            <p className="calendar-caption">
              <i />A little room to plan ahead.
            </p>
          </section>
          <section className="card attention-card">
            <div className="section-heading">
              <h2>Needs your eye</h2>
              <span className="count">
                {approvals.length + failures.length}
              </span>
            </div>
            <div className="control-label">
              <span className="dot purple-dot" />
              AWAITING APPROVAL
            </div>
            {approvals.length ? (
              approvals.map((c) => (
                <Link
                  key={c.id}
                  href={`/content?record=${c.id}`}
                  className="attention-item"
                >
                  <strong>{c.title}</strong>
                  <small>
                    {c.client} · {c.platform}
                  </small>
                  <span>
                    Review content <ArrowRight size={13} />
                  </span>
                </Link>
              ))
            ) : (
              <p className="muted">All approvals are up to date.</p>
            )}
            <div className="control-label">
              <span className="dot orange-dot" />
              AUTOMATION ALERTS
            </div>
            {failures.length ? (
              <Link className="automation-alert" href="/automations">
                <strong>{failures.length} simulated run needs attention</strong>
                <small>Demo only · no services connected</small>
                <span>
                  View run details <ArrowUpRight size={14} />
                </span>
              </Link>
            ) : (
              <p className="muted">No failed demo runs.</p>
            )}
          </section>
          <section className="card">
            <div className="section-heading">
              <h2>Freshly published</h2>
              <Link href="/posted" aria-label="View published posts">
                <ArrowUpRight size={18} />
              </Link>
            </div>
            {data.posted.length ? (
              data.posted
                .slice()
                .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
                .slice(0, 2)
                .map((p) => (
                  <Link
                    href={`/posted?record=${p.id}`}
                    key={p.id}
                    className="published-preview"
                  >
                    <div className="post-art">
                      <Sparkles size={28} />
                      <span>
                        DESIGNMELA
                        <br />
                        STUDIO JOURNAL
                      </span>
                    </div>
                    <strong>{p.title}</strong>
                    <small>
                      {p.platform} ·{" "}
                      {date(p.publishedAt, data.settings.timeZone)}
                    </small>
                  </Link>
                ))
            ) : (
              <Empty
                title="Ready when you are"
                text="Recorded publications will appear here."
              />
            )}
          </section>
          <div className="quiet-note">
            A clear workspace.
            <br />
            <strong>A little more headspace.</strong>
            <span>✳</span>
          </div>
        </aside>
      </div>
    </>
  );
}
