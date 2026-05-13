# oklahomabloodinstitute.com - Deployment Guide

## Architecture

- **Hosting**: Render (Node.js web service)
- **CDN/DNS**: Cloudflare (proxy mode)
- **Server**: Express.js with HTML transformation middleware
- **Database**: PostgreSQL on Render (optional, for donor signups)

## Deploying to Render

### Automatic Deploy

The Render service is connected to the GitHub repo `p3nta3mpi3r-AI/AK-BDINST`. Pushing to `main` triggers an automatic deploy.

```bash
git add .
git commit -m "description of changes"
git push origin main
```

Render will detect the push, run `npm install`, and start the server with `node server.js`.

### Manual Deploy

From the Render dashboard:
1. Go to your web service
2. Click "Manual Deploy" > "Deploy latest commit"

### Environment Variables (Render)

Set these in the Render dashboard under Environment:

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port (Render sets this automatically) | No |
| `DATABASE_URL` | PostgreSQL connection string for signups | No |

## Google Search Console Setup

1. Go to https://search.google.com/search-console
2. Add property: `https://oklahomabloodinstitute.com`
3. Choose "URL prefix" verification method
4. Select "HTML file" verification
5. Download the verification file (e.g., `google1234abcd.html`)
6. The server already handles `/google:verificationCode.html` routes dynamically
7. Click "Verify" in GSC

### After Verification

1. Submit the sitemap: go to Sitemaps > enter `sitemap.xml` > Submit
2. Request indexing for priority pages:
   - `/` (homepage)
   - `/schedule`
   - `/locations`
   - `/blog`
3. Monitor Coverage report for crawl errors

## Cloudflare Configuration

### DNS

Ensure the domain points to Render with proxy enabled (orange cloud):

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| CNAME | @ | your-service.onrender.com | Proxied |
| CNAME | www | your-service.onrender.com | Proxied |

### SSL/TLS

- Mode: **Full (strict)**
- Always Use HTTPS: **On**
- Minimum TLS Version: **1.2**

### Caching

The server already sends proper `Cache-Control` headers:

- **HTML pages**: `public, max-age=300, s-maxage=3600, stale-while-revalidate=86400`
  - Browser: 5 minutes
  - CDN (Cloudflare): 1 hour
  - Stale-while-revalidate: 24 hours
- **Static assets** (CSS, JS): `public, max-age=604800, immutable` (7 days)
- **Sitemap**: `public, max-age=86400` (1 day)

### Page Rules (Optional)

If you want to override or supplement server headers:

1. `oklahomabloodinstitute.com/css/*` - Cache Level: Cache Everything, Edge TTL: 1 month
2. `oklahomabloodinstitute.com/images/*` - Cache Level: Cache Everything, Edge TTL: 1 month
3. `oklahomabloodinstitute.com/api/*` - Cache Level: Bypass

### Speed Optimizations

Under Speed > Optimization:
- Auto Minify: HTML, CSS, JS
- Brotli compression: On
- Early Hints: On
- Rocket Loader: Off (can break inline scripts)

## IndexNow Submission

IndexNow notifies search engines (Bing, Yandex, DuckDuckGo) about new or updated pages immediately.

### Verification

The IndexNow key is already served at:
```
https://oklahomabloodinstitute.com/1acaceda82049435cdc869f315b88148.txt
```

### Submit URLs

Submit a single URL:
```bash
curl "https://api.indexnow.org/indexnow?url=https://oklahomabloodinstitute.com/&key=1acaceda82049435cdc869f315b88148"
```

Submit multiple URLs in batch:
```bash
curl -X POST "https://api.indexnow.org/indexnow" \
  -H "Content-Type: application/json" \
  -d '{
    "host": "oklahomabloodinstitute.com",
    "key": "1acaceda82049435cdc869f315b88148",
    "urlList": [
      "https://oklahomabloodinstitute.com/",
      "https://oklahomabloodinstitute.com/schedule",
      "https://oklahomabloodinstitute.com/locations",
      "https://oklahomabloodinstitute.com/blog",
      "https://oklahomabloodinstitute.com/how-it-works",
      "https://oklahomabloodinstitute.com/blood-types",
      "https://oklahomabloodinstitute.com/questions",
      "https://oklahomabloodinstitute.com/about",
      "https://oklahomabloodinstitute.com/locations/oklahoma-city",
      "https://oklahomabloodinstitute.com/locations/tulsa",
      "https://oklahomabloodinstitute.com/locations/norman",
      "https://oklahomabloodinstitute.com/locations/edmond",
      "https://oklahomabloodinstitute.com/locations/broken-arrow",
      "https://oklahomabloodinstitute.com/locations/lawton",
      "https://oklahomabloodinstitute.com/locations/enid",
      "https://oklahomabloodinstitute.com/locations/yukon",
      "https://oklahomabloodinstitute.com/locations/ardmore",
      "https://oklahomabloodinstitute.com/locations/ada"
    ]
  }'
```

A `202 Accepted` response means the URLs were queued for crawling.

## What the Server Fixes at Runtime

The `transformHtml()` middleware in `server.js` applies these fixes to every HTML response without modifying the static files in `views/`:

1. **Tailwind CDN removal**: Replaces `<script src="https://cdn.tailwindcss.com"></script>` with `<link rel="stylesheet" href="/css/tailwind-purged.css">`, saving ~440KB of render-blocking JavaScript per page load.

2. **Year correction**: On blog and news pages, replaces "2024" with "2026" in titles, schema markup dates, and content references.

3. **Address correction**: On location and donate-blood pages, replaces fabricated addresses, phone numbers, and hours with verified data from `data/locations.json`. This fixes both visible text and JSON-LD structured data.

## Troubleshooting

### Pages show old content after deploy
Cloudflare may serve cached versions. Purge cache:
- Cloudflare Dashboard > Caching > Purge Everything
- Or purge specific URLs via API

### Location data not loading
Check server logs for `data/locations.json not found`. Ensure the file exists in the repo root under `data/`.

### Signups not saving to database
Check that `DATABASE_URL` is set in Render environment variables. The server falls back to logging signups to stdout if the database is unavailable.

### 404 errors on valid pages
Ensure the corresponding `.html` file exists in the `views/` directory on the Render server. The `views/` directory is not in the repo - it is deployed separately to the Render instance.
