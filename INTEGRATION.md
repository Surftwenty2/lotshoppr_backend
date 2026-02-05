# LotShoppr Integration Guide

## Overview

The system now has a **clean separation of concerns**:

- **Backend** (`lotshoppr_backend`): Decision engine + data storage + business logic
- **Webhook** (`lotshoppr-webhook`): Email handling only (Resend integration)

## Data Flow

```
Tally Form
    ↓
Webhook: POST /api/tally
    ↓
Backend: POST /api/leads (creates lead, stores criteria)
    ↓
Webhook: Sends customer emails via Resend to dealers
    ↓
Dealer replies
    ↓
Resend forwarding
    ↓
Webhook: POST /api/email-inbound
    ↓
Backend: POST /api/leads/:id/dealer-reply (evaluates offer)
    ↓
Backend returns decision + follow-up email
    ↓
Webhook: Sends follow-up email to dealer via Resend
```

## Setup

### Backend Setup

1. **Install dependencies**:
   ```bash
   cd lotshoppr_backend
   npm install
   ```

2. **Environment variables** (`.env`):
   ```
   OPENAI_API_KEY=your_openai_key_here
   PORT=4000
   ```

3. **Run**:
   ```bash
   npm run dev
   ```

   This starts the backend on `http://localhost:4000` with endpoints:
   - `GET /health` – health check
   - `GET /api/leads` – list all leads (debug)
   - `POST /api/leads` – create a lead from Tally data
   - `GET /api/leads/:leadId` – get specific lead
   - `POST /api/leads/:leadId/dealer-reply` – evaluate dealer offer

### Webhook Setup

1. **Install dependencies**:
   ```bash
   cd lotshoppr-webhook
   npm install
   ```

2. **Environment variables** (`.env.local` or Vercel env):
   ```
   RESEND_API_KEY=your_resend_key_here
   BACKEND_URL=http://localhost:4000       # During local dev
   BACKEND_URL=https://your-backend.com    # Production
   DEALER_EMAILS=dealer1@example.com,dealer2@example.com
   ```

3. **Deploy to Vercel** or run locally:
   ```bash
   vercel dev
   ```

## API Reference

### Backend: Create Lead

**POST** `/api/leads`

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "zip": "90210",
  "vehicle": {
    "year": 2024,
    "make": "Toyota",
    "model": "Camry",
    "trim": "LE",
    "color": "Silver",
    "interior": "light"
  },
  "constraints": {
    "dealType": "cash",
    "cash": {
      "maxOtd": 35000
    }
  }
}
```

**Response**:
```json
{
  "ok": true,
  "lead": {
    "id": "uuid-here",
    "createdAt": "2026-02-05T...",
    "status": "new",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "zip": "90210",
    "vehicle": {...},
    "constraints": {...},
    "conversation": []
  }
}
```

### Backend: Evaluate Dealer Reply

**POST** `/api/leads/:leadId/dealer-reply`

```json
{
  "dealerId": "dealer@example.com",
  "from": "dealer@example.com",
  "subject": "Re: Your quote request",
  "text": "We have a 2024 Toyota Camry for $32,500 out the door..."
}
```

**Response**:
```json
{
  "ok": true,
  "evaluation": {
    "decision": "accept",
    "reason": "meets_or_beats_target",
    "otdEstimate": 32500
  },
  "followupEmail": {
    "subject": "Re: Your quote request – that works for me",
    "body": "Hi,\n\nThanks for sending the numbers..."
  }
}
```

## Lead Status Flow

- **new** – just created
- **negotiating** – dealer offered, customer countered or rejected
- **won** – deal accepted
- **lost** – deal rejected

## Webhook: Tally Integration

The webhook receives Tally form submissions and:
1. Extracts form data
2. Calls backend to create lead
3. Sends admin notification email
4. Sends dealer request emails via Resend

The webhook expects field IDs to match Tally form. Update field mappings in `tally-webhook.js` if your form layout changes.

## Webhook: Email Inbound Integration

When customers reply **to dealer emails**, forward them to:
```
/api/email-inbound
```

(Your email provider needs to be configured to POST replies to this endpoint)

Payload format:
```json
{
  "to": "deals+{leadId}@lotshoppr.com",
  "from": "dealer@example.com",
  "subject": "Re: Your quote request",
  "text": "We can do it for $32,500..."
}
```

The webhook will:
1. Extract `leadId` from the `to` address
2. Call backend to evaluate the offer
3. Send follow-up email to dealer

## Testing

### Local Testing

1. **Start backend**:
   ```bash
   cd lotshoppr_backend
   npm run dev
   ```

2. **Create a lead** (using curl or Postman):
   ```bash
   curl -X POST http://localhost:4000/api/leads \
     -H "Content-Type: application/json" \
     -d '{
       "firstName": "Test",
       "lastName": "User",
       "email": "test@example.com",
       "zip": "90210",
       "vehicle": {"year": 2024, "make": "Toyota", "model": "Camry", "trim": "LE"},
       "constraints": {"dealType": "cash", "cash": {"maxOtd": 35000}}
     }'
   ```

3. **Get the lead back**:
   ```bash
   curl http://localhost:4000/api/leads/{leadId}
   ```

4. **Test dealer reply evaluation**:
   ```bash
   curl -X POST http://localhost:4000/api/leads/{leadId}/dealer-reply \
     -H "Content-Type: application/json" \
     -d '{
       "dealerId": "dealer@toyota.com",
       "from": "dealer@toyota.com",
       "subject": "Re: Your request",
       "text": "We have a Camry for $32,500 out the door with heated seats and backup camera"
     }'
   ```

## Database Upgrade Path

Currently using **in-memory storage** (ephemeral). When ready to persist data:

1. Implement database adapter (Postgres, MongoDB, etc.)
2. Update [src/storage.ts](src/storage.ts) to use database instead of Map
3. Export same interface functions, just backed by DB queries
4. Backend API remains unchanged

## Architecture Notes

### Why This Structure?

- **Webhook is stateless** – just handles email delivery
- **Backend owns business logic** – all decisions happen here
- **Lead data centralizes** – single source of truth
- **Easy to test** – API endpoints are simple REST
- **Scalable** – webhook can be distributed, backend can scale independently

### Common Mistakes to Avoid

❌ Don't: Store leads in the webhook  
✅ Do: Always create leads in backend

❌ Don't: Make negotiation decisions in webhook  
✅ Do: Call backend to evaluate offers

❌ Don't: Bypass backend for email sending  
✅ Do: Use webhook for email, backend for logic

## Troubleshooting

**"Backend error: lead_creation_failed"**
- Check backend is running on `BACKEND_URL`
- Verify required fields are in request
- Check backend logs

**"backend_evaluation_failed"**
- Verify `leadId` exists in backend
- Check OpenAI API key
- Check backend logs for parsing errors

**Dealer emails not sending**
- Verify `RESEND_API_KEY` in webhook env
- Check `DEALER_EMAILS` env variable  
- Check webhook logs

**No follow-up email after dealer reply**
- Ensure Resend is configured to forward replies
- Verify `deals+{leadId}@lotshoppr.com` format
- Check webhook logs for extraction errors
