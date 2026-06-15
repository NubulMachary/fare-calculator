# AGENTS.md

## Cursor Cloud specific instructions

This repo is the **Fare Calculator** (`calculate-rent`), an Angular 21 SSR app
(Express server) for computing travel fares. Map/distance features use Leaflet +
OpenRouteService; the OpenRouteService and Google Maps API keys are committed in
`src/environments/environment.ts`, so no extra secrets are required to run it.

Dependencies are installed automatically by the startup update script
(`npm install`; a `package-lock.json` is committed). Standard commands are in
`package.json` / `README.md`; notes below cover only non-obvious points.

- **Run (dev):** `npm start` (i.e. `ng serve`). Serves on port `4200` by default;
  the README references `4300`, so pass `--port 4300` if you want to match the docs
  (e.g. `npx ng serve --port 4300`). The dev server renders via SSR.
- **Build:** `npm run build`. The default build configuration is `production` and
  produces an SSR bundle under `dist/calculate-rent/`. Budget warnings for component
  CSS and a "leaflet is not ESM" warning are expected and non-fatal.
- **Test:** `npm test` uses the `@angular/build:unit-test` builder backed by
  **vitest** (runs once, no watch). The scaffolded `src/app/app.spec.ts` has a
  pre-existing failing test (`should render title` expects `Hello, calculate-rent`
  and the testing module does not import `FormsModule`, so the `ngModel` binding in
  `app.html` throws `NG0303`). This failure is unrelated to environment setup.
