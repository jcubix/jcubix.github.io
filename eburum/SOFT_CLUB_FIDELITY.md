# Soft Club: fidelity correction

The user rejected the prior integration because it copied a visual theme without recreating the approved prototype composition. This correction uses `work/soft-club/src/main.jsx` and `style.css` as the visual authority. Prior integration evidence is retained separately, not overwritten.

## File-by-file comparison

| File | Comparison and correction |
| --- | --- |
| `src/app.tsx` | Retains the shared floating dock and account/season controls; restores bell/dot and staff initials. |
| `src/pages.tsx` | Replaces the training hub with a selected-training reply workspace. Restores a single player directory, stacked home/away match cards, and the original Altro wording and order. All existing authorized tools remain. |
| `src/main.tsx` | Loads the canonical scoped reference rules after the operative shell styles. |
| `src/soft-club-reference.css` | Transfers approved geometry from the prototype under sc-* classes so legacy editor rules cannot redefine it. Adds only protected production controls and safe data states. |
| `src/soft-club.css` | Retains shell, dock and operational sheet styling; superseded home/list styles are removed during final cleanup. |
| `src/styles.css` / `app.css` | Retains registered domain controls, attendance, calendar, reports, visual viewport handling and modal accessibility. The primary five routes use explicit canonical classes. |
| `app-operations.js` | Restores hero → grouped priorities / communication → next fixture topology. Removes extra agenda and shortcut cards from Home. Uses actual activities, replies, fixtures and administrative counts. |
| `app-communications.js` | Restores full preview structure: category, expiry, title, body, author/avatar and chevron. Realtime update hooks remain intact. |
| `app-training-planning.js` | Presents existing atomic activity save as an inline, directly usable reply workspace. Keeps full roster, revision, request ID, failed drafts, future attendance guard and distinct actual-presence workflow. |
| `src/runtime.ts` / `src/types.ts` | Adds an explicit protected inline editor adapter and guards season changes while replies are dirty or saving. No second business/persistence implementation. |
| `app-icons.js` | Supplies the small canonical icon controls for domain markup. React uses the existing Lucide dependency. |
| `app-team.js`, `app-workflows.js`, `app-part3.js` | Reviewed at their integration boundaries; keep existing attendance, callup, roster, draft and permission behavior. |
| `app-match-display.js`, `app-match-minutes.js`, `app-part4.js` | Keep home-first display and actual Eburum-owned goals; retain substitutions, cards, event save and historical manual minutes. |
| `app-part5.js` | Keeps individual report filters, charts, complete historical retrieval and PDF export. |
| `app-access.js`, `app-admin.js`, `app-dialogs.js`, `app-confirm.js` | Keep server-authoritative roles, user profiles, admin-only account/password actions, focus isolation and nested dialogs. |
| `app-realtime.js`, `app-data.js`, `vite.config.ts`, PWA assets | No data migration or deployment schema change. Realtime communications, seasonal loads, compiled static precache and PNG icons remain. |
| `tests/frontend-interactions.cjs`, `tests/communications-ui.cjs`, `tests/workflows-ui.cjs` | Update obsolete presentation selectors without removing domain assertions. Add full-roster retry/no-attendance, duplicate-save, dirty season guard and secretary readonly tests. |
| `DESIGN.md`, `.impeccable/design.json`, surface brief | Final documenter records the actual canonical system and supersedes earlier adaptation allowances. |

## Verification

`npm run verify`: 33 domain tests + 21 React integration tests + 2 built PWA tests, all pass. Browser fixture: nine routes × six viewport widths (320, 390, 614, 768, 1280, 1440); no horizontal overflow, one selected dock destination, mobile field sizes and 44px dock controls. Safe-area simulation uses 59px top and 34px bottom; account close button stays below the status area. Rejected blank desktop capture was replaced before review.

Fixture data exists only in browser initialization/testing; production data is never replaced. No database SQL, table cleanup or account creation was run for this visual correction. A physical iPhone test and staff-authenticated live production workflows are not claimed.

## Final review and publication — 2026-10-11

The fresh independent review concluded **ship** after all seven recorded findings were resolved. The final verdict is scoped to those seven corrections. Player directory row cadence is 82px, matching the reference; its trailing touch target remains 44px. Review evidence: `.impeccable/review/soft-club-fidelity/finish-review.md` and `fix-verdict.md`.

The final build passed `npm run verify` (56 tests), `npm run format:check` and `git diff --check`. Final preview `dpl_fw2tRn2tTzxjghzyo4FjDgEz4HLA` was checked before publishing the same uploaded artifacts as production `dpl_F8ZmZAv8SMuT9MAyZXLMmFWPv6Q7`, READY and aliased to https://eburum.vercel.app.

Browser smoke checks passed on both preview and the production domain: all 21 assets returned successfully (SHA-1 matched; index HTML permits the Vercel toolbar injection), login had no horizontal overflow at 320/390/1440px, input font was 16px, the service worker was active, the PNG apple-touch-icon was present, and no JavaScript page errors were recorded. The authenticated domain workflows were verified through the integration tests and local browser fixture, not through live staff accounts. No commit or push was performed in this correction pass; existing uncommitted work was preserved.
