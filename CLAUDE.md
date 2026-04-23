# Project: nhabibap-assetprice

Angular 2x app using standalone components, signals, and the new control-flow syntax.

## Commands
- `npm start` — dev server on http://localhost:4200
- `npm run build` — production build
- `npm test` — unit tests (Karma + Jasmine)
- `npm run lint` — ESLint
- `npm run format` — Prettier write

## Conventions
- **Components**: standalone, OnPush change detection, signals for state.
- **Templates**: use `@if` / `@for` / `@switch`, not `*ngIf` / `*ngFor`.
- **State**: prefer `signal()`, `computed()`, `effect()` over RxJS unless dealing with streams.
- **HTTP**: `provideHttpClient(withFetch())`, `inject(HttpClient)` (no constructor injection).
- **Routing**: lazy-load routes with `loadComponent` / `loadChildren`.
- **Files**: one component per file, kebab-case filenames, co-locate `.ts` / `.html` / `.scss` / `.spec.ts`.

## Structure
- `src/app/core/` — singletons, guards, interceptors
- `src/app/shared/` — reusable standalone components, pipes, directives
- `src/app/features/<name>/` — feature folders, lazy-loaded

## Don't
- Don't add NgModules (this is a standalone-only codebase).
- Don't use `any` — strict mode is on for a reason.
- Don't introduce a state library (NgRx/Akita) without discussion; signals first.