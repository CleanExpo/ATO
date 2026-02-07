import type { Metadata } from "next"
import { Geist, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import { OperationProviderWrapper } from "@/components/providers/OperationProvider"
import { SkipLink } from "@/components/ui/SkipLink"

// Editorial typography - clean, modern sans-serif
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
})

// Monospace for data display - technical, precise
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL('https://atotaxoptimizer.com.au'),
  title: "ATO Tax Optimizer | AI-Powered Tax Recovery for Australian Businesses",
  description: "Forensic AI analysis of your Xero data to recover $200K-$500K in R&D tax offsets, unclaimed deductions, and Division 7A compliance gaps. Built for Australian SMEs under ITAA 1997.",
  keywords: [
    "Australian tax recovery",
    "R&D Tax Incentive Division 355",
    "Xero tax audit",
    "Australian business tax optimisation",
    "Division 7A compliance",
    "tax deduction recovery Australia",
    "ITAA 1997",
    "SME tax refund",
    "forensic tax analysis",
    "Australian tax agent software"
  ],
  authors: [{ name: "ATO Tax Optimizer" }],
  openGraph: {
    title: "ATO Tax Optimizer | AI-Powered Tax Recovery",
    description: "Forensic AI analysis of your Xero data to recover unclaimed tax benefits worth $200K-$500K for Australian businesses.",
    type: "website",
    locale: "en_AU",
    siteName: "ATO Tax Optimizer",
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'ATO Tax Optimizer - AI-Powered Forensic Tax Analysis for Australian Businesses',
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
  },
  other: {
    "geo.region": "AU",
    "geo.country": "AU",
  },
}

// Inline script to prevent flash of wrong theme on load
const themeInitScript = `
(function(){
  try {
    var t = localStorage.getItem('ato-theme');
    if (t === 'tax-time') document.documentElement.setAttribute('data-theme', 'tax-time');
  } catch(e) {}
})();
`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geist.variable} ${jetbrainsMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={geist.className} suppressHydrationWarning>
        <SkipLink />
        <OperationProviderWrapper>
          {children}
        </OperationProviderWrapper>
      </body>
    </html>
  )
}
