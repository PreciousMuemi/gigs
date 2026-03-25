# Live USSD Testing Guide

## Prerequisites ✓

- **ngrok running**: `ngrok http 3000` (tunnel: `https://sternal-liam-overlightly.ngrok-free.dev`)
- **Credentials configured**:
  - AT_USERNAME=Maktabalink
  - AT_API_KEY=configured
  - DB_URL=Supabase credentials in .env
- **Callback URLs set in .env**: ✓

## Step 1: Configure Africa's Talking Dashboard

1. Go to https://africastalking.com/dashboard
2. Navigate to **USSD Settings**
3. Set callback URL to: `https://sternal-liam-overlightly.ngrok-free.dev/ussd`
4. Note your USSD **shortcode** (e.g., `*123#`)
5. Verify SMS sender ID: `AFTKNG`

## Step 2: Start the USSD Server

```bash
npm run dev:ussd
```

Expected output:

```
USSD Server running on port 3000
ngrok tunnel: https://sternal-liam-overlightly.ngrok-free.dev
```

## Step 3: Monitor ngrok Dashboard

Open in browser: http://localhost:4040

This shows all incoming USSD requests with request/response bodies.

## Step 4: Send Test USSD Request

### Option A: Using Test Script (below)

```bash
npm run test:live
```

### Option B: Manual cURL

```bash
curl -X POST https://sternal-liam-overlightly.ngrok-free.dev/ussd \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "sessionId=test123&phoneNumber=254700000000&text=1&serviceCode=123"
```

### Option C: Africa's Talking Sandbox UI

- Go to Sandbox → USSD → Send Request
- Phone: `254700000000` (Kenyan format)
- Input: `1` (select Register as Freelancer)

## Test Flows

### Flow 1: Register as Freelancer ✓

```
Input: 1
Response: CON Enter your name (20 chars max)
Input: John Doe
Response: CON Enter your skill (e.g., Web Dev)
Input: Web Development
Response: END Registration successful! Your ID: fr_123456
```

### Flow 2: Register as Client ✓

```
Input: 2
Response: CON Enter your name
Input: Jane Corp
Response: CON Enter your location (e.g., Nairobi)
Input: Nairobi
Response: END Registration successful! Your ID: cl_123456
```

### Flow 3: Post a Job ✓

```
Input: 3
Response: CON Job title?
Input: Build Website
Response: CON Budget (KES)?
Input: 50000
Response: END Job posted! ID: job_123456
```

### Flow 4: Find Freelancer by Skill ✓

```
Input: 4
Response: CON Enter skill to search?
Input: Web Development
Response: CON Select freelancer:
          1. John Doe (4.5★) - 254700000001
          2. Jane Dev (5★) - 254700000002
Input: 1
Response: END Contact: 254700000001
```

### Flow 5: Rate Freelancer ✓

```
Input: 5
Response: CON Freelancer phone?
Input: 254700000001
Response: CON Rating (1-5)?
Input: 5
Response: END Rating submitted! Your avg: 4.8★
```

## Expected Responses Format

All responses follow Africa's Talking USSD protocol:

```
CON [text]     # Continue session
END [text]     # End session
```

## Troubleshooting

### Issue: "Connection refused" to ngrok URL

- Verify ngrok is running: `ngrok http 3000`
- Check ngrok tunnel status: http://localhost:4040

### Issue: "Invalid session" in responses

- USSD sessions are stored in-memory (demo mode)
- For persistence, ensure database connection works

### Issue: No incoming requests

- Verify callback URL in Africa's Talking dashboard
- Check that USSD shortcode is active
- Monitor ngrok dashboard for incoming requests

### Issue: "Unauthorized" error from Africa's Talking

- Verify AT_USERNAME and AT_API_KEY are correct
- Check Africa's Talking API key hasn't expired

## Validation Checklist

- [ ] ngrok tunnel active (http://localhost:4040)
- [ ] USSD server running (`npm run dev:ussd`)
- [ ] Africa's Talking callback URL set correctly
- [ ] Test USSD request received in ngrok dashboard
- [ ] USSD response formatted as CON/END
- [ ] State transitions working (menu → input → response)
- [ ] All 5 menu options callable
- [ ] No console errors in server logs

## Next: Database Connectivity

Once USSD flows verified, fix database connectivity:

```bash
npm run db:init
```

This will:

1. Create 11 tables
2. Enable data persistence
3. Support full user journey (register → post → apply → fund → release → rate)

---

**Live Testing Started**: Ready to receive Africa's Talking callbacks
**ngrok URL**: https://sternal-liam-overlightly.ngrok-free.dev
**Server Port**: 3000
**Status**: ✓ Ready
