# Wedding Budget Calculator · מתחתנים בראש שקט

A Hebrew-first (RTL) wedding planning web app for couples in Israel:

- **Budget calculator** (`/`) — guests and attendance, meal price with a guaranteed minimum,
  optional **reserves** (pay only for reserve guests who come), gifts with optional **family gifts**,
  editable expenses with undo, a live summary (profit/loss, break-even gift and meal price),
  an outdated-result state for invalid input, and what-if sliders.
- **Wedding task planner** (`/tasks`) — a simple checklist with progress, inline editing,
  completion, delete with undo.

No sign-up and no backend: everything is stored only in the browser (`localStorage`).
Results are estimates, not financial advice. Prices are assumed to include VAT.

## Stack

- React 19 + Vite (JavaScript), React Router
- Plain CSS with design tokens (`src/styles/tokens.css`)
- Vitest + Testing Library (jsdom), ESLint

## Scripts

```bash
npm install
npm run dev         # local dev server (http://localhost:5173)
npm run test        # run all tests once
npm run test:watch  # watch mode
npm run lint
npm run build       # production build to dist/
npm run preview     # serve the production build (http://localhost:4173)
```

## Structure

```
src/
  lib/          pure logic (no React): budget.js, validation.js, budgetState.js,
                budgetStorage.js, taskState.js, taskStorage.js, safeStorage.js, format.js
  components/   shared UI (Hero, SiteNav, SiteFooter, Icon, Botanicals, AnimatedMoney, UndoToast…)
    calculator/ calculator UI (EventDetailsForm, ExpensesList, BudgetSummary, WhatIfPanel…)
    tasks/      task planner UI (TaskComposer, TaskList, TaskItem, TaskProgress, TasksHeader)
  pages/        CalculatorPage, TasksPage, NotFoundPage
  styles/       tokens.css, base.css, components.css
```

Storage keys: `wedding-budget:v3` (calculator) and `wedding-budget:tasks:v1` (tasks).
Stored data is versioned and sanitized on load; corrupted data falls back to defaults.
Calculator data saved by earlier versions (`wedding-budget:v2`, then `wedding-budget:v1`) is
migrated once on load. Older keys are never written or deleted, so a rollback still finds them.

## Calculation model (summary)

- Base guests = round(invited × attendance %). Regular meals billed = max(base guests, guaranteed minimum).
- **Reserves**: reserve guests come in addition to the base estimate (never more than the reserve
  places). Only reserve guests who come are paid for: they first fill guaranteed meals that are paid
  but unused (never charged twice); only the rest is billed at the reserve meal price. No reserve
  guests → no reserve cost and no reserve gifts. Empty reserve meal price / gift (under "advanced
  settings") = same as the regular meal price / average gift.
- **Family gifts** (when enabled) are fixed income on top of guest gifts — they must not also be part
  of the average guest gift. Scenario sliders change neither reserve guests nor family gifts.
- Break-even gift = the minimum whole-shekel *average gift* that breaks even; break-even meal price =
  the maximum whole-shekel *regular* meal price that breaks even (reserve meals follow it unless overridden).
- **Migration of prepaid reserve meals** (v1 "reserve meals", v2 "prepaid" model): places and guests are
  kept, and a one-time notice shows what the prepaid meals used to cost. One click adds the exact
  difference as an expense ("מנות רזרבה ששולמו מראש"), restoring the previous balance exactly.

## Design reference

`design-preview/index.html` (calculator) and `design-preview/tasks.html` (task planner) are the
approved, self-contained visual prototypes. They are references only and are not imported by the app.

## Personal photo

- `design-preview/images/couple.png` — the original, full-resolution photo. **Never committed**
  (ignored in `.gitignore`).
- `public/images/couple-640.jpg`, `couple-1280.jpg`, `couple-1672.jpg` — optimized copies used by
  the app, **tracked and published** (publication approved). Re-encoded from the original, so they
  carry no EXIF/GPS/XMP metadata. Source formats (PNG/HEIC/TIFF/RAW) in `public/images/` are ignored
  as a safeguard.

If the photos are missing, the app shows a decorative placeholder instead.

## Deployment

`vercel.json` rewrites every path to `index.html` so direct URLs such as `/tasks` work.

`vercel.json` also sets security headers (CSP, `X-Frame-Options`, `nosniff`, referrer and
permissions policies) and long-term caching for the hashed files in `/assets`.
