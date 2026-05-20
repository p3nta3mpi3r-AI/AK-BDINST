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

// ─── Security headers ──────────────────────────────────────────────
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set({
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': "frame-ancestors 'self'"
  });
  next();
});

// ─── SEO: redirect .html blog URLs to clean URLs (avoid duplicate content) ──
app.use((req, res, next) => {
  const m = req.path.match(/^\/blog\/(.+)\.html$/);
  if (m) return res.redirect(301, `/blog/${m[1]}`);
  next();
});

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

  // 0) Donable links pass through unchanged — the Donable form is embedded
  // via iframes AND linked directly for QR codes and bottom-of-page CTAs.
  // Previously these were rewritten to /#schedule-form, but that broke
  // QR code tap-through and confused users expecting external navigation.

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

  // 3) Fix location data (addresses, phones, hours)
  if (options.locationSlug) {
    const loc = locationData[options.locationSlug];
    if (loc) {
      const fullAddr = `${loc.address}, ${loc.city}, ${loc.state} ${loc.zip}`;

      // ── JSON-LD Schema Fixes ──────────────────────────────────
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
      h = h.replace(
        /"name"\s*:\s*"[^"]*Blood Donor Center"/g,
        `"name":"${loc.name}"`
      );
      if (loc.openingHoursSpec) {
        h = h.replace(
          /"openingHours"\s*:\s*\[[^\]]*\]/g,
          `"openingHours":${JSON.stringify(loc.openingHoursSpec)}`
        );
      }

      // ── ALL Phone Numbers (blanket replace every (xxx) xxx-xxxx) ──
      // Catches: JSON-LD telephone, visible hero, FAQ answers,
      //          compensation info — one pattern handles all
      h = h.replace(
        /\(\d{3}\)\s*\d{3}[\s-]\d{4}/g,
        loc.phone
      );

      // ── Visible Address Fixes ─────────────────────────────────
      // After map-pin SVG icon
      h = h.replace(
        /(<\/circle>\s*<\/svg>\s*)[^<]+,\s*[A-Z][a-z]+[^<]*,\s*OK\s+\d{5}/,
        `$1${fullAddr}`
      );
      // FAQ answers referencing address
      h = h.replace(
        /located at [^.]+\./g,
        `located at ${fullAddr}. This center accepts whole blood, plasma, and platelet donations.`
      );
      // Any remaining "Street, City, OK ZIP" visible text patterns
      const addrRegex = new RegExp(
        '\\d+\\s+[NSEW]?\\.?\\s*\\w[\\w\\s]*(?:St(?:reet)?|Ave(?:nue)?|Blvd|Dr(?:ive)?|Rd|Ln|Way|Pkwy|Ct|Cir)[^,<]*,\\s*' +
        loc.city + '[^,<]*,\\s*OK\\s+\\d{5}',
        'g'
      );
      h = h.replace(addrRegex, fullAddr);

      // ── Visible Hours Fixes ───────────────────────────────────
      if (loc.hours) {
        // "Monday-Friday: 7:00 AM - 7:00 PM, Saturday-Sunday: 8:00 AM - 5:00 PM"
        h = h.replace(
          /Monday[\s\u2013\u2014-]+Friday:?\s*\d{1,2}:\d{2}\s*(?:AM|PM)\s*[\u2013\u2014–-]\s*\d{1,2}:\d{2}\s*(?:AM|PM)(?:(?:,|\s+and)?\s*(?:Saturday[\s\u2013\u2014-]+Sunday:?\s*\d{1,2}:\d{2}\s*(?:AM|PM)\s*[\u2013\u2014–-]\s*\d{1,2}:\d{2}\s*(?:AM|PM))?)?/gi,
          loc.hours
        );
        // "Mon-Fri 8:00 AM - 6:00 PM, Sat 9:00 AM - 3:00 PM"
        h = h.replace(
          /Mon(?:day)?[\s-]+Fri(?:day)?:?\s*\d{1,2}:\d{2}\s*(?:AM|PM)\s*[\u2013\u2014–-]\s*\d{1,2}:\d{2}\s*(?:AM|PM)(?:(?:,|\s+and)?\s*Sat(?:urday)?(?:[\s-]+Sun(?:day)?)?:?\s*\d{1,2}:\d{2}\s*(?:AM|PM)\s*[\u2013\u2014–-]\s*\d{1,2}:\d{2}\s*(?:AM|PM))?/gi,
          loc.hours
        );
      }
    }
  }


  // 4) AEO: Fix donate-blood city pages — Article → MedicalOrganization/LocalBusiness + HowTo
  if (options.locationSlug) {
    const loc = locationData[options.locationSlug];
    if (loc) {
      const cityName = loc.city;
      const fullAddr = `${loc.address}, ${loc.city}, ${loc.state} ${loc.zip}`;

      // Replace the generic Organization block with MedicalOrganization
      h = h.replace(
        /"@type"\s*:\s*"Organization"\s*,\s*"name"\s*:\s*"Oklahoma Blood Donors"/,
        '"@type":"MedicalOrganization","@id":"https://oklahomabloodinstitute.com/#organization","medicalSpecialty":"Blood Banking","name":"OK Blood Donor"'
      );

      // Replace Article schema with MedicalOrganization + LocalBusiness
      const articleRegex = /<script type="application\/ld\+json">\s*\{[^}]*"@type"\s*:\s*"Article"[\s\S]*?<\/script>/;
      if (articleRegex.test(h)) {
        const localBusinessSchema = {
          "@context": "https://schema.org",
          "@type": ["MedicalOrganization", "LocalBusiness"],
          "@id": `https://oklahomabloodinstitute.com/donate-blood/${options.locationSlug}#location`,
          "name": `OK Blood Donor — ${cityName}`,
          "description": `Donate blood in ${cityName}, Oklahoma. Walk-ins welcome at the ${loc.name}.`,
          "url": `https://oklahomabloodinstitute.com/donate-blood/${options.locationSlug}`,
          "telephone": loc.phone,
          "address": {
            "@type": "PostalAddress",
            "streetAddress": loc.address,
            "addressLocality": loc.city,
            "addressRegion": "OK",
            "postalCode": loc.zip,
            "addressCountry": "US"
          },
          "openingHoursSpecification": (loc.openingHoursSpec || []).map(spec => ({
            "@type": "OpeningHoursSpecification",
            "dayOfWeek": spec.split(' ')[0],
            "opens": spec.split(' ')[1]?.split('-')[0],
            "closes": spec.split(' ')[1]?.split('-')[1]
          })),
          "medicalSpecialty": "Blood Banking",
          "parentOrganization": {
            "@type": "MedicalOrganization",
            "@id": "https://oklahomabloodinstitute.com/#organization",
            "name": "OK Blood Donor"
          }
        };

        const howToSchema = {
          "@context": "https://schema.org",
          "@type": "HowTo",
          "name": `How to Donate Blood in ${cityName}, Oklahoma`,
          "description": `Step-by-step guide to donating blood at the ${loc.name} in ${cityName}.`,
          "step": [
            {"@type": "HowToStep", "position": 1, "name": "Check Eligibility", "text": "You must be at least 16 years old (with parental consent) or 17+, weigh at least 110 lbs, and be in generally good health. Most medications are acceptable."},
            {"@type": "HowToStep", "position": 2, "name": "Schedule Your Appointment", "text": `Visit oklahomabloodinstitute.com/schedule or call ${loc.phone} to book a time at the ${loc.name}.`},
            {"@type": "HowToStep", "position": 3, "name": "Prepare for Your Visit", "text": "Eat a healthy meal, drink plenty of water, and bring a valid photo ID. Wear a shirt with sleeves that roll up easily."},
            {"@type": "HowToStep", "position": 4, "name": "Complete Your Donation", "text": "The donation itself takes about 10 minutes. You will have a brief health screening, then donate approximately one pint of whole blood."},
            {"@type": "HowToStep", "position": 5, "name": "Rest and Recover", "text": "Enjoy complimentary snacks and drinks in the canteen area. Avoid heavy lifting for 24 hours and stay hydrated."}
          ],
          "totalTime": "PT60M"
        };

        h = h.replace(
          articleRegex,
          `<script type="application/ld+json">${JSON.stringify(localBusinessSchema)}</script>\n<script type="application/ld+json">${JSON.stringify(howToSchema)}</script>`
        );
      }
    }
  }

  // 5) AEO: Inject BlogPosting + Author/Publisher schema for blog posts
  if (options.blogSlug) {
    // Extract title from <title> tag
    const titleMatch = h.match(/<title>([^<]+)<\/title>/);
    const pageTitle = titleMatch ? titleMatch[1].replace(/ \| (?:Oklahoma Blood Donors|OK Blood Donor)$/, '').trim() : 'Blood Donation Guide';

    // Extract meta description
    const descMatch = h.match(/<meta\s+name="description"\s+content="([^"]*)"/);
    const pageDesc = descMatch ? descMatch[1] : '';

    const blogPostingSchema = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "headline": pageTitle,
      "description": pageDesc,
      "url": `https://oklahomabloodinstitute.com/blog/${options.blogSlug}`,
      "datePublished": "2026-01-15",
      "dateModified": "2026-05-14",
      "author": {
        "@type": "Organization",
        "@id": "https://oklahomabloodinstitute.com/#organization",
        "name": "OK Blood Donor",
        "url": "https://oklahomabloodinstitute.com"
      },
      "publisher": {
        "@type": "Organization",
        "@id": "https://oklahomabloodinstitute.com/#organization",
        "name": "OK Blood Donor",
        "url": "https://oklahomabloodinstitute.com",
        "logo": {
          "@type": "ImageObject",
          "url": "https://oklahomabloodinstitute.com/images/logo.png"
        }
      },
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": `https://oklahomabloodinstitute.com/blog/${options.blogSlug}`
      },
      "isPartOf": {
        "@type": "Blog",
        "name": "OK Blood Donor Blog",
        "url": "https://oklahomabloodinstitute.com/blog"
      }
    };

    // Inject before </head>
    h = h.replace(
      '</head>',
      `<script type="application/ld+json">${JSON.stringify(blogPostingSchema)}</script>\n</head>`
    );
  }

  // 6) Internal link injection (F-10) — add related page links before </main>
  const relatedLinks = [];
  if (options.blogSlug) {
    const city = (options.blogSlug || '').replace(/-guide|-compensation|-tips/g, '');
    relatedLinks.push(
      { href: `/donate-blood/${city}`, text: `Donate Blood in ${city.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}` },
      { href: `/locations`, text: 'Find All Donor Centers' },
      { href: `/how-it-works`, text: 'How Blood Donation Works' },
      { href: `/questions`, text: 'Common Donation Questions' },
      { href: `/blood-types`, text: 'Blood Type Guide' },
      { href: `/faq`, text: 'Frequently Asked Questions' }
    );
  } else if (options.locationSlug) {
    const city = options.locationSlug;
    relatedLinks.push(
      { href: `/blog/${city}-guide`, text: `${city.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} Donation Guide` },
      { href: `/how-it-works`, text: 'How Blood Donation Works' },
      { href: `/blood-types`, text: 'Blood Types & Compatibility' },
      { href: `/questions`, text: 'Common Questions' },
      { href: `/faq`, text: 'FAQ' },
      { href: `/blog`, text: 'All Blog Posts' }
    );
  }
  if (relatedLinks.length > 0) {
    const linksHtml = relatedLinks.map(l =>
      `<a href="${l.href}" class="block px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors">${l.text} &rarr;</a>`
    ).join('\n          ');
    const sectionHtml = `
    <section class="py-12 bg-white dark:bg-gray-950">
      <div class="max-w-4xl mx-auto px-4">
        <h2 class="text-xl font-bold mb-6 text-gray-900 dark:text-white">Related Resources</h2>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
          ${linksHtml}
        </div>
      </div>
    </section>`;
    h = h.replace('</main>', sectionHtml + '\n  </main>');
  }

  // 7) Global AEO: Upgrade Organization → MedicalOrganization on ALL pages
  // This catches pages not handled by section 4 (blog, faq, questions, guides, etc.)
  h = h.replace(
    /"@type"\s*:\s*"Organization"\s*,\s*"name"\s*:\s*"Oklahoma Blood Donors"/g,
    '"@type":"MedicalOrganization","@id":"https://oklahomabloodinstitute.com/#organization","medicalSpecialty":"Blood Banking","name":"OK Blood Donor","telephone":"+1-877-340-8777"'
  );

  // 8) Accessibility fixes (WCAG 2.1 AA compliance) — applied to ALL pages
  // 8a) Skip-to-content link — first focusable element for keyboard/screen reader users
  h = h.replace(
    /<body([^>]*)>\s*/,
    `<body$1>\n  <a href="#main-content" class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:rounded-md focus:shadow-lg focus:ring-2" style="color: oklch(0.547 0.213 27.325)">Skip to main content</a>\n`
  );
  // Add id="main-content" to <main> for skip link target
  h = h.replace(/<main\b(?![^>]*id=)/, '<main id="main-content"');

  // 8b) Navigation aria-labels
  h = h.replace(
    /<nav class="hidden md:flex items-center/g,
    '<nav aria-label="Main navigation" class="hidden md:flex items-center'
  );
  h = h.replace(
    /<nav class="flex flex-col space-y-4 text-base font-medium">/g,
    '<nav aria-label="Mobile navigation" class="flex flex-col space-y-4 text-base font-medium">'
  );

  // 8c) Hamburger button aria-label
  h = h.replace(
    /onclick="toggleMobileNav\(\)"\s*class="cursor-pointer/g,
    'onclick="toggleMobileNav()" aria-label="Open mobile menu" class="cursor-pointer'
  );

  // 8d) Theme toggle button — already has sr-only span, add aria-label for clarity
  h = h.replace(
    /onclick="toggleTheme\(\)"\s*class="cursor-pointer/g,
    'onclick="toggleTheme()" aria-label="Toggle dark mode" class="cursor-pointer'
  );

  // 8e) Fix gray-400 text contrast on light backgrounds (2.4:1 → 4.6:1)
  // gray-400 (#9ca3af) on white = 2.43:1 — FAILS AA
  // gray-500 (#6b7280) on white = 4.64:1 — PASSES AA
  // In dark mode, gray-400 on gray-950 = 7.8:1 — passes, so keep dark:text-gray-400
  h = h.replace(/text-gray-400 dark:text-gray-500/g, 'text-gray-500 dark:text-gray-400');
  h = h.replace(/text-gray-400 dark:text-gray-400/g, 'text-gray-500 dark:text-gray-400');

  // 8f) Add aria-hidden to ALL inline SVGs (they're decorative icons)
  // Screen readers announce unlabelled SVGs as empty images — hide them
  h = h.replace(/<svg\s(?!.*aria-hidden)/g, '<svg aria-hidden="true" ');

  // 8g) Announce new-tab links for screen reader users
  h = h.replace(
    /target="_blank"([^>]*>)([^<]*)<\/a>/g,
    (match, attrs, text) => {
      if (match.includes('sr-only')) return match; // already has announcement
      return `target="_blank"${attrs}${text} <span class="sr-only">(opens in new tab)</span></a>`;
    }
  );

  // 9) Brand alignment — canonical name is "OK Blood Donor" everywhere
  // Catches any remaining template-level brand strings the per-section
  // transforms above did not reach. Order matters: longest match first.

  // 9a) JSON-LD / schema: replace in name fields (within quotes)
  h = h.replace(/"name"\s*:\s*"Oklahoma Blood Donors"/g, '"name":"OK Blood Donor"');
  h = h.replace(/"name"\s*:\s*"Oklahoma Blood Institute"/g, '"name":"OK Blood Donor"');

  // 9b) HTML <title> and OG/Twitter meta tags
  h = h.replace(/(<title>[^<]*?)Oklahoma Blood Donors/g, '$1OK Blood Donor');
  h = h.replace(/(<title>[^<]*?)Oklahoma Blood Institute/g, '$1OK Blood Donor');
  h = h.replace(/(content="[^"]*?)Oklahoma Blood Donors/g, '$1OK Blood Donor');
  h = h.replace(/(content="[^"]*?)Oklahoma Blood Institute/g, '$1OK Blood Donor');

  // 9c) Nav brand span and footer copyright
  h = h.replace(/>Oklahoma Blood Donors</g, '>OK Blood Donor<');
  h = h.replace(/>\s*Oklahoma Blood Institute\s*</g, '>OK Blood Donor<');
  // Footer copyright: "&copy; 2026 Oklahoma Blood Donors. All rights reserved."
  h = h.replace(/&copy;\s*\d{4}\s*Oklahoma Blood Donors/g, '&copy; 2026 OK Blood Donor');
  h = h.replace(/&copy;\s*\d{4}\s*Oklahoma Blood Institute/g, '&copy; 2026 OK Blood Donor');
  // CTA / link text: "About Oklahoma Blood Donors" -> "About OK Blood Donor"
  h = h.replace(/About Oklahoma Blood Donors/g, 'About OK Blood Donor');
  h = h.replace(/About Oklahoma Blood Institute/g, 'About OK Blood Donor');

  // 9d) Description fields in schema that mention "Our Blood Institute donor centers"
  h = h.replace(/"Our Blood Institute donor centers"/g, '"certified blood donor centers across Oklahoma"');
  h = h.replace(/Our Blood Institute donor centers/g, 'certified blood donor centers across Oklahoma');

  // NOTE: Legitimate references to the real OBI nonprofit ("formerly known as
  // the Oklahoma Blood Institute", "Our Blood Institute announced") inside
  // article body text are NOT replaced — the patterns above are scoped to
  // structural elements (title, meta, nav, schema, footer).

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
  res.redirect(302, 'https://donableapp.com/register/1664F99D-8703-F111-8D4C-002248480912');
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

