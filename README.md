# ATO Tax Optimizer

**Australian Tax Intelligence Platform** - Deep analysis of Australian Business Taxation Laws to identify every legal avenue for tax recovery, correction, and optimization.

![Next.js](https://img.shields.io/badge/Next.js-16.1.3-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)
![Xero](https://img.shields.io/badge/Xero-OAuth%202.0-13B5EA)

## 🎯 Mission

This mission-critical tax optimization system deeply analyzes Australian Business Taxation Laws, Regulations, and Incentives to:

1. **Recover Missing Tax Benefits** - Unclaimed R&D Tax Incentive, government credits, and deductions
2. **Correct Ledger Misclassifications** - Audit Xero data for incorrectly categorized transactions
3. **Optimize Tax Position** - Carry-forward losses, shareholder loans, capital contributions
4. **Maximize Refunds** - Identify all entitled returns and offsets

## ✨ Features

### R&D Tax Incentive (Division 355)
- **43.5% refundable offset** for eligible R&D expenditure
- Automatic identification of R&D candidate transactions
- Four-element test evaluation (Unknown Outcome, Systematic Approach, New Knowledge, Scientific Method)
- Registration deadline tracking

### Tax Audit & Deduction Optimization
- Transaction categorization audit
- Missing tax type detection
- Unclaimed deduction identification
- Instant asset write-off tracking ($20,000 threshold)

### Loss Recovery & Division 7A Compliance
- Carry-forward loss position tracking
- Continuity of Ownership Test (COT) verification
- Shareholder loan compliance monitoring
- Deemed dividend risk assessment

## 🛠️ Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **Styling**: Tailwind CSS 4 with custom design system
- **Database**: Supabase (PostgreSQL)
- **Accounting**: Xero OAuth 2.0 (Read-Only)
- **Deployment**: Vercel

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Xero Developer Account
- Supabase Project

### Installation

```bash
# Clone the repository
git clone https://github.com/CleanExpo/ATO.git
cd ATO/ato-app

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local
```

### Environment Variables

Configure the following in `.env.local`:

```env
# Xero OAuth
XERO_CLIENT_ID=your_xero_client_id
XERO_CLIENT_SECRET=your_xero_client_secret

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Application
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### Database Setup

Run the schema in Supabase SQL Editor:

```bash
# Schema file location
supabase/schema.sql
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 📊 Dashboard Pages

| Page | Path | Description |
|------|------|-------------|
| Dashboard | `/dashboard` | Overview and connections |
| R&D Assessment | `/dashboard/rnd` | Division 355 eligibility |
| Tax Audit | `/dashboard/audit` | Transaction analysis |
| Loss Analysis | `/dashboard/losses` | Carry-forward and Division 7A |

## 🤖 Agent Fleet

| Agent | Role |
|-------|------|
| `tax-law-analyst` | Australian tax legislation research |
| `xero-auditor` | Xero data extraction and analysis |
| `rnd-tax-specialist` | R&D Tax Incentive assessment |
| `deduction-optimizer` | Maximize allowable deductions |
| `loss-recovery-agent` | Tax losses and shareholder loans |

## 📜 Key Tax Legislation

- **Division 355 ITAA 1997** - R&D Tax Incentive
- **Division 7A ITAA 1936** - Private Company Loans
- **Subdivision 36-A ITAA 1997** - Tax Losses
- **Section 8-1 ITAA 1997** - General Deductions
- **Subdivision 328-D ITAA 1997** - Instant Asset Write-Off

## ⚠️ Important Notes

- **Read-Only Access**: This application only reads Xero data; it never modifies your accounting records
- **Professional Advice**: All recommendations should be reviewed by a qualified tax professional
- **Legal Compliance**: Recommendations are based on current ATO legislation and guidance

## 📄 License

MIT License - See LICENSE file for details

## 🔗 Links

- [Xero Developer Portal](https://developer.xero.com/)
- [Australian Taxation Office](https://www.ato.gov.au/)
- [R&D Tax Incentive Guide](https://www.ato.gov.au/businesses-and-organisations/income-deductions-and-concessions/research-and-development-tax-incentive)
