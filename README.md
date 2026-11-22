# Wedding Budget Calculator · מתחתנים בראש שקט

A Hebrew-first (RTL) wedding budget calculator for couples planning a wedding in Israel:
estimate total costs, expected gift income and the projected balance — no sign-up,
data stays in the browser.

## Stack

- React + Vite (JavaScript)
- Plain CSS with design tokens (`src/styles/tokens.css`)
- Vitest + Testing Library (jsdom)
- ESLint

## Scripts

```bash
npm install
npm run dev         # local dev server
npm run test        # run tests once
npm run test:watch  # run tests in watch mode
npm run lint
npm run build       # production build to dist/
npm run preview     # serve the production build locally
```

## Design reference

`design-preview/index.html` is the approved, self-contained visual prototype.
It is a reference only and is not imported by the application.
The original couple photo (`design-preview/images/`) is intentionally not tracked in Git.
