const express = require('express');
const path    = require('path');
const fs      = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;
const VIEWS = path.join(__dirname, 'views');

// ─── Correct OBI location data ──────────────────────────────────────
let locationData = {};
try {
  locationData = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'data', 'locations.json'), 'utf8')
  );
} catch (e) {
  console.warn('data/locations.json not found, address corrections disabled');
}

// ─── Static files ───────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '7d',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.css') || filePath.endsWith('.js')) {
      res.set('Cache-Control', 'public, max-age=604800, immutable');
    }
  }
}));

// ─── Body parser for API ────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── HTML Transformation Engine ─────────────────────────────────────
// Replaces: Tailwind CDN -> purged CSS, 2024->2026, fake->real addresses

function transformHtml(html, options = {}) {
  let h = html;

  // 1) Swap Tailwind CDN for purged CSS (saves ~440KB)
  h = h.replace(
    /<script\s+src="https:\/\/cdn\.tailwindcss\.com"><\/script>/gi,
    '<link rel="stylesheet" href="/css/tailwind-purged.css">'
  );

  // Remove Tailwind config <script> block and replace with essential utility styles
  h = h.replace(
    /<script>\s*tailwind\.config\s*=\s*\{[\s\S]*?\}\s*<\/script>/gi,
    `<style>
@keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
.animate-marquee{animation:marquee 60s linear infinite}
.text-primary{color:#b91c1c}
.bg-primary{background-color:#b91c1c}
.hover\\:bg-primary-hover:hover{background-color:#991b1b}
.bg-primary-light{background-color:#fef2f2}
</style>`
  );

  // 2) Fix blog years: 2024 -> 2026
  if (options.fixYear) {
    h = h.replace(/2024 Guide/g, '2026 Guide');
    h = h.replace(/\(2024 Rates/g, '(2026 Rates');
    h = h.replace(/Guide 2024\)/g, 'Guide 2026)');
    h = h.replace(/Updated 2024/g, 'Updated 2026');
    h = h.replace(/"datePublished"\s*:\s*"2024/g, '"datePublished":"2026');
    h = h.replace(/"dateModified"\s*:\s*"2025/g, '"dateModified":"2026');
  }

  // 3) Fix location addresses
  if (options.locationSlug) {
    const loc = locationData[options.locationSlug];
    if (loc) {
      const fullAddr = `${loc.address}, ${loc.city}, ${loc.state} ${loc.zip}`;

      // Replace ALL "streetAddress" values in JSON-LD
      h = h.replace(
        /"streetAddress"\s*:\s*"[^"]*"/g,
        `"streetAddress":"${loc.address}"`
      );
      h = h.replace(
        /"postalCode"\s*:\s*"[^"]*"/g,
        `"postalCode":"${loc.zip}"`
      );
      h = h.replace(
        /"addressLocality"\s*:\s*"[^"]*"/g,
        `"addressLocality":"${loc.city}"`
      );

      // Replace ALL phone numbers in JSON-LD and visible text
      h = h.replace(
        /"telephone"\s*:\s*"\([^"]*"/g,
        `"telephone":"${loc.phone}"`
      );
      h = h.replace(
        /"servicePhone"\s*:\s*"\([^"]*"/g,
        `"servicePhone":"${loc.phone}"`
      );

      // Replace opening hours in schema
      if (loc.openingHoursSpec) {
        h = h.replace(
          /"openingHours"\s*:\s*\[[^\]]*\]/g,
          `"openingHours":${JSON.stringify(loc.openingHoursSpec)}`
        );
      }

      // Replace the visible address line (after map-pin SVG, before next tag)
      // Pattern: map pin SVG closing tags then address text
      h = h.replace(
        /(<\/circle>\s*<\/svg>\s*)[^<]+,\s*[A-Z][a-z]+[^<]*,\s*OK\s+\d{5}/,
        `$1${fullAddr}`
      );

      // Replace the visible phone line (after phone SVG)
      h = h.replace(
        /(stroke-linejoin="round"><path d="M22 16\.92[\s\S]*?<\/svg>\s*)\([^)]+\)\s*[\d-]+/,
        `$1${loc.phone}`
      );

      // Fix the center name in schema
      h = h.replace(
        /"name"\s*:\s*"[^"]*Blood Donor Center"/g,
        `"name":"${loc.name}"`
      );

      // Fix FAQ answers that reference the address
      h = h.replace(
        /located at [^.]+\./g,
        `located at ${fullAddr}. This center accepts whole blood, plasma, and platelet donations.`
      );
      h = h.replace(
        /Call \([^)]+\) [\d-]+ to confirm/g,
        `Call ${loc.phone} to confirm`
      );
    }
  }

  return h;
}

