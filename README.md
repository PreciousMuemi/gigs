# iKokazi — USSD Offline Job Marketplace

USSD-first marketplace for local jobs and services, built for feature phones and low-connectivity environments.

Dial flow focus:

- Job discovery and bidding through USSD
- Escrow-protected payments
- Work submission and client verification
- Release/dispute path with SMS notifications

Shortcode used in this project: *789*5657#

---

## What this project solves

Many workers and clients operate without always-on internet, app installs, or smartphones. iKokazi enables:

- Clients to post jobs and hire through USSD
- Freelancers to find open jobs and place bids
- Both sides to use escrow for trust and safer payments
- Clients to verify finished work before release of funds

---

## Core features

- USSD state machine with multi-step session handling
- Registration for both client and freelancer roles
- Job posting and open job listing
- Freelancer bidding/application flow
- Contract lifecycle tracking:
  - awaiting escrow
  - in progress
  - work submitted
  - released/disputed
- Checklist-based work confirmation before release
- SMS notifications for key events
- Ratings flow after work completion
- PostgreSQL persistence (Supabase compatible)

---

## Tech stack

- Node.js (CommonJS)
- Express
- PostgreSQL (`pg`)
- Africa's Talking integration (USSD + SMS + M-Pesa webhook handling)
- ngrok for public callback tunneling in local development

---

## Project structure

```text
src/
  app.js                     # Main Express app (full routes)
  index.js                   # Full app entrypoint
  ussdServer.js              # Minimal USSD-focused server
  ussdServerIndex.js         # Minimal server entrypoint
  config/env.js              # Environment loading and defaults
  db/schema.sql              # Database schema
  repositories/              # Data access layer
  routes/                    # USSD, webhooks, and API routes
  services/                  # Business logic (USSD, escrow, notifications, etc.)
  scripts/                   # Test and utility scripts
  public/index.html          # Landing page
```

---

## USSD menu (current)

1. Register as Freelancer
2. Register as Client
3. Post a Job (get bids)
4. Find Work / Freelancer
5. Rate a Freelancer
6. Track Job & Payment
7. Confirm Finished Work
8. View Open Jobs & Bid
9. Exit

Notes:

- Route supports both `POST /ussd` and `POST /ussd/callback`
- Responses follow USSD protocol (`CON` for continue, `END` for terminate)

---

## Environment variables

Copy `.env.example` to `.env` and provide values.

Required/important variables:

- `PORT` (default 3000)
- `DATABASE_URL`
- `AT_USERNAME`
- `AT_API_KEY`
- `AT_PRODUCT_NAME`
- `AT_SMS_SENDER_ID` (optional but recommended)
- `PAYMENT_CALLBACK_URL`
- `SMS_DELIVERY_CALLBACK_URL`
- `PLATFORM_CURRENCY` (default KES)
- `ESCROW_FEE_PERCENT` (default 5)

Supabase note:

- Prefer Session Pooler host (IPv4-friendly) instead of direct DB hostname where network restrictions exist.

---

## Setup and run

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment

```bash
copy .env.example .env
```

Then fill the `.env` values.

### 3) Initialize database schema

```bash
npm run db:init
```

### 4) Start server

Use full app:

```bash
npm run dev
```

Or USSD-focused minimal server:

```bash
npm run dev:ussd
```

Local URLs:

- http://localhost:3000/
- http://localhost:3000/health

---

## ngrok (local callback testing)

Start tunnel:

```bash
ngrok http 3000
```

Use the generated HTTPS URL as callback base in Africa's Talking.

Set callbacks to:

- USSD: `https://<ngrok-url>/ussd` (or `/ussd/callback`)
- Payment webhook: `https://<ngrok-url>/webhooks/payments`
- SMS delivery webhook: `https://<ngrok-url>/webhooks/sms`

---

## Scripts

Development:

- `npm run dev` — full app with nodemon
- `npm run dev:ussd` — minimal USSD server with nodemon

Database:

- `npm run db:init` — create schema
- `npm run db:verify` — verify DB tables
- `npm run db:probe` — Supabase pooler connectivity check

Testing and demos:

- `npm run test:ussd` — base USSD flow test
- `npm run test:ussd:market` — full market-readiness USSD simulation
- `npm run test:live` — live route smoke checks
- `npm run test:sms` — SMS examples
- `npm run test:escrow` — escrow workflow demo
- `npm run test:ratings` — ratings workflow demo
- `npm run seed:demo` — seed demo users/jobs/bids/contracts

---

## API and webhook reference

Health:

- `GET /health`

USSD:

- `POST /ussd`
- `POST /ussd/callback`

Webhooks:

- `POST /webhooks/payments`
- `POST /webhooks/sms`

App APIs:

- `GET /api/jobs/open`
- `GET /api/jobs/:jobId/applications`
- `POST /api/jobs/:jobId/accept`
- `POST /api/contracts/:contractId/complete`
- `POST /api/contracts/:contractId/confirm`
- `POST /api/contracts/:contractId/rate`

Quick stats:

- `GET /api/stats`

---

## Demo data seeding

Run:

```bash
npm run seed:demo
```

This seeds:

- Clients and freelancers
- Skills
- Open jobs
- Job applications (bids)
- Demo contracts in useful statuses (released / work_submitted)

Useful for instantly testing:

- Option 8 (view jobs and bid)
- Option 6 (track payment/status)
- Option 7 (confirm finished work and release)

---

## End-to-end lifecycle (business story)

1. Client posts a job via USSD
2. Freelancers discover and bid
3. Client gets bid notifications (SMS)
4. Client accepts bid and funds escrow
5. Freelancer performs task
6. Freelancer marks work submitted
7. Client confirms checklist
8. Funds are released (or dispute path is triggered)

---

## Troubleshooting

### 404 on `/ussd`

Ensure callback points to `/ussd` or `/ussd/callback` and server is running.

### `EADDRINUSE: 3000`

Port 3000 is occupied. Stop the process using it, then restart server.

### DB init/connectivity issues

- Verify `DATABASE_URL`
- Use Supabase session pooler endpoint
- Confirm firewall/network allows outbound DB connection

### ngrok running but no callbacks

- Keep ngrok terminal open
- Use current ngrok URL (it changes unless reserved)
- Confirm Africa's Talking callback URLs exactly match routes

---

## Security and production hardening checklist

Before production rollout, add:

- Authentication and role-based authorization for non-USSD APIs
- Webhook signature validation and replay protection
- Idempotency safeguards on payment and release operations
- Queue/retry strategy for outbound SMS
- Better observability (structured logs, metrics, tracing)
- Admin audit/reporting and dispute handling tooling

---

## License

Private/internal project unless you choose to publish with an explicit license.
