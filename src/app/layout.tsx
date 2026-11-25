import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LeadScout UK | Lead Research & Outreach Assistant',
  description: 'AI-assisted lead discovery and outreach for UK freelance web developers and agencies.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-GB">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-sm">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-base sm:text-lg shadow-sm shrink-0">
                LS
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="font-bold text-base sm:text-lg tracking-tight text-slate-900 truncate">LeadScout</span>
                  <span className="text-[10px] sm:text-xs font-semibold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">UK</span>
                </div>
                <p className="hidden sm:block text-xs text-slate-500 truncate">Web Design &amp; Automation Prospecting</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 text-xs text-slate-600 shrink-0">
              <a
                href="/settings"
                className="font-semibold text-slate-700 hover:text-indigo-600 transition px-2.5 py-1.5 rounded-md hover:bg-slate-100"
              >
                Settings
              </a>
              <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                UK Market (GBP • Europe/London)
              </span>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
          {children}
        </main>
      </body>
    </html>
  );
}

