# Fare Calculator — Agent Guide (`calculate-rent/`)

Single-page fare quoting tool for **Durga Travellers**. Calculates trip fares from distance, fuel, driver cost, tolls, and profit. No backend — external map APIs only.

**Sibling project:** `../booking/` — RecordMyTrip booking SaaS (separate repo, Firebase-backed).

---

## What this app does

- Quote fares: distance + fuel + driver/day + tolls + profit/day
- Multi-stop trips with per-leg distance
- Map-based distance via Google Maps (Places, Directions)
- Rate analysis: cost/km, profit/km, margin %, vs standard rate (₹30/km)
- Printable trip summary modal
- SSR-enabled for Netlify deployment

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Angular 21.2 — NgModule root + SSR |
| Styling | Tailwind CSS 4 |
| State | Angular Signals (no NgRx) |
| Maps (active) | Google Maps JS API — `GoogleMapComponent` |
| Maps (legacy) | Leaflet + OpenRouteService — `MapComponent` (not used in template) |
| SSR | Express 5 + `@angular/ssr` |
| Tests | Vitest |
| Deploy | Netlify (`npm run build:ssr`) |

---

## Commands

```bash
npm install
npm start                  # CSR dev server → http://localhost:4200
npm run build              # production CSR build
npm run build:ssr          # SSR production build
npm run serve:ssr          # SSR server → port 4000
npm run start:ssr          # build:ssr + serve:ssr
npm test                   # Vitest
```

---

## Architecture

Single-page app — no feature routing. All fare logic and UI live in `app.ts` + `app.html`.

```
src/app/
├── app.ts / app.html           Fare engine + full UI
├── app-module.ts               NgModule bootstrap
├── app-routing-module.ts       Empty routes
├── server.ts                   Express SSR handler
├── components/
│   ├── google-map.component.ts Active map (standalone)
│   └── map.component.ts        Legacy Leaflet/ORS (reference only)
└── services/
    └── distance.service.ts     OpenRouteService HTTP client
```

### Fare formula

```
fuelCost = (distance / mileage) × fuelPrice
total = fuelCost + (driverPerDay × days) + tolls + (profitPerDay × days)
```

Rate analysis also computes cost/km, profit/km, profit %, liters required, and comparison to standard rate.

### Map components

| Component | Status | Use |
|---|---|---|
| `GoogleMapComponent` | **Active** | Places autocomplete, Directions API, round-trip toggle, geolocation |
| `MapComponent` | Legacy | Leaflet + OpenRouteService — kept for reference, not in template |

Use `GoogleMapComponent` for all new map work. Each stop maintains its own map state (do not share `DistanceService` signals across stops).

---

## Coding conventions (must follow)

1. **NgModule root** — `standalone: false` for app; map components are standalone imports in `AppModule`.
2. **Signals for state** — `signal()`, `.set()`, `.update()`; no NgRx.
3. **Template-driven forms** — `FormsModule`, `ngModel`, `ngModelChange`.
4. **No routing** — do not add feature modules or lazy routes; extend `app.ts` / `app.html`.
5. **SSR-safe** — guard browser-only APIs with `isPlatformBrowser` before map init.
6. **Per-instance map state** — isolated state per main distance field and per stop index.
7. **Prettier** — single quotes, 100 char width, 2-space indent.

### Signal pattern

```typescript
distance = signal(0);
totalFare = computed(() => {
  const fuel = (this.distance() / this.mileage()) * this.fuelPrice();
  return fuel + this.driverPerDay() * this.days() + this.tolls() + this.profitPerDay() * this.days();
});
```

---

## External APIs

| API | Used by | Purpose |
|---|---|---|
| Google Maps JS API | `GoogleMapComponent` | Map, Places, Directions, Geocoder |
| OpenRouteService REST | `DistanceService` / `MapComponent` | Legacy geocoding/routing |

No custom backend. SSR server (`server.ts`) only serves static files and Angular SSR — no REST endpoints.

---

## Environment / API keys

| Source | Keys |
|---|---|
| `src/environments/environment.ts` | `googleMapsKey`, `openrouteServiceKey` |
| `src/environments/environment.prod.ts` | Production keys |
| `.env.local` | `VITE_OPENROUTESERVICE_KEY` (ORS path) |
| SSR | `PORT` env var (default 4000) |

Prefer environment variables over committed keys for production. Do not commit `.env.local`.

---

## SSR

- Build: `npm run build:ssr` → `dist/calculate-rent/browser` + `dist/calculate-rent/server/`
- Prerender: all routes (`app.routes.server.ts`)
- Express serves static assets, then Angular SSR for other requests
- Map components must not initialize on server — use `isPlatformBrowser`

---

## Deploy

| Target | Command / output |
|---|---|
| Netlify | `npm run build:ssr` → publish `dist/calculate-rent/browser` |
| Local SSR | `npm run start:ssr` → port 4000 |

See `DEPLOY_QUICK.md` and `SSR_GUIDE.md` for Vercel, Docker, and other targets.

---

## Do not

- Use `MapComponent` (Leaflet) in new features — use `GoogleMapComponent`
- Share `DistanceService` signal state across multiple map instances
- Copy booking project patterns (RxJS services, Firebase, ng-zorro) — different Angular version and architecture
- Add a backend or database unless explicitly requested

---

## Further reading

| File | Content |
|---|---|
| `README.md` | Feature overview and setup |
| `SSR_GUIDE.md` | SSR architecture |
| `DEPLOY_QUICK.md` | Netlify / Vercel deploy |
| `DISTANCE_SERVICE_GUIDE.md` | Distance calculation patterns |
| `OPENROUTESERVICE_SETUP.md` | ORS API setup (legacy path) |
| `../AGENTS.md` | Workspace overview (both projects) |