app.get('/requirements', (req, res) => {
  serveHtml(path.join(VIEWS, 'requirements.html'), res);
});

app.get('/contact', (req, res) => {
  serveHtml(path.join(VIEWS, 'contact.html'), res);
});

// /eligibility → redirect to the eligibility guide (SEO keyword target)
app.get('/eligibility', (req, res) => {
  res.redirect(301, '/guides/eligibility');
});

// ─── Plasma City Pages ──────────────────────────────────────────────
app.get('/plasma', (req, res) => {
  serveHtml(path.join(VIEWS, 'plasma', 'index.html'), res);
});

app.get('/plasma/oklahoma-city', (req, res) => {
  serveHtml(path.join(VIEWS, 'plasma', 'oklahoma-city.html'), res);
});

app.get('/plasma/tulsa', (req, res) => {
  serveHtml(path.join(VIEWS, 'plasma', 'tulsa.html'), res);
});

app.get('/plasma/norman', (req, res) => {
  serveHtml(path.join(VIEWS, 'plasma', 'norman.html'), res);
});

app.get('/plasma/edmond', (req, res) => {
  serveHtml(path.join(VIEWS, 'plasma', 'edmond.html'), res);
});

app.get('/plasma/lawton', (req, res) => {
  serveHtml(path.join(VIEWS, 'plasma', 'lawton.html'), res);
});

