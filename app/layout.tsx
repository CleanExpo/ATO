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
  title: "ATO Tax Optimizer | Australian Tax Intelligence",
  description: "Deep analysis of Australian Business Taxation Laws to identify every legal avenue for tax recovery, correction, and optimization.",
  keywords: ["Australian Tax", "R&D Tax Incentive", "Tax Optimization", "Xero Integration", "Division 355"],
  authors: [{ name: "ATO Agent Suite" }],
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
