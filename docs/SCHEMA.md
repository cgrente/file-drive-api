# Schema

This document summarizes the primary MongoDB collections as modeled via Mongoose.

> This is a **documentation aid**. The authoritative definitions live in `src/models/*`.

---

## User

- `username` (string)
- `email` (string, unique, indexed)
- `password` (string, hashed; typically `select: false`)
- `role` (`owner` | `member` | `admin`)
- `stripeCustomerId?` (string)
- `subscriptionId?` (ObjectId -> Subscription)
- `businessId?` (ObjectId -> Business)
- email verification + reset password tokens

---

## Business

- `name` (string)
- `ownerId` (ObjectId -> User)
- `status` (`active` | `inactive`)

---

## Notification

- `userId` (ObjectId -> User)
- `type` (`welcome` | `file_shared` | `permission_revoked` | `password_reset` | `general`)
- `message` (string)
- `data?` (mixed/object)
- `isRead` (boolean)

---

## Subscription

- `userId` (ObjectId -> User)
- `stripeSubscriptionId` (string)
- `planType` (`monthly` | `yearly` | `yearly_presale` | `test`)
- `priceId` (string)
- `status` (`active` | `inactive` | `canceled`)
- `startedAt` (Date)
- `endsAt` (Date)

---

## Example placeholders

Use placeholders in docs/tests:

- Person: **John Smith**
- IDs: `507f1f77bcf86cd799439011`
