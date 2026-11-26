# KATHAVOX – Story Reading Platform

Read free and premium stories (English and Odia). Authors write and publish after admin approval. Readers buy stories or subscribe through Razorpay. Admins run the catalogue, approvals, payments and PDF export.

Progress and test results: [DEVELOPMENT_PROGRESS.md](DEVELOPMENT_PROGRESS.md) · Design decisions: [documentation/ASSUMPTIONS.md](documentation/ASSUMPTIONS.md) · Tester plan: shared separately.

## Folder layout

```text
KATHAVOX/
├── story-web/        Angular 20 frontend (SSR, Tailwind CSS v4)
├── story-service/    NestJS 11 API, TypeORM, PostgreSQL
├── database/         Database notes
├── documentation/    Design decisions and assumptions
├── upload_image/     Uploaded cover and story images (served at /uploads)
├── DEVELOPMENT_PROGRESS.md
└── README.md
```

Not committed to git (see `.gitignore`): `.env` files, `node_modules/`, `dist/`, `.angular/`, `package-lock.json`.

## Prerequisites

- Node.js 22 or newer (tested with Node 24)
- PostgreSQL 14 or newer, running on `localhost:5432`
- Git (optional, for the repository)
- A Razorpay test account for payments (optional for the other features)
- A Gmail account with an App Password for real email (optional; without it, emails are printed to the API console)

## 1. Create the database

```powershell
psql -U postgres -h localhost -c "CREATE DATABASE KATHAVOX;"
```

The database name in `.env` (`DATABASE_NAME`) must match.

## 2. Configure the API

```powershell
cd story-service
copy .env.example .env
```

Edit `story-service/.env` and set at least:

| Key | What to set |
|---|---|
| `DATABASE_PASSWORD` | Your PostgreSQL password |
| `JWT_ACCESS_SECRET` | A long random string (64 characters or more) |
| `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` | First admin login (password 12 characters or more) |
| `SEED_SAMPLE_USER_PASSWORD` | Password for the sample author, reader and admin accounts (local testing only) |
| `UPLOAD_DIRECTORY` | Absolute path to the `upload_image` folder |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Test-mode keys (leave empty if not testing payments) |
| `SMTP_HOST` … `SMTP_FROM` | See section 6 (leave `SMTP_HOST` empty to print emails to the console) |

The API refuses to start if a required key is missing. Every key is listed in `.env.example` with its section.

## 3. Install, migrate and seed

```powershell
cd story-service
npm install
npm run migration:run
npm run seed
```

`migration:run` creates the tables. `seed` is safe to run again: it adds missing categories, languages, plans and sample data, and creates the first admin if it is missing.

Migrations so far: `Init`, `Phase4Reader` (bookmarks), `StorySubmittedAt` (author drafts become visible to admin when submitted).

## 4. Run the two services

```powershell
# Terminal 1 – API
cd story-service
npm run start:dev
# API:      http://localhost:8080/api/v1
# Swagger:  http://localhost:8080/api-docs

# Terminal 2 – website
cd story-web
npm install
npm start
# Website:  http://localhost:4200  (proxies /api and /uploads to :8080)
```

To check both are up, open http://localhost:4200 and http://localhost:8080/api-docs.

## 5. Scripts

| Where | Command | Purpose |
|---|---|---|
| story-service | `npm run start:dev` | API with auto-restart on change |
| story-service | `npm run build` | Compile the API into `dist/` |
| story-service | `npm run start:prod` | Run the compiled API (`dist/main.js`) |
| story-service | `npm run migration:generate` | Create a migration from entity changes |
| story-service | `npm run migration:run` | Apply pending migrations |
| story-service | `npm run migration:revert` | Undo the last migration |
| story-service | `npm run seed` | Seed data and first admin (safe to repeat) |
| story-service | `npm test` | Unit tests (Jest) |
| story-web | `npm start` | Website with auto-reload |
| story-web | `npm run build` | Production build (browser and SSR output in `dist/`) |
| story-web | `npm run serve:ssr:story-web` | Run the SSR server from the build |

## 6. Email

- **Local, no sending:** leave `SMTP_HOST` empty. Verification and reset links are printed in the API console (`[dev mail] …`).
- **Gmail:** set `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER=<your Gmail>`, `SMTP_PASSWORD=<16-character App Password>` (no spaces), and `SMTP_FROM=KATHAVOX <your Gmail>`. An App Password needs 2-Step Verification turned on for that Google account. Each sent email is logged as `[mail] sent to=… from=…`.
- **Production:** use a sending service (for example Brevo, Mailgun or Amazon SES) with your own domain.

