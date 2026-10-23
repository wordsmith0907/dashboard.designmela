"use client";
import { useData } from "@/components/data-context";
import { FollowUps, FollowUpForm } from "@/components/follow-ups";
import { useState } from "react";
export default function Page() {
  const { data, provider, mutate } = useData();
  const [id, setId] = useState("");
  return (
    <>
      <h1>Make the next step clear.</h1>
      <section className="card">
        <h2>Agency tasks</h2>
        {data?.tasks.map((t) => (
          <label key={t.id} className="task-row">
            <input
              type="checkbox"
              checked={t.done}
              onChange={() =>
                mutate(
                  () =>
                    provider.save("tasks", {
                      ...t,
                      done: !t.done,
                      updatedAt: new Date().toISOString(),
                    }),
                  "Task updated.",
                )
              }
            />
            {t.title} · {t.dueDate}
          </label>
        ))}
        <label>
          Schedule a lead follow-up
          <select value={id} onChange={(e) => setId(e.target.value)}>
            <option value="">Select lead…</option>
            {data?.leads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        {id && <FollowUpForm leadId={id} onDone={() => setId("")} />}
      </section>
      <FollowUps />
    </>
  );
}
