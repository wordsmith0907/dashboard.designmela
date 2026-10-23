"use client";
import { useState } from "react";
import { Workflow, ArrowUpRight } from "lucide-react";
import { useData } from "./data-context";
import { Badge, Empty, Modal, Skeleton } from "./ui";
import { date, safeUrl } from "@/lib/format";
export function Automations() {
  const { data } = useData();
  const [id, setId] = useState<string | null>(null);
  if (!data) return <Skeleton />;
  const run = data.runs.find((r) => r.id === id);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">THE QUIET ENGINE</span>
          <h1>Keep an eye on the flow.</h1>
          <p>A home for your future automations.</p>
        </div>
        <Badge>Not connected</Badge>
      </div>
      <p className="notice">
        All workflows, counts and runs below are simulated demo records. n8n is
        not connected.
      </p>
      <div className="mini-stats">
        <div>
          <span>Demo workflows</span>
          <strong>{data.workflows.length}</strong>
        </div>
        <div>
          <span>Simulated successes</span>
          <strong>{data.workflows.reduce((s, w) => s + w.successes, 0)}</strong>
        </div>
        <div>
          <span>Simulated failures</span>
          <strong>{data.workflows.reduce((s, w) => s + w.failures, 0)}</strong>
        </div>
        <div>
          <span>Live integrations</span>
          <strong>0</strong>
        </div>
      </div>
      <section className="card">
        <div className="section-heading">
          <h2>Your workflows</h2>
          <Workflow size={20} />
        </div>
        {data.workflows.length ? (
          data.workflows.map((w) => (
            <div className="workflow-row" key={w.id}>
              <div>
                <strong>{w.name}</strong>
                <p>
                  {w.category} · {w.status}
                </p>
                <small>
                  Last run {date(w.lastRun, data.settings.timeZone, true)} ·
                  Next run{" "}
                  {w.nextRun
                    ? date(w.nextRun, data.settings.timeZone, true)
                    : "Not scheduled"}
                </small>
                {w.lastError && <p className="error-text">{w.lastError}</p>}
                <small>
                  Successes: {w.successes} · Failures: {w.failures} · n8n ID:{" "}
                  {w.n8nId || "Not configured"}
                </small>
              </div>
              {safeUrl(w.workflowUrl) ? (
                <a
                  className="button"
                  href={w.workflowUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open workflow <ArrowUpRight size={16} />
                </a>
              ) : (
                <button className="button" disabled>
                  n8n · Not connected
                </button>
              )}
            </div>
          ))
        ) : (
          <Empty />
        )}
      </section>
      <section className="card spaced">
        <div className="section-heading">
          <h2>Recent run history</h2>
          <span className="muted">Simulated</span>
        </div>
        {data.runs.length ? (
          data.runs.map((r) => (
            <button className="run-row" key={r.id} onClick={() => setId(r.id)}>
              <span>
                <strong>
                  {data.workflows.find((w) => w.id === r.workflowId)?.name}
                </strong>
                <small>{date(r.startedAt, data.settings.timeZone, true)}</small>
              </span>
              <Badge>{r.status}</Badge>
              <ArrowUpRight size={17} />
            </button>
          ))
        ) : (
          <Empty />
        )}
      </section>
      {run && (
        <Modal title="Simulated run details" onClose={() => setId(null)}>
          <Badge>{run.status}</Badge>
          <dl className="detail-grid">
            <div>
              <dt>Run ID</dt>
              <dd>{run.id}</dd>
            </div>
            <div>
              <dt>Workflow</dt>
              <dd>
                {data.workflows.find((w) => w.id === run.workflowId)?.name}
              </dd>
            </div>
            <div>
              <dt>Started</dt>
              <dd>{date(run.startedAt, data.settings.timeZone, true)}</dd>
            </div>
            <div className="span-2">
              <dt>Error</dt>
              <dd>{run.error || "No error recorded."}</dd>
            </div>
          </dl>
          <button className="button" disabled>
            Retry · Not connected
          </button>
          <p className="muted">
            Retries will be available after a secure n8n integration is
            implemented.
          </p>
        </Modal>
      )}
    </>
  );
}
