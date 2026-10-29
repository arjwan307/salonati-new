# Salonati — Four Apps Integration Guardrails

Source of truth: approved Google AI Studio exports for Customer, Salon, Administration, and Cosmetics.

## Non-negotiable preservation
- No visual redesign, no changes to colors, typography, icons, layouts, content, or animations.
- Do not add, remove, or alter customer-approved functionality or user flows.
- Preserve each app's original entrypoint, scripts, styles, assets, and device behaviors before refactoring.
- Never overwrite one app export with another, even if filenames match.
- No real customer records, credentials, tokens or secrets in commits.
- Keep `main` unchanged until reproducible builds, device acceptance tests, and cross-app integration checks pass.

## Target apps (separate deliverables)
- Customer (زبونة)
- Salon (صالون)
- Admin (إدارة)
- Cosmetics (كوزمتك)

## Technical acceptance
1. Record hashes and inventories for each export; keep original ZIP archives safe outside repository.
2. Import each application under a distinct directory, with no destructive merging.
3. Use responsive existing behavior across iPad Safari, iPhone Safari, and Android Chrome.
4. Add automated type/build/smoke checks without changing application features.
5. Wire only already approved cross-app flows through secure server APIs and database migrations.
6. Verify role isolation, authenticated access, HTTPS, data persistence, backups and deployment rollback.
7. Deploy four separately addressable HTTPS applications after tests; record real URLs, not placeholders.

## Current state
Integration staging branch. The four supplied Google AI Studio exports still require import and verification. No production rollout authorized by this file.
