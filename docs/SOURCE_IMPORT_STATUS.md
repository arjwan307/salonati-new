# Four app integration — source audit (2026-10-30)

Sources received: 4 Google AI Studio ZIP exports (customer, salon, admin, cosmetics).

## Verified facts
- Each ZIP is an independent project export, with root package.json and index.html.
- The bundles contain overlapping paths whose content differs. Do not overwrite or flatten their roots.
- An isolated four-app staging archive was prepared locally, retaining every file under apps/{customer,salon,admin,cosmetics}, with SHA-256 inventory.
- The archive has **not** been uploaded to GitHub from this environment. This repository branch still lacks the imported source trees.
- Neither Cloudflare deployment nor live integration/authentication/push validation has been completed.

## Next release gate
1. Upload the staged source archive from the conversation to a Git environment and expand into this branch (not main); use the manifest to check files.
2. Fix only build and infrastructure issues without design, color or feature changes; keep visual diffs and test screenshots.
3. Test individual builds and workflows on Safari iPad/iPhone + Android Chrome.
4. Configure four separate Cloudflare Pages projects linked to source folders, and verify HTTPS, navigation, state persistence, role authorization, privacy consent and opt-in push.
5. Merge to main only after all checks and user acceptance.

**Never claim a deployment exists until its actual URL has been verified.**
