import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "ClaimGuard AI — OPD Claim Adjudication",
  description:
    "AI-powered OPD insurance claim adjudication tool. Automate approval/rejection decisions with intelligent document processing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {/* Animated Background */}
        <div className="animated-bg" />

        {/* Navigation */}
        <nav className="sticky top-0 z-50 glass-card border-t-0 border-l-0 border-r-0 rounded-none px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-shadow">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                  />
                </svg>
              </div>
              <div>
                <span className="text-lg font-bold gradient-text">
                  ClaimGuard AI
                </span>
                <span className="hidden sm:inline text-xs text-slate-500 ml-2">
                  OPD Adjudication
                </span>
              </div>
            </Link>

            <div className="flex items-center gap-1">
              <Link
                href="/"
                className="px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
              >
                Dashboard
              </Link>
              <Link
                href="/claims/new"
                className="px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
              >
                New Claim
              </Link>
              <Link
                href="/claims"
                className="px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
              >
                All Claims
              </Link>
              <Link
                href="/test-cases"
                className="px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
              >
                Test Cases
              </Link>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1">{children}</main>

        {/* Footer */}
        <footer className="border-t border-white/5 px-6 py-4 text-center text-xs text-slate-600">
          <p>
            Built for Plum — AI Automation Engineer Intern Assignment • Powered
            by Gemini AI
          </p>
        </footer>
      </body>
    </html>
  );
}
