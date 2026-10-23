import { CrmAnalytics } from "@/components/crm-analytics";
export default function Page() {
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Know what moves the business.</h1>
          <p>CRM overview, sources and sales conversion.</p>
        </div>
      </div>
      <CrmAnalytics />
      <section className="card spaced">
        <h2>Website funnel</h2>
        <p>Not connected. No website events have been collected.</p>
        <p>
          Tracking integration is coming later. No visitor activity is inferred
          from CRM records.
        </p>
      </section>
    </>
  );
}
