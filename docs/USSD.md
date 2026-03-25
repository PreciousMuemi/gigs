# USSD Server Quick Start

## Minimal USSD Endpoint

**File**: [src/ussdServer.js](src/ussdServer.js)

```
POST /ussd
Body: { sessionId, phoneNumber, text }
Response: CON ... or END ...
```

## Run it

```bash
# Development mode (with hot reload)
npm run dev:ussd

# Production mode
npm run start:ussd

# Test locally (no DB needed)
npm run test:ussd
```

## How it works

1. Africa's Talking sends `POST /ussd` with `{ sessionId, phoneNumber, text }`
2. State machine reads session context from DB
3. Menu logic returns next screen (`CON`) or end screen (`END`)
4. Response sent back as plain text

## Example flow

### Request 1 (new session)

```json
{
  "sessionId": "sess-abc123",
  "phoneNumber": "+254712345678",
  "text": ""
}
```

**Response**:

```
CON Welcome to KaziLink
1. Register as Freelancer
2. Register as Client
3. Post a Job
4. Find a Freelancer
5. Rate a Freelancer
0. Exit
```

### Request 2 (user presses 1)

```json
{
  "sessionId": "sess-abc123",
  "phoneNumber": "+254712345678",
  "text": "1"
}
```

**Response**:

```
CON Enter your full name:
```

### Request 3 (user enters name)

```json
{
  "sessionId": "sess-abc123",
  "phoneNumber": "+254712345678",
  "text": "1*John Kariuki"
}
```

**Response**:

```
CON Enter your main skill (e.g. plumbing):
```

### Request 4 (user enters skill)

```json
{
  "sessionId": "sess-abc123",
  "phoneNumber": "+254712345678",
  "text": "1*John Kariuki*Plumbing"
}
```

**Response**:

```
END Freelancer profile created successfully.
```

---

## Africa's Talking Configuration

Set these callback URLs in your Africa's Talking dashboard:

- **USSD Callback URL**: `https://your-domain.com/ussd`
- **Short code**: `*123#` (or your choice)

That's it!

## Test locally without Africa's Talking

```bash
npm run test:ussd
```

This runs [src/scripts/testUssd.js](src/scripts/testUssd.js) which simulates 4 USSD requests through the state machine.

---

## Files

| File                                                                             | Purpose                      |
| -------------------------------------------------------------------------------- | ---------------------------- |
| [src/ussdServer.js](src/ussdServer.js)                                           | Minimal Express USSD handler |
| [src/ussdServerIndex.js](src/ussdServerIndex.js)                                 | Server entry point           |
| [src/scripts/testUssd.js](src/scripts/testUssd.js)                               | Local test harness           |
| [src/services/ussdStateMachine.js](src/services/ussdStateMachine.js)             | Menu state logic             |
| [src/repositories/platformRepository.js](src/repositories/platformRepository.js) | DB queries                   |

Clean. Minimal. Hackathon-ready.
