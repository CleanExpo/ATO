import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter"
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
    <html lang="en" className={inter.variable}>
      <body className={inter.className} suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
