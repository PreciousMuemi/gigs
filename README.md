# USSD Freelance Platform (Africa's Talking + M-Pesa)

Node.js (Express) backend for a USSD-first freelance marketplace with:

- USSD menu state machine
- SMS notifications
- Escrow funding using M-Pesa STK push (via Africa's Talking)
- PostgreSQL data model for users, skills, jobs, ratings, and transactions

## Quick start

1. Install dependencies:
   - `npm install`
2. Configure env:
   - Copy `.env.example` to `.env` and fill values.
3. Initialize DB schema:
   - `npm run db:init`
4. Start server:
   - `npm run dev`

## Endpoints

- Health: `GET /health`
- USSD callback: `POST /ussd/callback`
- Payments webhook: `POST /webhooks/payments`
- SMS webhook: `POST /webhooks/sms`

### Optional admin APIs

- `GET /api/jobs/open`
- `POST /api/jobs/:jobId/accept` (client accepts freelancer)
- `POST /api/contracts/:contractId/complete` (freelancer marks done)
- `POST /api/contracts/:contractId/confirm` (client confirms and releases escrow)

## Africa's Talking setup notes

- Set USSD callback URL to `/ussd/callback`.
- Set mobile checkout callback URL to `/webhooks/payments`.
- Set SMS delivery callback URL to `/webhooks/sms`.

## Important

- This is production-style MVP code. Add stronger auth, role checks, signature validation, retries/queues, and reconciliation before going live.
