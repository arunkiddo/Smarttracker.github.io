# Smart Cashflow Tracker

A GitHub Pages-ready, browser-first cash flow tracker for Indian bank statements.

## Features

- Upload `.xls`, `.xlsx`, `.pdf`, `.txt`, or `.csv` statements.
- Extract account number, bank name, balances, dates, narration, debit, credit, and reference data where present.
- Store accounts, transactions, category corrections, and rules locally in IndexedDB.
- Show a dashboard with total balance, account cards, latest 5 transactions, and recurring payments.
- Analyze cash flow by account and date range with income, investment, and spend charts.
- Drill into spends by category, top spends, and month-wise history.
- Categorize obvious transactions locally and send only unclear descriptions to a configured Groq proxy.

## Local Setup

```sh
npm install
npm run dev
```

## Groq AI Proxy

Do not place a Groq API key in the frontend. Deploy `server/groq-proxy-example.ts` as a Cloudflare Worker or equivalent serverless function and store `GROQ_API_KEY` as a provider secret.

Then create a local `.env` file:

```sh
VITE_GROQ_PROXY_URL=https://your-proxy.example.workers.dev
```

The key shared during planning should be revoked and replaced before deployment.

## GitHub Pages

The Vite base path is configured for:

```txt
https://arunkiddo.github.io/Smarttracker.github.io/
```

Deploy with GitHub Actions by pushing to `main`, or run:

```sh
npm run deploy
```
