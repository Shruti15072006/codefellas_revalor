# ReValor

**B2B circular packaging exchange platform** — built for **HackOut'26** (theme: *Circular Carbon Ecosystem*).

ReValor isn't a plain listing marketplace. It's an intelligent matching engine (**Circular Match Score**) that connects manufacturers/retailers with surplus packaging material to recyclers/buyers who need it — with a carbon-aware optimization toggle (Cost / Carbon / Speed / Balanced) and a fallback pathway that routes unsuitable material to recycling instead of dead-ending.

---

## Table of Contents

- [Team](#team)
- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [Database Schema](#database-schema)
- [Local Setup](#local-setup)
- [Environment Variables](#environment-variables)
- [Edge Function: match-requirement](#edge-function-match-requirement)
- [Edge Function: create-transaction](#edge-function-create-transaction)
- [Known Gaps / Next Steps](#known-gaps--next-steps)
- [Git Workflow](#git-workflow)

---

## Team

| Person | Role | Owns |
|---|---|---|
| **Person A** | Backend & Data | Supabase project, schema, auth, seed data, Edge Function deployment |
| **Person B** | Core Frontend | React app scaffold, auth pages, listing/requirement forms, browse screen, transaction flow |
| **Person C** | Matching Engine | Circular Match Score logic (`match-requirement/index.ts`) |

---

## Tech Stack

- **Frontend:** React + Vite + TypeScript, Tailwind + shadcn/ui, Recharts
- **Backend:** Supabase (Postgres + Auth + Storage + Edge Functions)
- **Matching/carbon engine:** TypeScript, rule-based scoring, Haversine distance formula
- **Deployment:** Vercel (frontend), Supabase Edge Functions (backend logic)
- **Tooling:** GitHub, Lovable/Cursor (AI dev tooling)

---

## Architecture Overview

```
   React Frontend  ──auth'd Supabase client──►  Postgres (profiles / listings / requirements / transactions)
                                                        ▲
                    ┌───────────────────────────────────┘
                    │
        ┌───────────┴────────────┐      ┌──────────────────────────┐
        │  match-requirement       │      │  create-transaction        │
        │  (Circular Match Score)  │─────►│  (records the chosen match)│
        └──────────────────────────┘      └────────────────────────────┘
```

Both Edge Functions verify the caller's identity via their own Supabase auth token, then use a **service-role client** for the actual reads/writes (needed because a buyer must be able to flip a listing they don't own to `matched`). Ownership and status checks are done manually in code rather than relying on RLS alone.

---

## Database Schema

> **Schema was renamed/converted partway through the hackathon** to match an updated matching-engine version. If you're looking at old notes or an old seed script, the column names below are current — anything using `buyer_id`, `seller_id`, `grade`, `min_grade`, `price`, or `location_lat/lng` is **stale**.

### `profiles`
- `id` (references `auth.users`), `business_name`, `role` (`manufacturer` / `retailer` / `recycler` / `logistics`), `location_lat/lng`

### `listings`
- `user_id` *(was `seller_id`)*, `material_type`, `quantity`, `unit`, `quality_grade` *(was `grade`; now free text — `'high'` / `'good'` / `'low'`, was enum `A`/`B`/`C`)*, `price_per_unit` *(was `price`)*, `latitude` / `longitude` *(was `location_lat/lng`)*, `carbon_saved_kg` *(new)*, `estimated_delivery_days` *(new)*, `available_from/until`, `status`

### `requirements`
- `user_id` *(was `buyer_id`)*, `material_type`, `quantity` *(was `quantity_needed`)*, `quality_grade` *(was `min_grade`)*, `max_budget`, `latitude` / `longitude` *(was `location_lat/lng`)*, `needed_by`, `max_distance_km` (default `100`), `status`

### `transactions`
- `listing_id`, `requirement_id`, `seller_id`, `buyer_id` *(these two were **not** renamed — still `seller_id`/`buyer_id` here, referencing `listing.user_id` / `requirement.user_id` respectively)*, `logistics_id`, `match_score`, `status`, `estimated_distance_km`, `estimated_transport_cost`, `estimated_transport_emissions_kg`, `estimated_co2_saved_kg`, timestamps

**Key design decisions:**
- Prices/budgets are **per-unit**, not flat totals.
- Partial quantity matches are scored but a claimed listing is treated as **fully consumed** — no partial-stock tracking.
- `quality_grade` uses word-based tiers (`low` < `standard`/`medium` < `good` < `high` < `premium`/`excellent`) rather than the original `A`/`B`/`C` enum, to support fuzzier quality compatibility checks.
- All tables have RLS enabled plus explicit `GRANT` statements (Supabase requires these explicitly as of 2026).

---

## Local Setup

```bash
git clone https://github.com/Shruti15072006/codefellas_revalor.git
cd codefellas_revalor
git checkout -b <your-branch>          # branch directly off the default branch

npm install                             # frontend deps
npm install -D supabase                 # pin the Supabase CLI locally

npx supabase login
npx supabase link --project-ref yrooklvrncoxeqaedvfw
npx supabase init                       # only if supabase/ isn't already in your checkout
```

> **Windows/no-Docker note:** Edge Function deploys work fine without Docker using `--use-api` (see below). `npx supabase` also works without a global CLI install.

---

## Environment Variables

Frontend `.env`:
```
VITE_SUPABASE_URL=https://yrooklvrncoxeqaedvfw.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key from Project Settings → API>
```

Edge Functions get `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` **injected automatically** — none of these need to be set manually as secrets. (Supabase will actually refuse a manual `secrets set` on any `SUPABASE_`-prefixed name, since they're reserved.)

---

## Edge Function: `match-requirement`

**Deploy:**
```bash
npx supabase functions deploy match-requirement --project-ref yrooklvrncoxeqaedvfw --use-api
```

**Call it** (requires a real logged-in user's token — the requesting user must own the requirement):
```json
POST /functions/v1/match-requirement
Authorization: Bearer <user's access token>

{ "requirement_id": "...", "mode": "balanced" }
```

`mode` is optional (defaults to `"balanced"`) — one of `balanced`, `lowest_cost`, `lowest_carbon`, `fastest_delivery`. Each mode re-weights the same underlying scoring factors (material, quantity, quality, distance, price, carbon, delivery) differently.

**Verified example response:**
```json
{
  "listing_id": "f5b091a8-...",
  "match_score": 95.03,
  "distance_km": 3.44,
  "carbon_saved_kg": 750,
  "pathway": "Balanced matching",
  "score_breakdown": {
    "material": 1, "quantity": 0.9375, "quality": 0.8,
    "distance": 0.931, "price": 1, "carbon": 1, "delivery": 1
  }
}
```

Only listings with `status = 'available'` and `quantity > 0` are considered.

---

## Edge Function: `create-transaction`

Turns a chosen match into an actual recorded deal. Call this when a buyer accepts a match returned by `match-requirement`.

**Deploy:**
```bash
npx supabase functions deploy create-transaction --project-ref yrooklvrncoxeqaedvfw --use-api
```

**Call it:**
```json
POST /functions/v1/create-transaction
Authorization: Bearer <buyer's access token>

{
  "listing_id": "...",
  "requirement_id": "...",
  "match_score": 95.03,
  "distance_km": 3.44,
  "carbon_saved_kg": 750
}
```

Pull `match_score`, `distance_km`, and `carbon_saved_kg` straight from the `match-requirement` response — no need to recompute them.

**What it does:**
1. Verifies the caller owns the requirement and it's still `open`.
2. Verifies the listing is still `available`.
3. Inserts a `transactions` row (`status: 'pending'`).
4. Flips the listing and requirement to `status: 'matched'`.

**Response:**
```json
{ "success": true, "transaction": { "id": "...", "status": "pending", ... } }
```


---

