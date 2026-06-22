# OBI Automation Layer

This folder contains the **autonomous maintenance crons** for oklahomabloodinstitute.com and
the **source-of-truth config** that lets them patch safely without drifting into unsafe edits.

> **The core principle (kept at the top of every prompt):**
> Every cron job must produce a **proposed fix**, not just a status report.
> ```
> if issue_detected == true and proposed_fix == empty:
>     status = FAIL
> ```

---

## What's here (Phase 1 — Option A)

```
automation/
├── prompts/
│   ├── obi-conversion-guard.md       # revenue/scheduling path integrity
│   ├── obi-content-engine.md         # content freshness + local intent
│   ├── obi-serp-monitor.md           # ranking defense / on-page SEO
│   └── obi-gsc-opportunity-miner.md  # Search Console opportunity → fixes
├── config/
│   ├── money-pages.yaml              # conversion-critical URLs (seeded from repo)
│   ├── approved-scheduling-domains.yaml  # allowed CTA destinations (Donable etc.)
│   ├── cta-map.yaml                  # canonical CTA copy + targets (from markup)
│   └── keyword-clusters.yaml         # keyword groups → intended landing pages
├── COST_REPORT.md                    # monthly cost: Claude vs Gemini vs combined
└── README.md                         # this file
```

The 4 config files are **seeded with real data pulled from this repo** (Donable booking
URL, `data/locations.json` city keys, `data-ga-cta` hooks already in the markup, phone
numbers, route list). They are ready to use, not empty stubs.

### Not yet included (expand later)
The original spec also lists these configs — add them incrementally as you wire each cron to
live data sources (GSC, rank tracker):
`location-source-of-truth.yaml`, `content-freshness-rules.yaml`, `internal-linking-rules.yaml`,
`protected-medical-copy.yaml`, `priority-landing-pages.yaml`, `title-meta-templates.yaml`,
`gsc-thresholds.yaml`, `query-intent-rules.yaml`, `faq-patterns.yaml`, plus the two recommended
extra cron classes (location-consistency monitor, schema/internal-link integrity monitor).

---

## How to run these (Abacus AI scheduled tasks)

Each prompt is designed to be the system/task prompt for a scheduled Claude Code (or Abacus AI
agent) run. Recommended cadence:

| Cron                       | Cadence  | Why |
|----------------------------|----------|-----|
| obi-conversion-guard       | Daily    | Protects the money path; catches broken CTAs fast |
| obi-content-engine         | Weekly   | Freshness + local intent drift is slow-moving |
| obi-serp-monitor           | Weekly   | Ranking shifts week-over-week |
| obi-gsc-opportunity-miner  | Weekly   | Matches GSC's data latency |

**Wiring pattern (hands-off, PR-based):**
1. Scheduled task loads the relevant prompt + `automation/config/*.yaml`.
2. Agent crawls the pages / pulls the data it needs (HTTP fetches are free — no model cost).
3. Agent emits the JSON findings (schema is in each prompt) **with a `proposed_fix` per issue**.
4. For `safe_to_autopatch: true` items above the confidence threshold, the agent:
   - creates a branch `auto/<cron>-<date>`,
   - commits the patch,
   - opens a PR (never merges automatically).
5. Render auto-deploys on merge to `main` (after your review).

Secrets (GitHub token, Render key, GSC creds) must be provided to the scheduled task as
environment/config — never hard-coded in these files.

---

## Model selection (cost-effective)

See **COST_REPORT.md** for the full monthly breakdown. Summary:

- **Bulk crawl / detection / classification** → Gemini 2.5 Flash-Lite (cheapest) or Flash.
- **Safe patch generation (copy, metadata, FAQ)** → Claude Haiku 4.5 (cheap, high quality).
- **Complex / structural patches** → Claude Sonnet 4.5 (best), used sparingly.
- All four crons are **async** → run them through the **Batch API (50% off)** wherever possible.

This "combined to offset" routing keeps the whole automation layer in the **~$1–5/month** range.
