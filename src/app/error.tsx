'use client';
import Link from 'next/link';
export default function ErrorPage({reset}:{reset:()=>void}) {
  return <main className="connected-page"><h1>Workspace unavailable</h1><p>Check your connection and access, or ask the administrator to finish development setup. No demo data has been substituted.</p><button className="btn" onClick={reset}>Try again</button> <Link href="/login">Sign in</Link></main>;
}
