import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Geist } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/nav";
import { Providers } from "@/components/providers";
import { SPOILER_INIT_SCRIPT } from "@/components/spoilers";
import { getData } from "@/lib/data/load";
import { authorXHandle, site } from "@/lib/site";

// One web font only: the monospace stack is the system one (nothing on the site uses a mono face).
const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const display = Barlow_Condensed({ variable: "--font-display", subsets: ["latin"], weight: ["700"] }); // one weight: 600/800 are synthesised, saves two font files on every page

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name} | ${site.tagline}`, template: `%s | ${site.name}` },
  description: site.description,
  openGraph: { siteName: site.name, type: "website", locale: "en_US" },
  twitter: { card: "summary", creator: authorXHandle },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0c10" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { meta } = getData();
  return (
    <html lang="en" className={`dark ${geistSans.variable} ${display.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SPOILER_INIT_SCRIPT }} />
      </head>
      <body className="antialiased">
        <Providers>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-brand focus:px-3 focus:py-2 focus:text-brand-foreground"
          >
            Skip to content
          </a>
          <Header updatedAt={meta.updatedAt} />
          <main id="main" className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-8">
            {children}
          </main>
          <Footer />
          <BottomNav />
        </Providers>
        {site.analytics.cfBeaconToken ? (
          <Script
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={JSON.stringify({ token: site.analytics.cfBeaconToken })}
            strategy="afterInteractive"
          />
        ) : null}
      </body>
    </html>
  );
}
