# Vivica Repository Audit Report

Date: 2025-10-19

Scope: Frontend TypeScript React (Vite) + Capacitor Android. No Python/Flask backend code was present despite the general brief.

## Summary

- Fixed a BrowserRouter misuse, tightened profile switching/persistence, added a rotating welcome fallback, improved memory scope UX, and reduced write churn during streaming.
- Added a CI workflow (GitHub Actions) for lint, type-check, and build.

## Findings and Changes

### 1) Coding Errors

- React Router future flags misused on `BrowserRouter` in `src/App.tsx`.
  - Fix: Removed unsupported `future` prop.

- Inconsistent use of storage keys for profiles and current profile across components.
  - Fix: Standardized via `STORAGE_KEYS` and `Storage` helpers in `ProfileSwitcher`, `ProfilesModal`, `ChatBody`, `Index`, and `MemoryModal`.

### 2) Missing Logic

- Memory scope selection was missing in `MemoryModal`. The save action read `memory.scope` but initial state/UI did not set it, causing potential writes to a profile key with undefined profile.
  - Fix: Added default `scope: 'profile'`, a Scope selector UI, robust load/reset handling.

- Profiles import did not notify the rest of the app.
  - Fix: Dispatch `profilesUpdated` event after import.

### 3) Incomplete Implementations / TODOs

- Welcome fallback text was a placeholder.
  - Improvement: Added ~12 rotating snarky fallback messages consistent with Vivica’s tone.

- Stream save thrash to IndexedDB (writes on every token) not ideal.
  - Improvement: Debounced conversation persistence (400ms).

### 4) Performance and UX Enhancements

- Scroll-to-bottom threshold increased from 16px to 64px to reduce flicker and improve readability when near the bottom.
- Debounced conversation saves to reduce heavy I/O during streaming.
- Persona switching now more reliable with centralized storage usage and event dispatching.

### 5) Documentation & CI

- Added CI workflow `.github/workflows/ci.yml` to run lint, type-check, and build on push/PR.
- README already mentions CI and scripts; no structural changes required.

## Open Recommendations (Not Implemented)

- Brave Search multi-key retry (parity with ChatService): Add key rotation & cooldown.
- Broader e2e tests (Cypress/Playwright) for persona switching, memory save/summarize flows.
- Optional: show a temporary fallback welcome immediately while dynamic fetch runs, then replace.

## Patch Summary

- `src/App.tsx`: Removed unsupported Router future flags.
- `src/components/ProfileSwitcher.tsx`: Use `STORAGE_KEYS` + `Storage` for profiles.
- `src/components/ProfilesModal.tsx`: Standardized keys; dispatch `profilesUpdated` after import; current-profile safeguards.
- `src/pages/Index.tsx`: Centralized profile keys; debounce conversation saves; improved scroll threshold.
- `src/components/ChatBody.tsx`: Added rotating fallback welcomes; key usage constants; updated proximity threshold.
- `src/components/MemoryModal.tsx`: Added scope default, scope selector UI, robust persistence.
- `.github/workflows/ci.yml`: New CI pipeline.

## Compliance & Style

- TypeScript code follows project’s ESLint config; CI linting ensures ongoing conformance.
- PWA/Capacitor Android configs unchanged.

## Dependencies

- No new runtime dependencies. CI uses existing devDependencies.

