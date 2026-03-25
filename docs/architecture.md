# High-level architecture (text diagram)

```text
[Mobile User]
  | USSD Dial/SMS
  v
[Africa's Talking Gateway]
  |-------------------------------> [Express API]
  |                                  |- USSD Route (/ussd/callback)
  |                                  |- Webhooks (/webhooks/payments, /webhooks/sms)
  |                                  |- Admin/API routes (/api/*)
  |
  |                               [USSD State Machine Service]
  |                               [Contract + Escrow Service]
  |                               [Notification Service]
  |                                        |
  |                                        v
  |                                   [Africa's Talking API]
  |                                   (SMS + M-Pesa STK)
  |
  v
[PostgreSQL]
(users, skills, jobs, applications, contracts, escrow_transactions, ratings, sessions)
```

## Components

- **Express API**
  - `POST /ussd/callback` for USSD stateful interactions
  - `POST /webhooks/payments` for STK payment status callbacks
  - `POST /webhooks/sms` for SMS delivery callbacks
  - `/api` admin/ops endpoints for job acceptance, completion, release, rating

- **USSD State Machine**
  - Session table `ussd_sessions`
  - States: menu, registration, post job, browse jobs, apply bid
  - Returns `CON` or `END` text

- **Payment Escrow Service**
  - Initiates STK push on contract acceptance
  - Tracks escrow transaction lifecycle and contract/job statuses

- **Notification Service**
  - Sends transactional SMS (registration, escrow funded, work submitted, release)

- **PostgreSQL DB**
  - Core entities: users, skills, user_skills, jobs, job_applications, contracts, escrow_transactions, ratings

## Data flow (step-by-step)

1. User dials USSD code.
2. Africa's Talking sends callback to `/ussd/callback`.
3. State machine reads session and responds with next menu.
4. User registers, posts job, or applies.
5. On client acceptance, backend creates contract and sends STK push.
6. Payment webhook updates escrow transaction.
7. On success, contract/job move to in-progress and SMS is sent.
8. Freelancer marks work complete, client confirms release.
9. Escrow release is recorded; both parties rate each other.
10. Audit and SMS logs remain available for reconciliation and support.
