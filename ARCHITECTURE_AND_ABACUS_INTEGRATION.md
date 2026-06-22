# OBI Blood Donor Site — Architecture & Abacus AI Integration Guide

_Last updated: June 2026_

This document explains how the **oklahomabloodinstitute.com** ("OBI Blood Donor") website is
built, how its pages and schema are organized, and how it can be maintained / extended going
forward using **Abacus AI workflows** with cost-effective (free / low-cost) models.

---

## 1. Site Purpose

A lead-generation and education site for blood donation across Oklahoma (modeled on the
Oklahoma Blood Institute). Its goals:

- Drive donors to **schedule appointments** (via embedded Donable booking forms / QR codes).
- Rank in search (SEO/AEO) for local "donate blood in <city>" queries.
- Educate donors on **eligibility, blood types, the donation process, and compensation**.
- Surface **12 certified donor centers** and mobile blood drives statewide.

The site was originally generated with zoer.ai and is now self-hosted as a small Node app.

---

## 2. Technology Stack

| Layer        | Technology                                                            |
|--------------|------------------------------------------------------------------------|
| Server       | **Node.js + Express** (`server.js`, ~2k lines)                         |
| Templating   | Static HTML files in `views/` + a custom **HTML transformation engine** |
| Styling      | **Tailwind CSS** (pre-purged to `public/css/tailwind-purged.css`) + small inline `<style>` blocks and `public/css/styles.css` |
| Booking      | **Donable** embedded `<iframe>` + QR codes (external SaaS)             |
| Data         | `data/locations.json` (canonical 12-center address data)              |
| Hosting      | **Render** (Node web service); auto-deploys on push to `main`         |
| CDN / DNS    | **Cloudflare** (proxy mode)                                            |
| DB (optional)| PostgreSQL on Render (`pg`) — only for donor signups, currently light |

There is **no React/Vue/build step** — pages are plain HTML strings transformed at request time.

---

## 3. File / Directory Layout

```
AK-BDINST/
├── server.js                 # Express app + HTML transform engine + all routes
├── package.json              # express + pg; start = "node server.js"
├── data/locations.json       # canonical OBI center addresses (12 centers)
├── views/                    # page templates (served & transformed by server.js)
│   ├── index.html            # homepage (hero, trust strip, schedule form, drives, FAQ)
│   ├── blog.html             # blog index — 30-article responsive grid
│   ├── blog/<city>-guide.html, <city>-tips.html   # per-city long-form articles
│   ├── blood-types/<type>.html                    # O+, O-, A+, ... blood type guides
│   ├── locations.html, locations/                 # donor center pages
│   ├── guides/, questions/, faq.html, contact.html, about.html, etc.
│   └── campuses/ (OU, OSU drives), plasma/, platelets/, donate/, donate-blood/
├── public/                   # static assets (served with 7d cache)
│   ├── css/ (tailwind-purged.css, styles.css)
│   ├── images/ (centers, drives, logo, QR, emergency-blood-shortage.png)
│   ├── js/, videos/, blog/ (static copies), robots.txt, sitemap.xml
├── sitemap.xml               # full sitemap (also served dynamically)
├── schema-audit/             # reference HTML used to validate JSON-LD schema
└── skills/                   # generator skill for plasma/city pages
```

### How a page is served (request lifecycle)

1. Route in `server.js` (e.g. `app.get('/blog', ...)`) reads a file from `views/`.
2. `transformHtml()` runs over the raw HTML and:
   - Injects the **canonical header** at `<!--SYM:HEADER-->` and **footer** at `<!--SYM:FOOTER-->`
     (defined once as `SYM_HEADER` / `SYM_FOOTER` constants — single source of truth for nav).
   - Swaps the Tailwind CDN script for the purged stylesheet (saves ~440 KB).
   - Fixes year strings (2024 → 2026) on blog content.
   - Injects **JSON-LD structured data** (BlogPosting, Author/Publisher, breadcrumbs).
   - Corrects center addresses from `data/locations.json`.
3. Response is sent with security headers + cache headers.

> **Key takeaway for editing:** global header/nav/footer changes go in the `SYM_HEADER`/
> `SYM_FOOTER` constants in `server.js`. Page-specific content goes in the `views/*.html` file.

---

