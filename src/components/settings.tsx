"use client";
import { FormEvent, useState } from "react";
import { Plug, RotateCcw } from "lucide-react";
import { useData } from "./data-context";
import { Badge, Confirm, Skeleton } from "./ui";
import { platforms, stages, Settings as SettingsType } from "@/lib/domain";
export function Settings() {
  const { data, provider, mutate, busy } = useData();
  const [reset, setReset] = useState(false);
  if (!data) return <Skeleton />;
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await mutate(
      () =>
        provider.saveSettings(Object.fromEntries(f) as unknown as SettingsType),
      "Workspace settings updated for this session.",
    );
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">MAKE ROOM FOR YOUR WAY</span>
          <h1>Your workspace, considered.</h1>
          <p>The essentials for running Designmela.</p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="card">
          <div className="section-heading">
            <h2>Agency & profile</h2>
            <Badge>Demo</Badge>
          </div>
          <form
            onSubmit={save}
            key={`${data.settings.agency}-${data.settings.currency}-${data.settings.appearance}`}
          >
            <div className="form-grid">
              <label>
                Agency name
                <input
                  name="agency"
                  defaultValue={data.settings.agency}
                  required
                />
              </label>
              <label>
                Your name
                <input name="user" defaultValue={data.settings.user} required />
              </label>
              <label className="span-2">
                Email
                <input
                  type="email"
                  name="email"
                  defaultValue={data.settings.email}
                  required
                />
              </label>
              <label>
                Default currency
                <select name="currency" defaultValue={data.settings.currency}>
                  {["INR", "USD", "EUR", "GBP"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                Time zone
                <select name="timeZone" defaultValue={data.settings.timeZone}>
                  {[
                    "Asia/Kolkata",
                    "UTC",
                    "America/New_York",
                    "Europe/London",
                    "Asia/Dubai",
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                Appearance
                <select
                  name="appearance"
                  defaultValue={data.settings.appearance}
                >
                  <option>Comfortable</option>
                  <option>Compact</option>
                </select>
              </label>
            </div>
            <p className="muted">
              Fictional information only. Settings last for this browser
              session. Date/time inputs use your device time zone; displayed
              timestamps use the selected workspace time zone.
            </p>
            <button className="button primary" disabled={busy}>
              Save settings
            </button>
          </form>
        </section>
        <section className="card">
          <div className="section-heading">
            <h2>Workflow defaults</h2>
          </div>
          <h3>Content platforms</h3>
          <div className="badge-wrap">
            {platforms.map((p) => (
              <Badge key={p}>{p}</Badge>
            ))}
          </div>
          <h3>Pipeline stages</h3>
          <div className="badge-wrap">
            {stages.map((s) => (
              <Badge key={s}>{s}</Badge>
            ))}
          </div>
          <p className="muted">
            Custom platform and pipeline editing: Coming later. Defaults are
            centrally defined in the code.
          </p>
        </section>
      </div>
      <section className="card spaced">
        <div className="section-heading">
          <div>
            <h2>Integrations</h2>
            <p>A foundation for what comes next.</p>
          </div>
          <Plug size={20} />
        </div>
        <div className="integration-grid">
          {[
            "Supabase",
            "n8n",
            "Vercel",
            "Website forms",
            "Email",
            "Social publishing",
          ].map((s) => (
            <div className="integration-card" key={s}>
              <strong>{s}</strong>
              <Badge>Not connected</Badge>
            </div>
          ))}
        </div>
      </section>
      <section className="card spaced reset-card">
        <div><h2>Backup reminder</h2><p>No backups exist for this demo. Export important records before reloading. Future database backups require a separate secure export and restore-tested procedure.</p></div>
        <div>
          <h2>A fresh start</h2>
          <p>
            Reset all session records and settings to the fictional demo
            dataset.
          </p>
        </div>
        <button className="button" onClick={() => setReset(true)}>
          <RotateCcw size={16} />
          Reset demo data
        </button>
      </section>
      {reset && (
        <Confirm
          title="Reset all demo data?"
          text="All changes made in this session will be discarded and replaced with fictional examples. This cannot be undone."
          busy={busy}
          onClose={() => setReset(false)}
          onConfirm={async () => {
            if (await mutate(() => provider.reset(), "Demo data reset."))
              setReset(false);
          }}
        />
      )}
    </>
  );
}
