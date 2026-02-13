# BwanaBet Payroll System

Payroll management dashboard for BwanaBet Zambia. Built with **Next.js 14**, **Supabase**, **Tailwind CSS**, and **Recharts**.

Covers 87 employees across 6 active branches: Chawama, Call Center, Chipata, Kanyama 1 & 2, and Mansa UB Market.

## Features

- **Overview Dashboard** — Stat cards, Net Pay bar chart, Distribution pie chart, Statutory deductions breakdown
- **Branch Summary** — Clickable table with per-branch totals for gross, net, NAPSA, NHIMA, shortages, advances
- **Employee Payroll** — Full employee listing with search, column sorting, and branch filter chips
- **Zambian Compliance** — NAPSA 5%, NHIMA 1%, PAYE 2025 brackets calculated automatically

---

## 🚀 Deploy to Vercel (Step-by-Step)

### Step 1: Push to GitHub

```bash
# Create a new repo on github.com (e.g. bwanabet-payroll), then:
cd bwanabet-payroll
git init
git add .
git commit -m "Initial commit - BwanaBet Payroll System"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/bwanabet-payroll.git
git push -u origin main
```

### Step 2: Connect to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with your GitHub account
2. Click **"Add New Project"**
3. Select your **bwanabet-payroll** repository
4. Vercel will auto-detect it as a Next.js project — leave the defaults

### Step 3: Add Environment Variables

Before clicking "Deploy", expand **Environment Variables** and add these two:

| Variable Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://wdzwdtxeovjmwwfqgbuf.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkendkdHhlb3ZqbXd3ZnFnYnVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NTUzNDEsImV4cCI6MjA4NjUzMTM0MX0.i4skELl4xZkwmxLjmRS2FwiE_2F9ZNffmPeqGb4AI74` |

> These are safe to expose publicly — the anon key only has access allowed by your Row Level Security (RLS) policies, which are currently set to read-only for anonymous users.

### Step 4: Deploy

Click **"Deploy"**. Vercel will build and deploy in about 60 seconds. You'll get a URL like:
```
https://bwanabet-payroll.vercel.app
```

---

## 🔒 Supabase Security Notes

The current RLS setup allows **anonymous read-only access** for the dashboard. This means anyone with the URL can *view* payroll data but cannot modify anything.

When you're ready to add authentication:
1. Set up Supabase Auth (email/password login)
2. Remove the `anon_read_*` RLS policies
3. Add authenticated-only policies
4. Add a login page to the Next.js app

---

## 🛠 Local Development

```bash
# Install dependencies
npm install

# Create .env.local with your Supabase credentials
cp .env.example .env.local
# Edit .env.local with your actual keys

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
bwanabet-payroll/
├── app/
│   ├── layout.tsx          # Root layout with nav header
│   ├── globals.css         # Tailwind + custom CSS variables
│   ├── page.tsx            # Overview dashboard (server component)
│   ├── branches/
│   │   └── page.tsx        # Branch summary table
│   └── employees/
│       ├── page.tsx        # Employee list (server component)
│       └── EmployeeTable.tsx  # Interactive table (client component)
├── components/
│   ├── Nav.tsx             # Navigation header
│   ├── StatCard.tsx        # Stat card component
│   └── Charts.tsx          # Recharts visualizations
├── lib/
│   ├── supabase.ts         # Supabase client init
│   ├── data.ts             # Data fetching functions
│   └── helpers.ts          # Types, formatters, utilities
├── .env.example            # Environment variable template
├── .env.local              # Your actual credentials (git-ignored)
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── next.config.js
```

## Tech Stack

- **Next.js 14** — App Router, Server Components, ISR (revalidate every 60s)
- **Supabase** — PostgreSQL database with RLS, REST API
- **Tailwind CSS** — Dark theme with custom CSS variables
- **Recharts** — Bar charts, Pie charts for payroll visualization
- **TypeScript** — Full type safety
