# Architecture

This document describes the high-level architecture and runtime flow for the API.

> If anything here differs from the actual code, treat the **code as source of truth** and update this doc accordingly.

---

## Overview

The API provides:

- User authentication + account management
- File/folder CRUD metadata (binary objects stored in S3)
- Permissions (global + per-target)
- Notifications (in-app + optional email via SES)
- Billing/subscriptions (Stripe)

---

## Components

### Express app (`src/app.ts`)

Responsible for:

- Security middleware (Helmet, CORS)
- Request ID + structured logging
- Rate limiting (Redis-backed)
- Body parsing (JSON)
- Route registration
- Error handling

### Server bootstrap (`src/server.ts`)

Responsible for:

- Loading and initializing external SDK clients (AWS, Stripe)
- Connecting to MongoDB (with optional retry in prod/beta)
- Handling graceful shutdown (SIGTERM / SIGINT)

### External clients

- **S3**: stores file blobs (recommended approach: presigned uploads/downloads)
- **SES**: transactional email
- **Stripe**: payment intents + webhooks

---

## Stripe webhook wiring (required)

Stripe webhook signature verification requires using the **raw** request body.

**Rule:**
- Register `/api/payment/webhook` with `express.raw({ type: "application/json" })`
- Do this **before** `express.json()` is installed globally.

Recommended pipeline:

1) `app.use("/api/payment/webhook", express.raw({ type: "application/json" }))`
2) `app.use(express.json({ limit: "2mb" }))`
3) Register the rest of your routes normally

This ensures:
- Stripe can verify the signature
- All other endpoints still get parsed JSON

---

## Error handling

Use a consistent `AppError` shape:

- `message`
- `statusCode`
- `code`
- optional `details`
- optional `cause` (internal only, avoid leaking in prod responses)

---

## Environments

- `NODE_ENV=production`: uses production secrets/keys and safer defaults
- `NODE_ENV=test`: can skip external client init and avoid listening on a port (supertest)
