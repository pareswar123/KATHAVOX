# KathaVerse – Development Progress

Status legend: ✅ done and verified · 🟡 code written, not yet verified at runtime · ⬜ not started

## Phase 1 – Foundation
| Item | Status | Notes |
|---|---|---|
| Angular 20 app with SSR (`story-web/`) | ✅ | `ng build` (SSR) passes |
| NestJS 11 app (`story-service/`) | ✅ | `nest build` and `tsc --noEmit` pass |
| TypeORM entities for all 16 tables | ✅ | `story-service/src/database/entities/` |
| TypeORM DataSource + CLI config | ✅ | `database.options.ts`, `data-source.ts` |
| Initial migration | ⬜ | Blocked: needs local PostgreSQL password. Run `npm run migration:generate` then `npm run migration:run` |
| Seed script (admin, categories, languages, plans, settings) | 🟡 | `npm run seed`; not run yet (needs DB) |
| Swagger at `/api-docs` | 🟡 | Wired in `main.ts`; not started yet |
| Public catalogue endpoints | 🟡 | `/api/v1/public/categories`, `/languages`, `/subscription-plans` |
| Angular dev proxy `/api` → `:8080` | ✅ | `story-web/proxy.conf.json` |
| Tailwind CSS v4 | ✅ | `story-web/.postcssrc.json`, `src/styles.css` |

## Phase 2 – Authentication
| Item | Status | Notes |
|---|---|---|
| Login, refresh rotation with reuse detection, logout | 🟡 | `story-service/src/auth/auth.service.ts` |
| Forgot / reset / change password, verify email | 🟡 | Single-use hashed tokens |
| Author registration | 🟡 | Email verification required before login |
| Global JWT, roles (DB-backed), CSRF, throttling guards | 🟡 | `auth/guards/` |
| Angular AuthStore, AuthService, interceptors, guards | 🟡 | `story-web/src/app/core/` |
| Login page | 🟡 | `/auth/login` |
| Register, verify-email, reset-password pages | ⬜ | Backend endpoints exist |
| Automated auth tests | ⬜ | |

## Phases 3–6
⬜ Not started (admin/author portals, public site, payments, finalization).

## Known gaps
- Phase 1 runtime checks (migration, seed, Swagger) have not been run because the local PostgreSQL password is not yet configured.
- No automated tests exist yet.

## Phase 3 – Admin and Author portals
| Item | Status | Notes |
|---|---|---|
| Story CRUD (author and admin) | ✅ | Ownership enforced in `StoriesService`; authors get 404 for others' stories |
| Page CRUD, reorder, delete with renumbering | ✅ | Content sanitised on the server |
| Submit, approve, reject, publish, unpublish, archive | ✅ | State rules in `StoriesService` |
| Published snapshot served to readers | ✅ | Author edits go to PENDING_APPROVAL; readers keep the approved snapshot |
| Pricing, free preview pages, featured (admin only) | ✅ | Author DTOs reject these fields with 400 |
| Image uploads (cover and in-story) | ✅ | Real type checked from file header; size limits from `.env` |
| Categories and languages admin | ✅ | Slugs generated; language codes unique |
| Author and admin dashboards | ✅ | Revenue and purchases show 0 until the payments phase |
| Public story list and detail (preview pages only) | ✅ | Locked page content is never returned |
| Admin revenue cards and payments screen | ✅ | Dashboard totals come from successful payments (total, this month in IST, story purchases, active subscriptions). New `/admin/payments` screen: date range (default today, IST), status and type filters, totals line, pagination. Checked against the database (₹194.00 total for 25 Nov) and in the browser; 403 for readers and authors; invalid dates give 400. Dates show as dd-MM-yyyy. Filters apply on Search. Export to Excel downloads every row in the range (checked: same 12 rows as the list, 403 for readers). |
| Books (group of published stories) | ⬜ partly | Migration Books1795800000000. Admin: create from published stories, reorder, Draft → Publish → Unpublish → Publish, price editable any time, PDF (cover, contents with page ranges, each story: cover, details, pages). Public /books and /book/:slug with index; paid book needs purchase or subscription to read its stories. Checked by API: publish/unpublish, PDF pages 14 = contents ranges, guest blocked, subscriber allowed, author 403. Not yet checked: paid checkout through Razorpay in the browser, admin book form in the browser, library book section. |
| Author drafts hidden from admin until submitted | ✅ | New `submitted_at` column (migration `StorySubmittedAt`). Set on author submit, on admin create and on publish. Admin list, counts and detail skip unsubmitted drafts. Checked end to end: admin gets 404 before submit, sees the story after. |
| Session timing: 5 min access token, 5 hr refresh token | ✅ backend, ⬜ browser | Backend checked: access token `expiresIn` 300, refresh token lives 5 h, bogus or reused tokens get 401. Front end renews at 80% of the access token life and sends the user to login with a notice when the refresh token ends (protected pages only). Not yet checked in the browser: the 4-minute renewal and the logout after the refresh token expires. |
| Admin book PDF download (icon in stories table) | ✅ | PDFKit, A4. Cover, title/details page (author, category, language, description), then one book page per story page. Published snapshot. Odia text renders with bundled Noto Sans Oriya. Admin only (reader gets 403). Checked by API and in the browser. Not yet checked: a story that was never published (409), which no local record covers. A draft that was published before downloads its last published version. |
| Rich-text editor (Tiptap) | ✅ | Paragraph, H2/H3, bold, italic, underline, lists, images |
| Browser walkthrough | ✅ | Author login, story create, page add, submit; admin approve; public list |

Verification:
- Backend smoke test: 30 of 31 checks passed. The one failure was a test mistake, and a direct check confirmed locked page content is absent from the public response.
- Frontend production build with SSR passes.

Known gaps:
- Reader pages, purchases and subscriptions are not built (Phases 4–5).
- Author and admin screens don't set the tab title yet on every route.
- Uploads go to one endpoint, `/uploads?kind=cover|image`, rather than separate author and admin endpoints.
