# PricePulse: Price Comparison & Deal Tracking Platform

A MERN-stack price comparison app. Users search products, compare merchant offers for the **same product variant**, view price history, and set target-price alerts. PricePulse does not sell anything or process payments; it links out to the merchant's site.

| | |
|---|---|
| **Live frontend** | https://pricepulse-blue-ten.vercel.app |
| **Live API** | https://pricepulse-uq81.onrender.com (health check: `/api/health`) |
| **Repository** | https://github.com/Meenamanya/pricepulse |

> **Cold start:** the API runs on Render's free tier and sleeps after ~15 minutes of inactivity. The first request after a quiet period can take 30 to 60 seconds. Open the API health URL once before testing.

## Demo credentials

| Role | Email | Password |
|---|---|---|
| Admin | `admin@pricepulse.dev` | `Admin@12345` |
| User | `demo@pricepulse.dev` | `User@12345` |

The demo user already has two watched products and one target-price alert (Samsung Galaxy S24 FE, target ₹28,500).

## Simulated data disclosure

**All products, prices, shipping costs, stock status and price history are seeded sample data.** They are not live market prices and were not scraped. Offer URLs point to real merchant domains (search pages) but the listed prices are invented for demonstration. Every offer and history record carries an `isSimulated` flag, and the API and UI both display a disclaimer.

## How to evaluate (5-minute path)

1. **Browse:** search "sony", filter by category/brand/price, sort, paginate. All of this runs on the backend.
2. **Compare:** open *Samsung Galaxy S24 FE*, variant 8GB/256GB. Amazon is the lowest known total (₹28,999). Croma's shipping is unknown, so its total shows "Unknown" and a notice explains the exclusion.
3. **History:** scroll to the chart and summary table (current, lowest, highest, change vs previous), all computed from stored records.
4. **Alert:** log in as the demo user, set a target on any product, see its status.
5. **Admin:** log in as admin, open *Admin → Products and offers*, set Croma's shipping to `100`. Croma's total becomes ₹28,900 and the comparison updates. Use *Record a price* to push a price below the demo user's target, then log back in as the demo user to see "target reached".

## Features

| Module | What is implemented |
|---|---|
| 1. Discovery | Category/brand/price filters, name/brand/model search, three sort modes, pagination (all server-side) |
| 2. Comparison | Per-variant comparison table, lowest comparable total, transparent handling of unknown shipping and unavailable offers |
| 3. History | Append-only price records, Recharts line chart, summaries computed from stored data |
| 4. Users | Register/login/logout, watchlist, target-price alerts, in-app "target reached" notification |
| 5. Admin | Create/edit/deactivate products, add variants and offers, update price/shipping/stock, record historical prices |
| 6. Analytics | Totals, active vs unavailable offers, largest merchant price spreads, targets reached; all aggregated from the database |

## Architecture

```
React (Vite) on Vercel  --HTTPS/JSON-->  Express API on Render  --->  MongoDB Atlas
   react-router, Recharts                 JWT auth, Zod validation       7 collections
```

**Backend layout (`backend/src`)**

- `models/`: Mongoose schemas with the indexes that enforce data integrity
- `services/pricing.js`: **pure functions** for comparison, history summaries and alert evaluation (no database access, unit-tested)
- `services/catalog.js`: orchestrates writes: update offer, append history, recompute variant/product summaries, re-evaluate alerts
- `routes/`: thin HTTP layer
- `middleware/`: authentication, admin check, validation, centralized error handling
- `utils/schemas.js`: Zod request schemas

**Frontend layout (`frontend/src`)**: pages (`Home`, `Product`, `Watchlist`, `Admin`, auth), shared components, an `AuthProvider` context, and a small `useAsync` data-fetching hook. Every screen has loading, empty and error states.

## Data model

