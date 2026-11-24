# SpeedOn — Multi-Tenant Vehicle Recovery Platform

SpeedOn is a scalable, multi-tenant vehicle recovery and repossession management Progressive Web App (PWA) designed for desktop admins and mobile field agents. Built with **Next.js** and **Supabase (PostgreSQL)**, it enforces strict workspace isolation across independent agencies using database-level Row Level Security (RLS).

## Key Features

- **3-Tier Role-Based Access Control (RBAC)**
  - **Super Admin:** Onboards and removes independent Admin agencies with full data cascade cleanup.
  - **Admin (Agency):** Isolated workspace to upload/delete Excel dumps, update recovery statuses, track live KPIs, and manage their own Field Agents.
  - **Field Agent:** Strictly **view-only**, mobile-first card interface restricted exclusively to their linked Admin's vehicle records.
- **High-Volume Data Handling (41,000+ Rows)**
  - Server-side pagination, configurable rows-per-page, permanent serial numbering, and direct **Jump to S.No** navigation.
  - Debounced multi-field search across **Registration Number** (including last 4 digits), **Chassis Number**, and **Customer Name**.
- **One-Click Bulk Excel / CSV Manager**
  - Client-side `.xlsx`, `.xls`, and `.csv` parsing with automatic bank header normalization and chunked batch uploads (500 rows/batch) with live progress tracking.
  - Upload history logging (filename, timestamp, uploader, row count) with one-click sheet deletion via PostgreSQL `ON DELETE CASCADE`.
- **Cross-Device PWA & Account Security**
  - Installable standalone web app for Android, iOS, Windows, and macOS.
  - Authenticated session management with self-service password updates and server-only admin provisioning APIs.

## Tech Stack

- **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS
- **Backend & Database:** Supabase (PostgreSQL, Auth, Row Level Security)
- **Utilities:** SheetJS (`xlsx`) for in-browser spreadsheet parsing
- **Deployment:** Vercel

## Environment Variables

Create a `.env.local` file in the root directory (never commit this file):

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
SUPABASE_SECRET_KEY=your_supabase_secret_key

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