app.get('/plasma/broken-arrow', (req, res) => {
  serveHtml(path.join(VIEWS, 'plasma', 'broken-arrow.html'), res);
});

app.get('/plasma/enid', (req, res) => {
  serveHtml(path.join(VIEWS, 'plasma', 'enid.html'), res);
});

app.get('/plasma/midwest-city', (req, res) => {
  serveHtml(path.join(VIEWS, 'plasma', 'midwest-city.html'), res);
});


app.get('/plasma/moore', (req, res) => {
  serveHtml(path.join(VIEWS, 'plasma', 'moore.html'), res);
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
    { fixYear: true, blogSlug: req.params.slug }
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
app.get('/news', (req, res) => {
  serveHtml(path.join(VIEWS, 'news.html'), res, { fixYear: true });
});

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
// Accepts 6-field Donable-matching form: first_name, last_name, phone, dob, email, zip_code
// Also backward-compatible with old 4-field form (name, email, zip_code, blood_type)
app.post('/api/signups', async (req, res) => {
  const { first_name, last_name, name, phone, dob, email, zip_code, blood_type, source } = req.body;

  // Build full name from first+last or use legacy name field
  const fullName = (first_name && last_name)
    ? `${first_name.trim()} ${last_name.trim()}`
    : (name || '').trim();

  // Validation
  if (!fullName || !email || !zip_code) {
    return res.status(400).json({
      error: 'Missing required fields: name (or first_name+last_name), email, zip_code'
    });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  if (!/^7[34]\d{3}$/.test(zip_code)) {
    return res.status(400).json({ error: 'Invalid Oklahoma ZIP code' });
  }

  const extras = [];
  if (phone) extras.push(`phone=${phone}`);
  if (dob) extras.push(`dob=${dob}`);
  console.log(
    `[SIGNUP] ${new Date().toISOString()} | ${fullName} | ${email} | ${zip_code} | ${blood_type || 'n/a'} | ${source || 'web'} | ${extras.join(' ') || 'no-extras'}`
  );

  // Database insert (if DATABASE_URL is configured)
  if (process.env.DATABASE_URL) {
    try {
      const { Pool } = require('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });
      // Try extended insert with phone+dob columns; fall back to original columns
      try {
        const result = await pool.query(
          'INSERT INTO signups (name, email, zip_code, blood_type, phone, dob, source, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING id',
          [fullName, email, zip_code, blood_type || 'unknown', phone || null, dob || null, source || 'web']
        );
        await pool.end();
        return res.status(201).json({
          success: true,
          message: 'Signup recorded',
          signup_id: result.rows[0].id
        });
      } catch (colErr) {
        // phone/dob columns may not exist yet — retry with original columns
        if (colErr.message && colErr.message.includes('column')) {
          const result = await pool.query(
            'INSERT INTO signups (name, email, zip_code, blood_type, source, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id',
            [fullName, email, zip_code, blood_type || 'unknown', source || 'web']
          );
          await pool.end();
          return res.status(201).json({
            success: true,
            message: 'Signup recorded',
            signup_id: result.rows[0].id
          });
        }
        throw colErr;
      }
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

// ─── Bot detection helper ──────────────────────────────────────────
const BOT_UA_PATTERNS = [
  /bot/i, /crawl/i, /spider/i, /slurp/i, /mediapartners/i,
  /facebookexternalhit/i, /Twitterbot/i, /LinkedInBot/i,
  /WhatsApp/i, /Discordbot/i, /Googlebot/i, /bingbot/i,
  /YandexBot/i, /DuckDuckBot/i, /Baiduspider/i, /Sogou/i,
  /Applebot/i, /AhrefsBot/i, /SemrushBot/i, /MJ12bot/i,
  /DotBot/i, /PetalBot/i, /UptimeRobot/i, /pingdom/i,
  /StatusCake/i, /Checkly/i, /HeadlessChrome/i, /PhantomJS/i,
  /curl/i, /wget/i, /python-requests/i, /Go-http-client/i,
  /node-fetch/i, /axios/i, /libwww/i, /httpx/i,
  /Scrapy/i, /Nutch/i, /archive\.org_bot/i
];

// Exploit scanners (always block / log separately)
const SCANNER_PATHS = [
  /\.env/i, /\.git/i, /wp-admin/i, /wp-login/i, /wp-content/i,
  /phpinfo/i, /phpmyadmin/i, /\.php$/i, /xmlrpc/i, /cgi-bin/i,
  /\.asp$/i, /\.aspx$/i, /\.jsp$/i, /admin\/config/i, /\.sql$/i,
  /telescope\/requests/i, /actuator/i, /debug\/default/i
];

function isBot(userAgent) {
  if (!userAgent) return true;
  return BOT_UA_PATTERNS.some(p => p.test(userAgent));
}

function isScanner(reqPath) {
  return SCANNER_PATHS.some(p => p.test(reqPath));
}

// ─── API: Page-View Tracking ──────────────────────────────────────
// Client fires POST from app.js trackPageView() on every page load
app.post('/api/track/page-view', async (req, res) => {
  const ua = req.headers['user-agent'] || '';
  const botFlag = isBot(ua);
  const scannerFlag = isScanner(req.body.path || '');
  const { path: pagePath, referrer, utm_source, utm_medium, utm_campaign } = req.body;

  // Always return 200 quickly — never block the client
  res.json({ ok: true });

  // Log to console for real-time monitoring
  const tag = botFlag ? 'BOT' : (scannerFlag ? 'SCANNER' : 'HUMAN');
  console.log(
    `[PAGEVIEW][${tag}] ${new Date().toISOString()} | ${pagePath || '/'} | ref=${referrer || 'direct'} | utm=${utm_source || '-'}/${utm_medium || '-'}/${utm_campaign || '-'} | ua=${ua.substring(0, 80)}`
  );

  // Database insert (if DATABASE_URL is configured)
  if (process.env.DATABASE_URL) {
    try {
      const { Pool } = require('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });

      // Auto-create page_views table if it doesn't exist
      await pool.query(`
        CREATE TABLE IF NOT EXISTS page_views (
          id SERIAL PRIMARY KEY,
          path TEXT NOT NULL,
          referrer TEXT,
          utm_source TEXT,
          utm_medium TEXT,
          utm_campaign TEXT,
          user_agent TEXT,
          ip TEXT,
          is_bot BOOLEAN DEFAULT false,
          is_scanner BOOLEAN DEFAULT false,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      // Get IP (behind proxy like Cloudflare/Render)
      const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || req.headers['cf-connecting-ip']
        || req.socket.remoteAddress
        || null;

      await pool.query(
        `INSERT INTO page_views (path, referrer, utm_source, utm_medium, utm_campaign, user_agent, ip, is_bot, is_scanner)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          pagePath || '/',
          referrer || null,
          utm_source || null,
          utm_medium || null,
          utm_campaign || null,
          ua.substring(0, 500),
          ip,
          botFlag,
          scannerFlag
        ]
      );
      await pool.end();
    } catch (dbErr) {
      console.error('[PAGEVIEW DB ERROR]', dbErr.message);
    }
  }
});

// ─── API: Signups Count (social proof) ─────────────────────────────
// Returns total signups for the social proof counter on the homepage
app.get('/api/signups/count', async (req, res) => {
  // Default to the hardcoded baseline if DB isn't available
  let count = 847;

  if (process.env.DATABASE_URL) {
    try {
      const { Pool } = require('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });
      const result = await pool.query('SELECT COUNT(*) AS total FROM signups');
      const dbCount = parseInt(result.rows[0].total, 10);
      // Use DB count + baseline offset (847 existing before DB tracking started)
      count = 847 + dbCount;
      await pool.end();
    } catch (dbErr) {
      console.error('[SIGNUPS COUNT DB ERROR]', dbErr.message);
      // Fall through to default
    }
  }

  res.set('Cache-Control', 'public, max-age=300'); // cache 5 min
  res.json({ count });
});

// ─── Security: Block exploit scanners with 403 ────────────────────
// .env probes, wp-admin scanners, etc. — return 403 instead of 404
// (placed AFTER API routes so it doesn't block legitimate API calls)

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
    return res.sendFile(sitemapPath, (err) => {
      if (err && !res.headersSent) {
        console.error('[SITEMAP ERROR]', err.message);
        res.status(500).send('Sitemap error');
      }
    });
  }
  const viewsSitemap = path.join(VIEWS, 'sitemap.xml');
  if (fs.existsSync(viewsSitemap)) {
    // Read and send directly to guarantee 200 status
    try {
      const xml = fs.readFileSync(viewsSitemap, 'utf8');
      res.set('Content-Type', 'application/xml');
      res.set('Cache-Control', 'public, max-age=86400');
      return res.status(200).send(xml);
    } catch (e) {
      console.error('[SITEMAP ERROR]', e.message);
    }
  }
  res.status(404).send('Sitemap not found');
});

// ─── Robots.txt ─────────────────────────────────────────────────────
app.get('/robots.txt', (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600'); // 1 hour — never cache robots.txt for days
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

// ─── Exploit Scanner Blocker ────────────────────────────────────────
// Return 403 for .env probes, wp-admin scanners, PHP exploits, etc.
// Logs the attempt so we can monitor attack patterns.
app.use((req, res, next) => {
  if (isScanner(req.path)) {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || req.headers['cf-connecting-ip']
      || req.socket.remoteAddress || '?';
    console.warn(
      `[SCANNER BLOCKED] ${new Date().toISOString()} | ${req.method} ${req.path} | ip=${ip} | ua=${(req.headers['user-agent'] || '').substring(0, 80)}`
    );
    return res.status(403).send('Forbidden');
  }
  next();
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