| Collection | Purpose | Key constraints |
|---|---|---|
| `users` | Accounts, `role` is `user` or `admin` | unique email, bcrypt password hash |
| `products` | Canonical product (brand, model, category) | unique `(brand, model)` |
| `variants` | Purchasable variant (RAM, storage, colour, region) | unique `sku` |
| `merchants` | Store name and registered domain | unique name |
| `merchantoffers` | One merchant's offer for one variant | unique `(variantId, merchantId)` |
| `pricehistories` | Append-only price records | never updated or deleted by the app |
| `watchlists` | User to product | unique `(userId, productId)` |
| `pricealerts` | User target for one variant | unique `(userId, variantId)` |

## Design decisions (the seven questions from the brief)

1. **How canonical products and variants are identified.** A `Product` is brand + model. Each `Variant` has attributes (RAM, storage, colour, region) and a deterministic `sku` built by `buildSku()` from normalized lowercase values in a fixed order. The same variant always produces the same SKU, and a different RAM or storage produces a different one. Variants are never merged automatically.
2. **How offers are associated with the correct product.** Every offer stores `variantId` (and `productId`). An admin chooses the variant when adding the offer, and the API verifies the variant belongs to that product. Comparison only ever loads offers of one variant.
3. **How duplicate offers are prevented.** A unique compound index on `(variantId, merchantId)` allows one live offer per merchant per variant. A second insert returns HTTP 409 with a message to update the existing offer.
4. **How the lowest comparable price is calculated.** An offer is *comparable* if it is active, in stock, and has a known shipping cost. `total = price + shipping`, rounded to 2 decimals to avoid floating-point drift. The lowest total among comparable offers wins. Ties are all flagged as lowest.
5. **How missing shipping and incomplete information are handled.** Unknown shipping is stored as `null`, never `0`, and displayed as "Unknown". Such offers are excluded from the lowest total, and the API returns `comparisonComplete: false` plus plain-language notes (for example, when an unknown-shipping offer has a listed price below the lowest known total). If no offer is comparable, the API returns `lowestTotal: null` and says so.
6. **How history is kept without overwriting.** Whenever price, shipping or availability changes, a new `PriceHistory` row is inserted. Existing rows are never edited. A record dated earlier than the offer's latest update is added to history only and does not change the current price. Min, max and change-vs-previous are computed from the stored rows on each request.
7. **How target-price alerts are evaluated.** Alerts are evaluated after every change that can affect a price (offer create/update/deactivate, recorded price) and whenever an alert is created or edited. An alert is `reached` when the variant's lowest comparable total is `<=` the target (inclusive). `triggeredAt` is set on the first transition and kept stable; if the price rises again the alert returns to `active`. An unknown price never triggers an alert.

**Denormalisation.** `Variant.lowestTotal` and `Product.startingPrice` are recomputed on every offer change. This lets price filtering, sorting and pagination run as plain MongoDB queries. All writes go through `services/catalog.js`, which is the single place that keeps these values consistent.

## API summary

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout` |
| Products | `GET /api/products`, `GET /api/products/meta/filters`, `GET /api/products/:id`, `GET /api/products/:id/compare?variantId=`, `GET /api/products/:id/offers`, `GET /api/products/:id/price-history` |
| Admin products | `POST /api/products`, `PUT /api/products/:id`, `POST /api/products/:id/variants` |
| Offers (admin) | `POST /api/products/:id/offers`, `PUT /api/offers/:id`, `POST /api/offers/:id/price-history`, `GET/POST /api/merchants` |
| Watchlist | `GET /api/watchlist`, `POST /api/watchlist/:productId`, `DELETE /api/watchlist/:productId` |
| Alerts | `GET /api/alerts`, `POST /api/alerts`, `PUT /api/alerts/:id`, `DELETE /api/alerts/:id` |
| Analytics (admin) | `GET /api/admin/analytics` |

Listing query parameters: `q, category, brand, minPrice, maxPrice, sort (newest|price_asc|price_desc), page, limit`. Errors use appropriate status codes (400 validation, 401, 403, 404, 409) with a JSON body `{ error, details }`.

## Security

- Passwords hashed with bcrypt (cost 12); never stored or returned in plain text.
- JWT bearer authentication; the user is reloaded from the database on each request, so role changes and deleted accounts take effect immediately.
- **Authorization is enforced on the backend**: admin routes require `role === 'admin'`; public registration always creates a normal user. Hiding admin links in the UI is only cosmetic.
- **Data isolation**: watchlist and alert queries are scoped by the authenticated user id, so another user's record returns 404.
- Input validation with Zod on every write; ObjectId parameters validated; search input is regex-escaped.
- **External URLs**: an offer URL must be http(s) and its host must belong to the merchant's registered domain (blocks `javascript:` links and look-alike domains). The frontend opens links with `rel="noopener noreferrer nofollow"`.
- Helmet headers, CORS restricted to the configured frontend origin, request body size limit, rate limiting (stricter on login/register).

## Run locally

Requires Node 18+ and a free MongoDB Atlas cluster (allow your IP under Network Access).

```bash
git clone https://github.com/Meenamanya/pricepulse.git
cd pricepulse

