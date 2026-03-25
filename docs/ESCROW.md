# Escrow with Africa's Talking Payments (M-Pesa)

## Overview

**Escrow** keeps money safe between client and freelancer:

1. **Client funds** → Money held by Africa's Talking (not given to freelancer yet)
2. **Work done** → Freelancer submits deliverables
3. **Client confirms** → Money released to freelancer's M-Pesa account
4. **Dispute path** → If client rejects, money refunded to client

---

## Real Flow (Production)

### Step 1: Client Initiates STK Push (M-Pesa Payment)

```javascript
const paymentEscrow = require("../services/paymentEscrowService");

// After freelancer is accepted
const result = await paymentEscrow.initiateFunding({
  contract: {
    id: "contract-uuid",
    agreed_amount: 3500,
    currency: "KES",
    job_id: "job-uuid",
  },
  clientPhone: "+254712345678",
});

// Africa's Talking sends STK push to client's phone
// Client sees: "KaziLink - Enter M-Pesa PIN to approve KES 3500"
// returnData: { providerReference: 'CHK-ABC123' }
```

### Step 2: Payment Webhook Callback

Africa's Talking POSTs to your webhook (`/webhooks/payments`):

```json
{
  "checkoutRequestID": "CHK-ABC123",
  "resultCode": 0,
  "resultDesc": "The service request has been initiated successfully",
  "merchantRequestID": "12345-67890",
  "amount": 3500,
  "phoneNumber": "+254712345678"
}
```

Your backend processes it:

```javascript
const paymentEscrow = require("../services/paymentEscrowService");

app.post("/webhooks/payments", async (req, res) => {
  const outcome = await paymentEscrow.handleFundingWebhook(req.body);

  if (outcome.ok && outcome.status === "success") {
    // Contract moved to 'in_progress'
    // Freelancer can now start work
    // SMS sent to both parties
  }

  res.json({ received: true });
});
```

### Step 3: Freelancer Marks Work Complete

```javascript
const contracts = require("../services/contractService");

await contracts.markWorkSubmitted(contractId);
// Contract status: 'work_submitted'
// Client receives SMS notification
```

### Step 4: Client Confirms & Releases Escrow

```javascript
await contracts.confirmAndRelease(contractId);
// Escrow transaction recorded as 'released'
// Payment sent to freelancer's M-Pesa account
// Both parties notified
```

---

## Database: Escrow Transaction Tracking

```sql
CREATE TABLE escrow_transactions (
  id UUID PRIMARY KEY,
  contract_id UUID,
  type VARCHAR(20),        -- 'fund', 'release', 'refund'
  amount NUMERIC(12,2),
  currency VARCHAR(8),
  provider_reference VARCHAR(160),  -- Africa's Talking reference
  idempotency_key VARCHAR(100),     -- Prevent double-processing
  status VARCHAR(20),               -- 'pending', 'success', 'failed'
  raw_payload JSONB,                -- Full webhook response
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**States per contract:**

```
awaiting_escrow → (STK sent) → in_progress → work_submitted
                                  ↓
                            Client confirms
                                  ↓
                              released ✓
                            (payment sent)
```

---

## Hackathon Simulation (No Real M-Pesa)

For a quick demo without real payments:

```javascript
const escrowDemo = require("../scripts/escrowDemo");

// 1. Client funds (instant in mock mode)
await escrowDemo.mockClientFundsEscrow({ contractId });

// 2. Freelancer submits work
await escrowDemo.freelancerSubmitsWork({ contractId });

// 3. Client releases payment
await escrowDemo.clientConfirmsAndReleases({ contractId });

// 4. Rating
await escrowDemo.clientRatesFreelancer({
  contractId,
  fromUserId: "client-id",
  toUserId: "freelancer-id",
  score: 5,
  comment: "Great work!",
});
```

**Run it:**

```bash
node src/scripts/escrowDemo.js
```

This logs the full flow without requiring a database or real M-Pesa.

---

## Key Files

| File                                   | Purpose                                     |
| -------------------------------------- | ------------------------------------------- |
| `src/services/paymentEscrowService.js` | Real M-Pesa escrow logic                    |
| `src/services/contractService.js`      | Contract lifecycle (mark complete, release) |
| `src/scripts/escrowDemo.js`            | Hackathon-friendly mock workflow            |
| `src/routes/webhookRoutes.js`          | Handles Africa's Talking callbacks          |

---

## Important: Idempotency

Always use **idempotency keys** to prevent double-charging:

```javascript
const idempotencyKey = `fund-${contractId}-${Date.now()}`;
// If same key submitted twice, second is ignored
```

---

## Deployment Checklist

- [ ] Set `PAYMENT_CALLBACK_URL` in `.env` (public HTTPS URL for webhooks)
- [ ] Configure webhook URL in Africa's Talking dashboard
- [ ] Test with sandbox credentials first
- [ ] Add retry logic for failed transactions
- [ ] Set up dispute/refund process
- [ ] Monitor webhook delivery (logs in `escrow_transactions`)

---

## Bonus: Refund Flow (if job disputed)

```javascript
async function refundEscrow(contractId, reason) {
  await repo.insertEscrowTx({
    contractId,
    type: "refund",
    amount: contract.agreed_amount,
    status: "success",
    rawPayload: { dispute_reason: reason },
  });

  await repo.setContractStatus(contractId, "refunded");
  // Money returns to client's M-Pesa account
}
```

---

That's it! M-Pesa escrow in a nutshell.
