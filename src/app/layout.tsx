import type { Metadata } from "next";
import "./globals.css";
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: "Designmela ? Agency workspace",
  description: "Private agency workspace",
  robots: {index:false,follow:false},
};
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body><a className="skip-link" href="#main-content">Skip to main content</a>{children}</body></html>;
}