# Backend
cd backend
npm install
cp .env.example .env        # then fill in MONGODB_URI and JWT_SECRET
npm run seed                # creates the demo dataset (WIPES this database's PricePulse collections)
npm run dev                 # http://localhost:5001 if PORT=5001

# Frontend (new terminal)
cd frontend
npm install
cp .env.example .env        # VITE_API_URL=http://localhost:5001/api
npm run dev                 # http://localhost:5173
```

Generate a JWT secret with: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

### Environment variables

| Backend (`backend/.env`) | Purpose |
|---|---|
| `PORT` | Server port (Render sets this automatically) |
| `NODE_ENV` | `development` or `production` |
| `CLIENT_URL` | Allowed frontend origin(s), comma-separated, no trailing slash |
| `MONGODB_URI` | Atlas connection string including the database name |
| `JWT_SECRET` | At least 32 characters |
| `JWT_EXPIRES_IN` | Token lifetime, default `7d` |
| `SEED_*` | Optional overrides for demo account emails and passwords |

| Frontend (`frontend/.env`) | Purpose |
|---|---|
| `VITE_API_URL` | Base URL of the API, ending in `/api` |

Real secrets are never committed. Only `.env.example` files are in the repository.

## Tests

```bash
cd backend && npm test
```

14 unit tests cover the pure business logic in `services/pricing.js` and the helpers: the brief's Store A/B/C scenario (including the update that makes Store C lowest at ₹28,900), unknown shipping never treated as zero, unavailable and inactive offers excluded, ties, float-safe totals, history summaries and edge cases, alert thresholds (inclusive boundary, unknown price, trigger reset), SKU determinism, and URL/domain validation.

## Deployment

- **Database:** MongoDB Atlas free tier (network access allows `0.0.0.0/0` because Render's free tier has no fixed IP; access is protected by database credentials).
- **Backend:** Render free web service, root directory `backend`, build `npm install`, start `npm start`.
- **Frontend:** Vercel Hobby plan, root directory `frontend`, preset Vite, `VITE_API_URL` set; `vercel.json` rewrites all routes to `index.html` for client-side routing.

## Known limitations

- Automated tests cover the business logic but not the HTTP routes end to end; routes were verified manually against the deployed app.
- Logout is client-side (stateless JWT). Tokens are not revocable before expiry.
- Writes that touch several collections (offer + history + summaries) are sequential, not wrapped in a transaction. A failure midway could leave denormalised summaries stale until the next update.
- The admin product picker lists up to 50 active products. A deactivated product disappears from the admin UI and can only be reactivated via the API (`PUT /api/products/:id` with `isActive: true`).
- The price chart plots the listed price, not price plus shipping.
- One alert per user per variant (update it rather than creating duplicates).
- Product-to-offer matching is manual (admin-assigned); there is no automatic matching engine, as the brief states one is not required.
- Free-tier hosting: cold starts after inactivity.
