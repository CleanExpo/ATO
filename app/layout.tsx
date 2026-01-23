import type { Metadata } from "next"
import { Geist, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import { OperationProviderWrapper } from "@/components/providers/OperationProvider"

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geist.variable} ${jetbrainsMono.variable}`}>
      <body className={geist.className} suppressHydrationWarning>
        <OperationProviderWrapper>
          {children}
        </OperationProviderWrapper>
      </body>
    </html>
  )
}
