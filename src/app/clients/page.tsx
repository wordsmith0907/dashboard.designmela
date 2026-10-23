"use client";
import { useData } from "@/components/data-context";
import { Empty } from "@/components/ui";
import { downloadCsv } from "@/lib/format";
export default function Page() {
  const { data } = useData();
  return (
    <>
      <div className="page-heading">
        <h1>Client relationships.</h1>
        <button
          className="button"
          disabled={!data?.clients.length}
          onClick={() =>
            downloadCsv(
              data!.clients.map((c) => ({ ...c })),
              "designmela-clients.csv",
            )
          }
        >
          Export clients
        </button>
      </div>
      <section className="card">
        {data?.clients.length ? (
          data.clients.map((c) => (
            <div className="workflow-row" key={c.id}>
              <div>
                <strong>
                  {c.name} · {c.company}
                </strong>
                <p>{c.notes}</p>
              </div>
              <a className="button" href={`/crm?record=${c.leadId}`}>
                Open lead
              </a>
            </div>
          ))
        ) : (
          <Empty
            title="No converted clients yet"
            text="Open a lead’s details and convert it to a client."
          />
        )}
      </section>
    </>
  );
}
