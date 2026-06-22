# OBI Automation — Monthly Cost Report

**Question answered:** what does running the 4 maintenance crons cost per month, using
**Claude (best + cheapest)** vs **Gemini**, and **combined to offset** cost?

All figures are **usage-based estimates**. Link/redirect/HTTP checks are free (no model
tokens) — cost comes only from the LLM reading page text + config and writing JSON findings
and patches. Pricing below is current standard API pricing (verified Q2 2026).

---

## Model pricing used (per 1M tokens)

| Model | Input | Output | Batch input* | Batch output* | Best for |
|-------|-------|--------|--------------|---------------|----------|
| **Claude Haiku 4.5** (cheapest Claude) | $1.00 | $5.00 | $0.50 | $2.50 | Safe patch generation |
| **Claude Sonnet 4.5** (best) | $3.00 | $15.00 | $1.50 | $7.50 | Complex/structural patches |
| **Gemini 2.5 Flash** | $0.30 | $2.50 | ~$0.15 | ~$1.25 | Mixed reasoning |
| **Gemini 2.5 Flash-Lite** (cheapest overall) | $0.10 | $0.40 | ~$0.05 | ~$0.20 | Bulk crawl/classification |

\* Batch API = 50% off, async. All four crons are scheduled/async, so batch applies cleanly.
Prompt caching (config reused every run) can cut input further (~$0.10/M cache reads on Claude).

---

## Estimated monthly token volume

Assumptions: conversion-guard **daily** (30 runs), the other three **weekly** (4 runs each).
Token counts are page text + config in, JSON findings + patches out.

| Cron | Runs/mo | Input/run | Output/run | Input/mo | Output/mo |
|------|--------:|----------:|-----------:|---------:|----------:|
| conversion-guard  | 30 | 120K | 15K | 3.60M | 0.45M |
| content-engine    | 4  | 250K | 30K | 1.00M | 0.12M |
| serp-monitor      | 4  | 80K  | 15K | 0.32M | 0.06M |
| gsc-opportunity   | 4  | 100K | 20K | 0.40M | 0.08M |
| **Total**         |    |      |     | **≈5.3M** | **≈0.7M** |

---

## Cost per strategy (per month)

| Strategy | Input cost | Output cost | **Total / mo** | Notes |
|----------|-----------:|------------:|---------------:|-------|
| **All Claude Haiku 4.5** (standard) | $5.30 | $3.50 | **≈ $8.80** | Simplest; one model |
| **All Claude Haiku 4.5** (batch) | $2.65 | $1.75 | **≈ $4.40** | Async batch, 50% off |
| **All Gemini 2.5 Flash** (standard) | $1.59 | $1.75 | **≈ $3.34** | Cheaper, good quality |
| **All Gemini 2.5 Flash-Lite** (standard) | $0.53 | $0.28 | **≈ $0.81** | Cheapest; lower reasoning |
| **Combined / offset (recommended)** | — | — | **≈ $3–4** | See split below |

### Recommended "combined to offset" split
Route by task so you pay premium rates only where quality matters:

| Workload | Model | Est. tokens/mo | Cost/mo |
|----------|-------|----------------|--------:|
| Crawl, detection, classification, GSC segmentation (bulk) | Gemini 2.5 Flash-Lite | 4.5M in / 0.3M out | ≈ $0.57 |
| Safe patch generation (CTA copy, meta, FAQ, internal links) | Claude Haiku 4.5 | 0.8M in / 0.4M out | ≈ $2.80 |
| Occasional complex/structural patches | Claude Sonnet 4.5 | 0.1M in / 0.05M out | ≈ $1.05 |
| **Combined total** | | | **≈ $4.40** |

Apply **batch (50% off)** to the Claude portion and the combined total drops to **≈ $2.50/mo**.

---

## Bottom line

- **Cheapest that still writes good patches:** combined routing (Gemini Flash-Lite for bulk +
  Claude Haiku for patches) ≈ **$2.50–4.40/month**.
- **Absolute cheapest:** Gemini Flash-Lite only ≈ **$0.81/month** (weaker on nuanced patch copy).
- **Simplest single-model:** Claude Haiku 4.5 on batch ≈ **$4.40/month**.
- **Premium quality everywhere:** Claude Sonnet 4.5 only would be ≈ $20–25/month — not needed;
  reserve Sonnet for the rare structural fix.

**Recommendation:** run the bulk detection on **Gemini 2.5 Flash-Lite**, generate patches on
**Claude Haiku 4.5 (batch)**, and escalate only genuinely structural edits to **Claude Sonnet 4.5**.
That keeps the entire autonomous layer at roughly the price of a cup of coffee per month while
keeping patch quality high. These are model-token costs; if you route through Abacus AI, platform
credits/included tiers may absorb part or all of this.
