# FinTrack MultiAgent API – Quick Reference

Base URL: `http://localhost:5000/api`

## Auth

- `POST /auth/register` – Body: `{ name, email, password }`
- `POST /auth/login` – Body: `{ email, password }`
- `GET /auth/me` – Requires `Authorization: Bearer <token>`

## Transactions

- `GET /transactions` – Query: `from`, `to`, `limit`
- `POST /transactions` – Body: `{ amount, category, merchant, date, channel }`
- `DELETE /transactions/:id`

## Import

- `POST /import/csv` – Body: `{ csv: "<csv text>" }`
- `POST /import/sms` – Body: `{ messages: ["raw sms 1", "raw sms 2"] }`
- `POST /import/upi` – Body: `{ upiRecords: [ { amount, to, note, time, type } ] }`

## Insights

- `GET /insights` – Returns summary, totals, byCategory and smartNudges.
