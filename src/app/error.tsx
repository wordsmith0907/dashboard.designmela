"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="card">
      <h1>Something interrupted your workspace.</h1>
      <p>Please try again. Reloading restores the demo dataset.</p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
