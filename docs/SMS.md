# SMS Setup & Examples

## Environment Variables

Add these to your `.env` file:

```env
# Africa's Talking SMS credentials
AT_USERNAME=sandbox
AT_API_KEY=your_api_key_here
AT_PRODUCT_NAME=FreelanceEscrow
AT_SMS_SENDER_ID=YourAppName
```

**Get these from**: [https://africastalking.com](https://africastalking.com)

---

## How it works

1. **Client** (`src/services/africasTalkingClient.js`) - Low-level Africa's Talking API
2. **Service** (`src/services/notificationService.js`) - Higher-level SMS sender with logging
3. **Usage** - Call `notify.sendSms(phone, message)` from anywhere

---

## Code Example

```javascript
const notify = require("./services/notificationService");

// Send SMS
await notify.sendSms("+254712345678", "Hello, this is a test message");
```

---

## Use Cases Implemented

### 1. Notify Freelancer of New Job

```javascript
const { notifyFreelancerOfJob } = require("./scripts/smsExamples");

await notifyFreelancerOfJob({
  freelancerPhone: "+254712345678",
  jobTitle: "Fix kitchen sink",
  clientName: "Jane Doe",
  budget: 3500,
});

// SMS sent:
// "New job alert! Jane Doe posted "Fix kitchen sink" for KES 3500.
//  Reply to apply or dial *123# to browse jobs."
```

### 2. Send Client Freelancer Contact

```javascript
const { sendFreelancerContactToClient } = require("./scripts/smsExamples");

await sendFreelancerContactToClient({
  clientPhone: "+254787654321",
  freelancerName: "John Kariuki",
  freelancerPhone: "+254712345678",
  freelancerSkill: "Plumbing",
  freelancerRating: 4.8,
});

// SMS sent:
// "Freelancer matched: John Kariuki (Plumbing). Rating: 4.8/5.
//  Contact: +254712345678. Dial *123# to hire."
```

### 3. Payment Notification

```javascript
const { notifyPaymentReceived } = require("./scripts/smsExamples");

await notifyPaymentReceived({
  freelancerPhone: "+254712345678",
  amount: 3500,
  jobRef: "JOB-001",
});

// SMS sent:
// "Payment received! KES 3500 for job JOB-001.
//  Check M-Pesa for details."
```

---

## Test Locally

```bash
npm run test:sms
```

This runs [src/scripts/smsExamples.js](../src/scripts/smsExamples.js) with mock phone numbers (won't actually send on sandbox).

---

## Integrate into USSD Flow

Already integrated! Check [src/services/ussdStateMachine.js](../src/services/ussdStateMachine.js):

```javascript
// After freelancer registers
await notify.sendSms(
  phoneNumber,
  `Welcome ${name}. Freelancer profile created.`,
);

// After job posted
await notify.sendSms(
  matchedFreelancers,
  `New job: ${jobTitle} for KES ${budget}`,
);

// After freelancer selected
await notify.sendSms(clientPhone, `Freelancer: ${freelancerName} (${phone})`);
```

---

## Production Considerations

1. **Retry logic** - Add exponential backoff for failed SMS
2. **Rate limiting** - Africa's Talking has rate limits
3. **Queue** - Use a job queue (e.g. BullMQ) for high volume
4. **Delivery reports** - Log success/failure via delivery callbacks
5. **Opt-out** - Track user SMS preferences

All SMS attempts are logged to `sms_logs` table for audit trail.