// Helper: serve HTML with transformations
function serveHtml(filePath, res, options = {}) {
  fs.readFile(filePath, 'utf8', (err, html) => {
    if (err) {
      const notFound = path.join(VIEWS, '404.html');
      if (fs.existsSync(notFound)) {
        return res.status(404).sendFile(notFound);
      }
      return res.status(404).send('Page not found');
    }
    const transformed = transformHtml(html, options);
    // Cache HTML for 1 hour at CDN, 5 min in browser
    res.set(
      'Cache-Control',
      'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400'
    );
    res.type('html').send(transformed);
  });
}

// ─── Page Routes ────────────────────────────────────────────────────

app.get('/', (req, res) => {
  serveHtml(path.join(VIEWS, 'index.html'), res);
});

app.get('/schedule', (req, res) => {
  serveHtml(path.join(VIEWS, 'schedule.html'), res);
});

app.get('/locations', (req, res) => {
  serveHtml(path.join(VIEWS, 'locations.html'), res);
});

app.get('/how-it-works', (req, res) => {
  serveHtml(path.join(VIEWS, 'how-it-works.html'), res);
});

app.get('/blood-types', (req, res) => {
  serveHtml(path.join(VIEWS, 'blood-types.html'), res);
});

app.get('/questions', (req, res) => {
  serveHtml(path.join(VIEWS, 'questions.html'), res);
});

app.get('/about', (req, res) => {
  serveHtml(path.join(VIEWS, 'about.html'), res);
});

app.get('/blog', (req, res) => {
  serveHtml(path.join(VIEWS, 'blog.html'), res, { fixYear: true });
});

app.get('/privacy', (req, res) => {
  serveHtml(path.join(VIEWS, 'privacy.html'), res);
});

app.get('/privacy-policy', (req, res) => {
  serveHtml(path.join(VIEWS, 'privacy-policy.html'), res);
});

app.get('/faq', (req, res) => {
  serveHtml(path.join(VIEWS, 'faq.html'), res);
});

app.get('/guides', (req, res) => {
  serveHtml(path.join(VIEWS, 'guides.html'), res);
});

// Guides detail pages
app.get('/guides/:slug', (req, res) => {
  serveHtml(path.join(VIEWS, 'guides', `${req.params.slug}.html`), res);
});

// Location detail pages
app.get('/locations/:slug', (req, res) => {
  serveHtml(
    path.join(VIEWS, 'locations', `${req.params.slug}.html`),
    res,
    { locationSlug: req.params.slug }
  );
});

// Blog detail pages
app.get('/blog/:slug', (req, res) => {
  serveHtml(
    path.join(VIEWS, 'blog', `${req.params.slug}.html`),
    res,
    { fixYear: true }
  );
});

// Questions detail pages
app.get('/questions/:slug', (req, res) => {
  serveHtml(path.join(VIEWS, 'questions', `${req.params.slug}.html`), res);
});

// Blood type detail pages
app.get('/blood-types/:slug', (req, res) => {
  serveHtml(path.join(VIEWS, 'blood-types', `${req.params.slug}.html`), res);
});

// Plasma city pages
app.get('/plasma/:slug', (req, res) => {
  serveHtml(path.join(VIEWS, 'plasma', `${req.params.slug}.html`), res);
});

// Donate blood city pages
app.get('/donate-blood/:slug', (req, res) => {
  serveHtml(
    path.join(VIEWS, 'donate-blood', `${req.params.slug}.html`),
    res,
    { locationSlug: req.params.slug }
  );
});

