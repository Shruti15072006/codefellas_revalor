# ReValor

**B2B circular packaging exchange platform** — built for **HackOut'26** (theme: *Circular Carbon Ecosystem*).

ReCrate isn't a plain listing marketplace. It's an intelligent matching engine (**Circular Match Score**) that connects manufacturers/retailers with surplus packaging material to recyclers/buyers who need it — with a carbon-aware optimization toggle (Cost / Carbon / Speed / Balanced) and a fallback pathway that routes unsuitable material to recycling instead of dead-ending.

---

## Table of Contents

- [Team](#team)
- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [Database Schema](#database-schema)
- [Local Setup](#local-setup)
- [Environment Variables](#environment-variables)
- [Edge Function: match-requirement](#edge-function-match-requirement)
  - [Deployment Workflow](#deployment-workflow)
  - [Testing the Function](#testing-the-function)
  - [How the Matching Algorithm Works](#how-the-matching-algorithm-works)
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
                     ┌─────────────────────┐
                     │   React Frontend     │
                     │  (Vite + Tailwind)   │
                     └──────────┬──────────┘
                                │
                    Supabase JS Client (auth'd)
                                │
              ┌─────────────────┴─────────────────┐
              │                                     │
   ┌──────────▼──────────┐              ┌──────────▼───────────┐
   │   Supabase Postgres   │              │  Edge Function:        │
   │  profiles / listings / │◄────────────┤  match-requirement     │
   │  requirements /        │   queries    │  (Circular Match Score)│
   │  transactions           │             │  runs on Deno, calls   │
   │  (RLS enforced)          │             │  back into Postgres    │
   └──────────────────────┘              │  using the caller's own│
                                            │  auth token (RLS-safe) │
                                            └────────────────────────┘
```

The matching function doesn't use a service-role key — it forwards the caller's own `Authorization` header into a scoped Supabase client, so Row Level Security naturally enforces that a buyer can only request matches for their own requirement.

---

## Database Schema

Full schema lives in [`recrate-schema.sql`](./recrate-schema.sql). Summary:

### `profiles`
- `id` (references `auth.users`), `business_name`, `role` (`manufacturer` / `retailer` / `recycler` / `logistics`), `location_lat/lng`

### `listings`
- `seller_id`, `material_type`, `quantity`, `unit`, `grade` (`A`/`B`/`C`), **`price` — per-unit (₹/kg), not a flat total**, `location_lat/lng`, `available_from/until`, `status`

### `requirements`
- `buyer_id`, `material_type`, `quantity_needed`, `min_grade`, **`max_budget` — per-unit**, `location_lat/lng`, `needed_by`, `max_distance_km` (default `100`), `status`

### `transactions`
- `listing_id`, `requirement_id`, `seller_id`, `buyer_id`, `logistics_id`, `match_score`, `status`, distance/cost/emissions estimates, timestamps

**Key design decisions:**
- Prices and budgets are **per-unit**, not flat totals — needed for fair comparison when quantities don't match exactly.
- Partial quantity matches are allowed (scored via the Quantity Fit formula), but a claimed listing is treated as fully consumed for the hackathon scope — no partial-stock tracking.
- All tables have RLS enabled **plus explicit `GRANT` statements** — Supabase changed its default in 2026 so new tables are no longer auto-exposed to the Data API without explicit grants.

---

## Local Setup

```bash
# 1. Clone the repo and check out your branch
git clone https://github.com/Shruti15072006/codefellas_revalor.git
cd codefellas_revalor
git checkout -b <your-branch>

# 2. Install frontend dependencies
npm install

# 3. Install the Supabase CLI as a pinned dev dependency
npm install -D supabase

# 4. Log in and link to the shared Supabase project
npx supabase login
npx supabase link --project-ref yrooklvrncoxeqaedvfw

# 5. If supabase/ isn't initialized yet in your checkout
npx supabase init
```

> **Windows note:** if you don't have Docker installed, that's fine — Edge Function deploys can skip it with `--use-api` (see below). `npx supabase` works without a global CLI install, so `scoop`/`brew` are optional conveniences, not requirements.

---

## Environment Variables

Frontend `.env`:

```
VITE_SUPABASE_URL=https://yrooklvrncoxeqaedvfw.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon/publishable key from Project Settings → API>
```

Edge Functions **do not** need a `.env` file — `SUPABASE_URL` and `SUPABASE_ANON_KEY` are injected automatically into every deployed function via `Deno.env.get(...)`. Only add a secret manually if a function needs elevated (service-role) access:

```bash
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service role key>
```

---

## Edge Function: `match-requirement`

### Deployment Workflow

```bash
# 1. Scaffold (only needed once)
npx supabase functions new match-requirement

# 2. Paste the matching logic into:
#    supabase/functions/match-requirement/index.ts

# 3. Deploy (no Docker required)
npx supabase functions deploy match-requirement \
  --project-ref yrooklvrncoxeqaedvfw \
  --use-api
```

On success you get a live endpoint:

```
https://yrooklvrncoxeqaedvfw.supabase.co/functions/v1/match-requirement
```

### Testing the Function

The function requires a **real logged-in user's access token** — the anon key alone returns `401 Unauthorized`, since the function calls `auth.getUser()` and enforces that the caller owns the requirement being matched.

```powershell
# Log in as a test user and grab their token in one step
$login = Invoke-RestMethod -Uri "https://yrooklvrncoxeqaedvfw.supabase.co/auth/v1/token?grant_type=password" `
  -Method Post `
  -Headers @{ "apikey" = "<ANON_KEY>"; "Content-Type" = "application/json" } `
  -Body '{"email":"buyer@test.com","password":"<PASSWORD>"}'

$token = $login.access_token

# Call the function
$result = Invoke-RestMethod -Uri "https://yrooklvrncoxeqaedvfw.supabase.co/functions/v1/match-requirement" `
  -Method Post `
  -Headers @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" } `
  -Body '{"requirement_id":"<REQUIREMENT_ID>"}'

$result.matches | ConvertTo-Json -Depth 10
```

Get a valid requirement ID via SQL Editor:

```sql
select r.id, r.material_type, r.quantity_needed, r.min_grade,
       r.max_budget, r.max_distance_km, r.status, p.business_name
from public.requirements r
join public.profiles p on p.id = r.buyer_id
order by r.created_at;
```

**Example verified response** (500kg grade-A cardboard @ ₹8/kg matched against a 400kg, min grade B, max ₹10/kg, ≤50km requirement):

```json
{
  "listing_id": "f5b091a8-...",
  "match_score": 81,
  "distance_km": 3.44,
  "carbon_saved_kg": 599.86,
  "pathway": "direct_reuse",
  "score_breakdown": {
    "material": 1, "quantity": 0.75, "quality": 1,
    "distance": 0.931, "price": 0.2, "carbon": 0.6
  }
}
```

### How the Matching Algorithm Works

1. **Hard filters** eliminate incompatible listings first: material type, quantity > 0, grade ≥ requirement's minimum, price within budget (if both set), distance within `max_distance_km`, availability date.
2. **Weighted scoring (0–1 each)** across six factors:

   | Factor | Weight | Formula |
   |---|---|---|
   | Material | 0.30 | exact match = 1, else 0 |
   | Quantity | 0.15 | `1 - |offered - needed| / needed` |
   | Quality | 0.15 | grade meets minimum = 1, else 0 |
   | Distance | 0.15 | `1 - distance / max_distance_km` |
   | Price | 0.10 | `1 - price / max_budget` (weight dropped & renormalized if price/budget missing) |
   | Carbon | 0.15 | normalized avoided-impact estimate |

3. **Pathway routing:** Grade A/B → `direct_reuse`; Grade C → `recycling`.
4. **Carbon estimate (MVP, indicative only, not certified accounting):**
   `avoided_material_impact − transport_emissions`, where transport uses a flat `0.1 kg CO2e / tonne-km` factor.
5. Results are sorted by `match_score` descending and returned with a human-readable `reasons` array per match.

---

## Known Gaps / Next Steps

- [ ] **Distance-cap input missing on the frontend requirement form** — requirements created through the app currently default silently to `max_distance_km = 100` rather than letting the buyer set it.
- [ ] Carbon-engine logic is currently folded into `match-requirement` rather than a separate function (intentional 10-hour-hackathon scope decision).
- [ ] Optimization-mode toggle (Cost / Carbon / Speed / Balanced re-weighting of the scoring weights above) — stretch goal if time remains.
- [ ] No partial-stock tracking — a matched listing is treated as fully consumed even on a partial-quantity match.
- [ ] Transaction creation flow (turning a match into a `transactions` row) not yet wired end-to-end.

---

## Git Workflow

```
main
 └── initial project
      ├── vedanshi   (Person A — backend)
      ├── member2    (Person B — frontend)
      └── member3    (Person C — matching engine)
```

Each person works on their own branch off `initial project` and opens a PR to merge back in. To push a new branch for the first time:

```bash
git push --set-upstream origin <branch-name>
```

If you get a `403 Permission denied`, ask the repo owner to add you as a collaborator under **Settings → Collaborators** — you must accept the invite before push access activates.