Account emails link to `FRONTEND_*_PATH` on `FRONTEND_ORIGIN`, so local links open `http://localhost:4200/auth/…`.

## 7. Accounts for testing

Created by `npm run seed` (passwords are in your local `.env`, not here):

| Role | Email | Use |
|---|---|---|
| Admin | `ADMIN_SEED_EMAIL` | Admin portal, approvals, payments, PDF export |
| Author | `sample.author@kathaverse.local` | Author portal |
| Reader | `sample.reader@kathaverse.local` | Library, purchases, subscriptions |

Guests need no account. New authors register at `/auth/register` and must verify their email first. New readers register and set a password from an emailed link.

## 8. Main screens

| Area | Address | Who |
|---|---|---|
| Home and search | `/` | Everyone |
| Story and reader | `/story/:slug`, `/story/:slug/page/:n` | Everyone (locked pages need a purchase or subscription) |
| Subscriptions | `/subscriptions` | Everyone |
| My library | `/reader/my-library` | Reader |
| Login, register, reset | `/auth/login`, `/auth/register`, `/auth/forgot-password` | Everyone |
| Author portal | `/author/dashboard`, `/author/stories` | Author |
| Admin dashboard and stories | `/admin/dashboard`, `/admin/stories` | Admin |
| Admin payments | `/admin/payments` | Admin (filters, Search, Export to Excel) |
| Catalogue, subscription plans | `/admin/catalogue`, `/admin/subscription-plans` | Admin |

## 9. Business rules (short)

- **Story workflow:** draft → submit → pending approval → approved (published) or rejected. A rejected story can't be published; the author edits it and submits again. Author edits to a published story go to pending approval, and readers keep the approved version until then.
- **Drafts:** an author's draft is hidden from the admin until it is submitted.
- **Sessions:** the access token lasts 5 minutes and the refresh token 5 hours. The browser renews the access token automatically. When the refresh token ends, the user is sent to log in again. The refresh token is kept per browser tab (sessionStorage).
- **Payments:** amounts are calculated on the server in paise. A payment counts only after Razorpay confirms the capture and the amount matches. The admin dashboard and payments list show only successful payments.
- **Revenue:** gross amounts only. Razorpay fees and any author share are not calculated yet.

## 10. Book PDF export (admin)

The admin stories list has a download icon. It creates an A4 book from the published version: cover, title and details page, then one page per story page with a running title, a thin rule and the page number. Odia text uses `story-service/assets/fonts/NotoSansOriya-Regular.ttf`, set by `PDF_FONT_PATH`.

## 11. Configuration rules

- **Backend:** every setting comes from `story-service/.env`. `.env.example` lists all keys. Typed access is in `story-service/src/config/app-config.ts`. No silent defaults.
- **Frontend:** API base path, brand name and CSRF header are in `story-web/src/environments/environment.ts`.
- **Labels and messages:** website text is in `story-web/src/app/core/i18n/en.json` (used with the `translate` pipe). API and email text is in `story-service/src/i18n/en.json`.
- The CSRF header must match on both sides: `CSRF_HEADER_NAME` / `CSRF_HEADER_VALUE` in `.env` and `csrfHeaderName` / `csrfHeaderValue` in `environment.ts`.
- **Time zone for payment reports:** `PAYMENTS_UTC_OFFSET_MINUTES=330` (India). "Today" in the payments list uses this offset.

## 12. Troubleshooting

| Problem | Check |
|---|---|
| API won't start: "missing key" | Compare `story-service/.env` with `.env.example`. |
| `ECONNREFUSED` on the website | Start the API first (`npm run start:dev` in `story-service`). |
| Database errors on start | `DATABASE_*` values, PostgreSQL running, and `npm run migration:run` done. |
| Login says "Invalid email or password" | Run `npm run seed` again; check the seed email and password in `.env`. |
| Sign-up or reset email not received | `SMTP_HOST` empty means console only. For Gmail, check the App Password and Spam folder. |
| Payment says "keys rejected" | Test keys in `.env` are wrong or from another account. Restart the API after changing them. |
| Uploaded images missing | `UPLOAD_DIRECTORY` must point to `upload_image`; restart the API. |
| Odia text shows as boxes in the PDF | `PDF_FONT_PATH` must point to the Noto Sans Oriya file. |
| Port already in use | Stop the other process on 8080 or 4200, or change `PORT` (and `proxy.conf.json` for 8080). |

## 13. Git

```powershell
git status
git add -A
git commit -m "Describe the change"
git push
```

Repository: https://github.com/pareswar123/KATHAVOX