// News pages
app.get('/news/:slug', (req, res) => {
  serveHtml(
    path.join(VIEWS, 'news', `${req.params.slug}.html`),
    res,
    { fixYear: true }
  );
});

// ─── Donate ZIP pages ───────────────────────────────────────────────
app.get('/donate/:zip', (req, res) => {
  serveHtml(
    path.join(VIEWS, 'donate', `${req.params.zip}.html`),
    res
  );
});

// Legacy donate-near-me redirect
app.get('/donate-near-me/:zip', (req, res) => {
  res.redirect(301, `/donate/${req.params.zip}`);
});

// ─── API: Donor Signup ──────────────────────────────────────────────
app.post('/api/signups', async (req, res) => {
  const { name, email, zip_code, blood_type, source } = req.body;

  // Validation
  if (!name || !email || !zip_code) {
    return res.status(400).json({
      error: 'Missing required fields: name, email, zip_code'
    });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  if (!/^7[34]\d{3}$/.test(zip_code)) {
    return res.status(400).json({ error: 'Invalid Oklahoma ZIP code' });
  }

  console.log(
    `[SIGNUP] ${new Date().toISOString()} | ${name} | ${email} | ${zip_code} | ${blood_type || 'unknown'} | ${source || 'web'}`
  );

  // Database insert (if DATABASE_URL is configured)
  if (process.env.DATABASE_URL) {
    try {
      const { Pool } = require('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });
      const result = await pool.query(
        'INSERT INTO signups (name, email, zip_code, blood_type, source, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id',
        [name, email, zip_code, blood_type || 'unknown', source || 'web']
      );
      await pool.end();
      return res.status(201).json({
        success: true,
        message: 'Signup recorded',
        signup_id: result.rows[0].id
      });
    } catch (dbErr) {
      console.error('[SIGNUP DB ERROR]', dbErr.message);
      // Fall through to non-DB response
    }
  }

  res.status(201).json({
    success: true,
    message: 'Signup recorded (log only)',
    signup_id: `log_${Date.now()}`
  });
});

// ─── IndexNow Verification ──────────────────────────────────────────
app.get('/1acaceda82049435cdc869f315b88148.txt', (req, res) => {
  res.type('text').send('1acaceda82049435cdc869f315b88148');
});

// ─── Google Search Console Verification ─────────────────────────────
// Replace GOOGLE_VERIFICATION_CODE with actual code from GSC
app.get('/google:verificationCode.html', (req, res) => {
  res.type('html').send(
    `google-site-verification: google${req.params.verificationCode}.html`
  );
});

// ─── Sitemap ────────────────────────────────────────────────────────
app.get('/sitemap.xml', (req, res) => {
  const sitemapPath = path.join(__dirname, 'public', 'sitemap.xml');
  if (fs.existsSync(sitemapPath)) {
    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', 'public, max-age=86400');
    return res.sendFile(sitemapPath);
  }
  const viewsSitemap = path.join(VIEWS, 'sitemap.xml');
  if (fs.existsSync(viewsSitemap)) {
    res.set('Content-Type', 'application/xml');
    return res.sendFile(viewsSitemap);
  }
  res.status(404).send('Sitemap not found');
});

// ─── Robots.txt ─────────────────────────────────────────────────────
app.get('/robots.txt', (req, res) => {
  res.type('text').send(
    `User-agent: *\nAllow: /\n\nSitemap: https://oklahomabloodinstitute.com/sitemap.xml\n`
  );
});

// ─── OSU Campaign Pages ────────────────────────────────────────────
app.get('/osu', (req, res) => {
  serveHtml(path.join(VIEWS, 'osu.html'), res);
});

app.get('/osu/flyer', (req, res) => {
  serveHtml(path.join(VIEWS, 'osu-flyer.html'), res);
});

// ─── 404 Handler ────────────────────────────────────────────────────
app.use((req, res) => {
  const notFound = path.join(VIEWS, '404.html');
  if (fs.existsSync(notFound)) {
    return res.status(404).sendFile(notFound);
  }
  res.status(404).send('Page not found');
});

// ─── Start ──────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`oklahomabloodinstitute.com running on port ${PORT}`);
  console.log(
    `Location corrections loaded: ${Object.keys(locationData).length} centers`
  );
});
