import Link from "next/link";
export default function NotFound() {
  return (
    <section className="card">
      <h1>This page is not in your workspace.</h1>
      <Link className="button primary" href="/">
        Back to Today
      </Link>
    </section>
  );
}
