import type { Metadata } from "next";
import { DataRoot } from "@/components/data-context";
import { Shell } from "@/components/shell";
import { applicationMode } from "@/lib/application-mode";
import "./globals.css";
// Mode is evaluated on each request, including changes made after a build.
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: "Designmela · Agency workspace",
  description: "Private agency dashboard MVP — fictional demo workspace",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let connectionError = false;
  try {
    connectionError = applicationMode(process.env.DESIGNMELA_MODE) === 'connected';
  } catch {
    connectionError = true;
  }
  return (
    <html lang="en">
      <body>
        {connectionError ? <main id="main-content" style={{maxWidth:640,margin:'80px auto',padding:24}}><h1>Connection Error</h1><p>Connected Mode is not ready. Authentication, the database provider and reviewed migrations must be configured before this workspace can open.</p><p>No demo data has been loaded. Ask the workspace administrator to complete setup or explicitly select Demo Mode.</p></main> : <>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <DataRoot>
          <Shell>{children}</Shell>
        </DataRoot>
        </>}
      </body>
    </html>
  );
}