## 4. Schema / SEO Model

The site is heavily structured-data driven (important for AEO / answer engines):

- **MedicalOrganization** + **WebSite** + **DonateAction** on the homepage.
- **BlogPosting** + **Person** (author) + **Organization** (publisher) on each blog post,
  injected dynamically via `options.blogSlug` in `transformHtml()`.
- **BreadcrumbList** for nested pages.
- A full `sitemap.xml` plus `robots.txt`; `.html` blog URLs 301-redirect to clean URLs.

Content taxonomy on the blog: **Complete Guides**, **Local Tips**, **Compensation Info**,
keyed per Oklahoma city (OKC, Tulsa, Norman, Edmond, Lawton, Broken Arrow, Enid, Ada,
Ardmore, Yukon, Stillwater).

---

## 5. Changes Made in This Update

1. **Emergency Blood Shortage banner** added to the homepage hero, above the phone CTA
   (`/images/emergency-blood-shortage.png`), width-matched to the phone CTA (~340 px).
2. **Heartbeat CSS animation** (`@keyframes heartbeat`, class `.emergency-banner`) — smooth
   continuous pulse; respects `prefers-reduced-motion`.
3. **Removed the middle "Schedule your donation" form** on the homepage (hero form + final
   CTA form retained). The `#schedule-form` anchor was repointed to the final CTA section so
   existing in-page links still work.
4. **Fixed the blog grid layout** — three article cards had a malformed `<img>` tag whose
   `alt` attribute swallowed the `<div class="p-5">` opening, and there were two orphan
   `</div>` tags. This broke the CSS grid so the bottom rows rendered out of order. Tags were
   repaired and the grid now renders cleanly **3 per row**.
5. **White announcement-bar text** — the top red bar link now uses explicit white so it is
   readable.

---

## 6. Managing the Site with Abacus AI Workflows (Cost-Effective)

Because content is just HTML files + JSON-LD, Abacus AI workflows can automate most ongoing
work without expensive models. Recommended setup:

### 6.1 Model selection (keep costs low)
- Use **cost-effective / free-tier chat models** available in Abacus AI (e.g. the smaller/fast
  general models) for content drafting and HTML edits — these tasks are not reasoning-heavy.
- Reserve larger models only for occasional bulk SEO strategy or schema audits.

### 6.2 High-value workflow ideas
1. **City / Blog page generator** — there is already a `skills/obi-plasma-city-page-generator`.
   An Abacus workflow can take a city name + facts and emit a `views/blog/<city>-guide.html`
   and `<city>-tips.html` following the existing card/JSON-LD template, then open a PR.
2. **Emergency-shortage updater** — a scheduled workflow that flips the announcement bar /
   emergency banner copy (and toggles the heartbeat banner) when a shortage is declared.
3. **Schema/SEO auditor** — a workflow that crawls each route, extracts JSON-LD, and checks it
   against the references in `schema-audit/`, flagging missing/invalid structured data.
4. **Content freshness** — auto-update year strings, compensation rates, and "last updated"
   dates across `views/blog/`.
5. **FAQ / Q&A expansion** — generate new `views/questions/<topic>.html` entries from common
   donor questions and link them from the blog index.

### 6.3 Suggested integration pattern
```
Abacus AI Workflow
   │  (LLM step: generate/modify HTML using the views/ template as a few-shot example)
   ▼
GitHub (commit to a feature branch → PR)  ──►  Render auto-deploy on merge to main
```
- Use the Abacus AI Python SDK (`import abacusai; client = abacusai.ApiClient()`) inside a
  workflow step; discover the right calls with `client.suggest_abacus_apis(...)`.
- Keep `data/locations.json` as the single source of truth that workflows read from, so
  generated pages always use correct addresses.
- Always write changes as a **PR** so a human can review before the Render deploy.

### 6.4 Deployment note
Render is connected to `p3nta3mpi3r-AI/AK-BDINST`; **pushing/merging to `main` triggers an
automatic deploy**. No build step is required beyond `npm install` + `node server.js`.

---

## 7. Local Development

```bash
npm install
PORT=3000 node server.js
# open http://localhost:3000
```
Routes of interest: `/` (homepage), `/blog/` (blog index), `/locations`, `/blood-types`,
`/faq`, `/contact`.
