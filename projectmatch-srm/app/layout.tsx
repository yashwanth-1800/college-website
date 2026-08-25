import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: "ProjectMatch — SRM Student Team Formation",
  description: "A campus-first project and teammate discovery platform for SRM Kattankulathur students.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={inter.variable}><a href="#main-content" className="skip-link">Skip to main content</a><div id="main-content">{children}</div></body></html>;
}
