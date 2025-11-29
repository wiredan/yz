# Wiredan - Marketplace Starter

Minimal starter to run a food-crop marketplace with Paystack escrow, D1, KV, OAuth placeholders and Gemini KYC placeholders.

## Quick notes

- Frontend: React (no heavy libs) — intended for Cloudflare Pages.
- Backend: Cloudflare Worker under `worker/index.js`.
- DB: Cloudflare D1 with schema in `db/schema.sql`.
- KV: used for caches, sessions.
- Paystack escrow: init, webhook verify, escrow ledger, release/refund flow.
- KYC: placeholder integration with Gemini AI (implement vendor specifics).
- OAuth: placeholders for Google, Microsoft, Apple.

## Setup

1. Copy `.env.example` to `.env` and fill values.
2. `npm install`
3. Build frontend (if you want pre-built): `npm run build`
4. Deploy Cloudflare Worker using `wrangler publish` (configure account_id in `wrangler.toml`).