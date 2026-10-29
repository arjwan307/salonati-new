# Google Studio import and cloud review — 2026-10-30

The complete four source exports are imported under `google-apps/{customer,salon,admin,cosmetics}`. This namespace avoids collisions with the legacy `apps/customer/index.html` and `apps/admin/index.html`. Original archives remain separately retained. SHA-256 inventory records every original file, including Studio caches and duplicate ZIP files which are not committed.

## Entry routing
| Review app | Original export entry |
| --- | --- |
| Customer | google-apps/customer/apps/customer/index.html |
| Salon | google-apps/salon/index.html |
| Admin | google-apps/admin/index.html |
| Cosmetics | google-apps/cosmetics/cosmetics/owner/index.html |

The export named Customer opens Cosmetics at its root. The export named Cosmetics opens Administration at its root. Deployment selects the existing role-appropriate page without rewriting any approved HTML/CSS/JS. All original roots are retained for review. No visual redesign was performed.

## Validation
- Resolved esbuild/Vite peer dependency mismatch with compatible esbuild 0.28 and lockfiles.
- Corrected TypeScript state types in the Admin/Cosmetics Vite development mocks; no runtime behavior change.
- All four TypeScript checks and Vite builds passed locally.
- Static release copies approved entry HTML byte-for-byte, excludes downloadable source ZIPs and alternate HTML pages, and verifies script syntax and local entry assets (45 checks).
- Cloud review builds use the dependency-free static exporter because these approved pages use plain HTML/JS. The React starter source remains preserved.

## Commercial release blockers
These are review deployments, not commercial acceptance:
- The Customer and Cosmetics selected pages still use localStorage demo data; they do not persist orders to a shared commercial backend.
- Admin Vite mock routes are development-only and are deliberately not deployed as authenticated production APIs.
- Salon includes a trial-mode switch from the supplied export; a secure backend and removal of trial shortcuts require integration work.
- Secure per-role login, registration approval, cross-app state, private push subscriptions, notification preferences and actual lock-screen push are not complete.
- Payments and physical iPad/iPhone/Android acceptance are not verified.
- `main` is unchanged. Do not merge or label commercial-ready until these gates pass.
