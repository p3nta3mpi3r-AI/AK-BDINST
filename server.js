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

// ─── Sitemap XML (bots only — Cloudflare caches this separately) ────
app.get('/sitemap.xml', (req, res) => {
  const sitemapPath = path.join(__dirname, 'public', 'sitemap.xml');
  const viewsSitemap = path.join(VIEWS, 'sitemap.xml');
  let xml;
  if (fs.existsSync(sitemapPath)) {
    try { xml = fs.readFileSync(sitemapPath, 'utf8'); } catch (e) { /* fall through */ }
  }
  if (!xml && fs.existsSync(viewsSitemap)) {
    try { xml = fs.readFileSync(viewsSitemap, 'utf8'); } catch (e) { /* fall through */ }
  }
  if (!xml) return res.status(404).send('Sitemap not found');
  res.set('Content-Type', 'application/xml');
  res.set('Cache-Control', 'public, max-age=86400');
  return res.status(200).send(xml);
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

// ─── Canonical header / footer HTML (injected via <!--SYM:HEADER--> / <!--SYM:FOOTER-->) ───
const SYM_HEADER = `
  <header class="sticky top-0 z-50 w-full border-b bg-white/95 dark:bg-gray-950/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-gray-950/60 no-print">
    <div class="max-w-7xl mx-auto flex h-16 items-center justify-between px-4">
      <a class="flex items-center space-x-2" href="/">
        <img src="/images/logo.png" alt="OBI Blood Donor" width="48" height="48" class="h-12 w-12 object-contain">
        <span class="hidden font-bold sm:inline-block text-lg">OBI Blood Donor</span>
      </a>
      <nav aria-label="Main navigation" class="hidden md:flex items-center space-x-6 text-sm font-medium">
        <a class="transition-colors hover:text-red-700" href="/locations">Donor Centers</a>
        <a class="transition-colors hover:text-red-700" href="/guides/eligibility">Eligibility</a>
        <a class="transition-colors hover:text-red-700" href="/how-it-works">How to Donate</a>
        <a class="transition-colors hover:text-red-700" href="/faq">FAQ</a>
        <a class="transition-colors hover:text-red-700" href="/contact">Contact</a>
      </nav>
      <div class="flex items-center space-x-2">
        <button onclick="toggleTheme()" class="cursor-pointer inline-flex items-center justify-center rounded-md h-10 w-10 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label="Toggle dark mode">
          <svg id="sun-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg><svg id="moon-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
          <span class="sr-only">Theme</span>
        </button>
        <a href="https://donableapp.com/register/1664F99D-8703-F111-8D4C-002248480912" target="_blank" rel="noopener" data-ga-cta="header" class="hidden md:inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-4 py-2 text-white transition-colors" style="background-color: oklch(0.547 0.213 27.325)" onmouseover="this.style.backgroundColor='oklch(0.497 0.213 27.325)'" onmouseout="this.style.backgroundColor='oklch(0.547 0.213 27.325)'">Schedule Donation</a>
        <button onclick="toggleMobileNav()" class="cursor-pointer inline-flex items-center justify-center rounded-md h-10 w-10 hover:bg-gray-100 dark:hover:bg-gray-800 md:hidden" aria-label="Open menu">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
        </button>
      </div>
    </div>
  </header>

  <!-- Mobile navigation -->
  <div id="mobile-nav-overlay" class="mobile-nav-overlay" onclick="closeMobileNav()"></div>
  <div id="mobile-nav" class="mobile-nav">
    <div class="flex justify-between items-center mb-6">
      <span class="font-bold text-lg">OBI Blood Donor</span>
      <button onclick="closeMobileNav()" class="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Close menu">&times;</button>
    </div>
    <nav aria-label="Mobile navigation" class="flex flex-col space-y-4 text-base font-medium">
      <a href="/" class="py-2 hover:text-red-700" onclick="closeMobileNav()">Home</a>
      <a href="/locations" class="py-2 hover:text-red-700" onclick="closeMobileNav()">Donor Centers</a>
      <a href="/guides/eligibility" class="py-2 hover:text-red-700" onclick="closeMobileNav()">Eligibility</a>
      <a href="/how-it-works" class="py-2 hover:text-red-700" onclick="closeMobileNav()">How to Donate</a>
      <a href="/faq" class="py-2 hover:text-red-700" onclick="closeMobileNav()">FAQ</a>
      <a href="/contact" class="py-2 hover:text-red-700" onclick="closeMobileNav()">Contact</a>
      <a href="/blog" class="py-2 hover:text-red-700" onclick="closeMobileNav()">Blog</a>
      <a href="/blood-types" class="py-2 hover:text-red-700" onclick="closeMobileNav()">Blood Types</a>
      <a href="https://donableapp.com/register/1664F99D-8703-F111-8D4C-002248480912" target="_blank" rel="noopener" data-ga-cta="mobile_nav" class="mt-4 inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-4 py-2 text-white" style="background-color: oklch(0.547 0.213 27.325)" onclick="closeMobileNav()">Schedule Donation</a>
    </nav>
  </div>
`;

const SYM_FOOTER = `
  <footer class="border-t bg-gray-50 dark:bg-gray-950 no-print">
    <div class="max-w-7xl mx-auto px-4 py-12">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <div class="flex items-center space-x-2 mb-4">
            <img src="/images/logo.png" alt="OBI Blood Donor" width="36" height="36" class="h-9 w-9 object-contain">
            <span class="font-bold">OBI Blood Donor</span>
          </div>
          <p class="text-sm text-gray-600 dark:text-gray-400">Serving Oklahoma donors and patients at 12 certified centers. Every unit donated stays local — supporting hospitals, trauma centers, and treatment facilities across the state.</p>
        </div>
        <div>
          <h3 class="font-semibold mb-3">Quick Links</h3>
          <ul class="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li><a href="/locations" class="hover:text-red-700 transition-colors">Donor Centers</a></li>
            <li><a href="https://donableapp.com/register/1664F99D-8703-F111-8D4C-002248480912" target="_blank" rel="noopener" class="hover:text-red-700 transition-colors">Schedule Appointment</a></li>
            <li><a href="/guides/eligibility" class="hover:text-red-700 transition-colors">Eligibility</a></li>
            <li><a href="/how-it-works" class="hover:text-red-700 transition-colors">How to Donate</a></li>
            <li><a href="/faq" class="hover:text-red-700 transition-colors">FAQ</a></li>
          </ul>
        </div>
        <div>
          <h3 class="font-semibold mb-3">Resources</h3>
          <ul class="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li><a href="/blood-types" class="hover:text-red-700 transition-colors">Blood Type Guides</a></li>
            <li><a href="/guides" class="hover:text-red-700 transition-colors">Donor Guides</a></li>
            <li><a href="/blog" class="hover:text-red-700 transition-colors">Blog</a></li>
            <li><a href="/about" class="hover:text-red-700 transition-colors">About Us</a></li>
            <li><a href="/contact" class="hover:text-red-700 transition-colors">Contact</a></li>
            <li><a href="/privacy-policy" class="hover:text-red-700 transition-colors">Privacy Policy</a></li>
            <li><a href="/sitemap" class="hover:text-red-700 transition-colors">Site Map</a></li>
          </ul>
        </div>
        <div>
          <h3 class="font-semibold mb-3">Get Started</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">Oklahoma hospitals need 800+ units of blood daily. Find your nearest certified donor center.</p>
          <a href="/locations" class="inline-block text-sm font-medium hover:text-red-800 transition-colors" style="color: oklch(0.547 0.213 27.325)">View All Locations &rarr;</a>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-3">One donation. Up to 3 lives. All local.</p>
        </div>
      </div>
      <div class="mt-8 pt-8 border-t border-gray-200 dark:border-gray-800">
        <p class="text-xs text-gray-500 dark:text-gray-500 leading-relaxed"><strong>Important Disclaimer:</strong> Information on compensation, rewards, and promotions is for general guidance only and may change. Always confirm details with your selected donor center at the time of booking. Blood donation is a medical procedure with potential risks. Please answer all health questions honestly and follow staff instructions.</p>
        <p class="text-xs text-gray-500 dark:text-gray-500 mt-4">&copy; OBI Blood Donor. All rights reserved.</p>
      </div>
    </div>
  </footer>
`;

function transformHtml(html, options = {}) {
  let h = html;

  // 0) Inject canonical header / footer at SYM placeholders
  h = h.replace('<!--SYM:HEADER-->', SYM_HEADER);
  h = h.replace('<!--SYM:FOOTER-->', SYM_FOOTER);

  // 0b) Donable links pass through unchanged — the Donable form is embedded
  // via iframes AND linked directly for QR codes and bottom-of-page CTAs.
  // Previously these were rewritten to /#schedule-form, but that broke
  // QR code tap-through and confused users expecting external navigation.

  // 1) Swap Tailwind CDN for purged CSS (saves ~440KB)
  // Catches <script src="..."> form (most pages)
  h = h.replace(
    /<script\s+src="https:\/\/cdn\.tailwindcss\.com"><\/script>/gi,
    '<link rel="stylesheet" href="/css/tailwind-purged.css?v=2">'
  );
  // Catches <link href="..."> form (plasma pages use this variant)
  h = h.replace(
    /<link\s+href="https:\/\/cdn\.tailwindcss\.com"\s+rel="stylesheet"\s*\/?>/gi,
    '<link rel="stylesheet" href="/css/tailwind-purged.css?v=2">'
  );
  // Cache-bust existing purged CSS references (e.g., homepage uses direct link)
  h = h.replace(
    /\/css\/tailwind-purged\.css(?:\?v=\d+)?"/g,
    '/css/tailwind-purged.css?v=2"'
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

  // 2b) Fix {2026} template literal in plasma page titles/content
  h = h.replace(/\{2026\}/g, '2026');

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
        /"@type"\s*:\s*"Organization"\s*,\s*"name"\s*:\s*"OBI Blood Donor"/,
        '"@type":"MedicalOrganization","@id":"https://oklahomabloodinstitute.com/#organization","medicalSpecialty":"Blood Banking","name":"OBI Blood Donor"'
      );

      // Replace Article schema with MedicalOrganization + LocalBusiness
      const articleRegex = /<script type="application\/ld\+json">\s*\{[^}]*"@type"\s*:\s*"Article"[\s\S]*?<\/script>/;
      if (articleRegex.test(h)) {
        const localBusinessSchema = {
          "@context": "https://schema.org",
          "@type": ["MedicalOrganization", "LocalBusiness"],
          "@id": `https://oklahomabloodinstitute.com/donate-blood/${options.locationSlug}#location`,
          "name": `OBI Blood Donor — ${cityName}`,
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
            "name": "OBI Blood Donor"
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
    const pageTitle = titleMatch ? titleMatch[1].replace(/ \| OBI Blood Donor$/, '').trim() : 'Blood Donation Guide';

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
        "name": "OBI Blood Donor",
        "url": "https://oklahomabloodinstitute.com"
      },
      "publisher": {
        "@type": "Organization",
        "@id": "https://oklahomabloodinstitute.com/#organization",
        "name": "OBI Blood Donor",
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
        "name": "OBI Blood Donor Blog",
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
      { href: `/plasma/${city}`, text: `Plasma Donation in ${city.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}` },
      { href: `/donate-blood/${city}`, text: `Donate Blood in ${city.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}` },
      { href: `/how-it-works`, text: 'How Blood Donation Works' },
      { href: `/blood-types`, text: 'Blood Types & Compatibility' },
      { href: `/questions`, text: 'Common Questions' },
      { href: `/faq`, text: 'FAQ' },
      { href: `/blog`, text: 'All Blog Posts' }
    );
  } else if (options.donateZip) {
    // ZIP donate pages — link to location, city blog, plasma, and informational pages
    const zipCityMap = {
      // Oklahoma City area
      '73101': 'oklahoma-city', '73102': 'oklahoma-city', '73103': 'oklahoma-city', '73104': 'oklahoma-city',
      '73105': 'oklahoma-city', '73106': 'oklahoma-city', '73107': 'oklahoma-city', '73108': 'oklahoma-city',
      '73109': 'oklahoma-city', '73110': 'midwest-city', '73111': 'oklahoma-city', '73112': 'oklahoma-city',
      '73114': 'oklahoma-city', '73115': 'oklahoma-city', '73116': 'oklahoma-city', '73117': 'oklahoma-city',
      '73118': 'oklahoma-city', '73119': 'oklahoma-city', '73120': 'oklahoma-city', '73121': 'oklahoma-city',
      '73122': 'oklahoma-city', '73127': 'oklahoma-city', '73128': 'oklahoma-city', '73129': 'oklahoma-city',
      '73130': 'oklahoma-city', '73131': 'oklahoma-city', '73132': 'oklahoma-city', '73134': 'oklahoma-city',
      '73135': 'oklahoma-city', '73139': 'oklahoma-city', '73141': 'oklahoma-city', '73142': 'oklahoma-city',
      '73145': 'midwest-city', '73149': 'oklahoma-city', '73150': 'oklahoma-city', '73151': 'oklahoma-city',
      '73159': 'oklahoma-city', '73160': 'oklahoma-city', '73162': 'oklahoma-city', '73165': 'oklahoma-city',
      '73170': 'oklahoma-city',
      // Norman
      '73069': 'norman', '73071': 'norman', '73072': 'norman',
      // Edmond
      '73003': 'edmond', '73007': 'edmond', '73012': 'edmond', '73013': 'edmond', '73025': 'edmond', '73034': 'edmond',
      // Tulsa area
      '74101': 'tulsa', '74102': 'tulsa', '74103': 'tulsa', '74104': 'tulsa', '74105': 'tulsa',
      '74106': 'tulsa', '74107': 'tulsa', '74108': 'tulsa', '74110': 'tulsa', '74112': 'tulsa',
      '74114': 'tulsa', '74115': 'tulsa', '74116': 'tulsa', '74119': 'tulsa', '74120': 'tulsa',
      '74126': 'tulsa', '74127': 'tulsa', '74128': 'tulsa', '74129': 'tulsa', '74130': 'tulsa',
      '74131': 'tulsa', '74132': 'tulsa', '74133': 'tulsa', '74134': 'tulsa', '74135': 'tulsa',
      '74136': 'tulsa', '74137': 'tulsa', '74145': 'tulsa', '74146': 'tulsa',
      '74008': 'tulsa', '74033': 'tulsa', '74037': 'tulsa', '74047': 'tulsa',
      '74063': 'tulsa', '74066': 'tulsa', '74070': 'tulsa', '74055': 'tulsa',
      // Broken Arrow
      '74011': 'broken-arrow', '74012': 'broken-arrow', '74013': 'broken-arrow', '74014': 'broken-arrow',
      // Stillwater
      '74074': 'stillwater', '74075': 'stillwater', '74076': 'stillwater',
      // Enid
      '73701': 'enid', '73703': 'enid', '73705': 'enid',
      // Lawton
      '73501': 'lawton', '73503': 'lawton', '73505': 'lawton', '73507': 'lawton',
      // Ada
      '74820': 'ada', '74821': 'ada',
      // Ardmore
      '73401': 'ardmore', '73402': 'ardmore',
      // Yukon / Mustang
      '73099': 'yukon', '73085': 'yukon', '73064': 'yukon',
      // Muskogee / Claremore / Catoosa / Collinsville / Bartlesville
      '74401': 'tulsa', '74402': 'tulsa', '74403': 'tulsa',
      '74019': 'tulsa', '74010': 'broken-arrow', '74015': 'broken-arrow', '74021': 'tulsa',
      '74003': 'tulsa', '74005': 'tulsa', '74006': 'tulsa'
    };
    const city = zipCityMap[options.donateZip] || 'oklahoma-city';
    const cityName = city.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    relatedLinks.push(
      { href: `/locations/${city}`, text: `${cityName} Donor Center` },
      { href: `/blog/${city}-guide`, text: `${cityName} Blood Donation Guide` },
      { href: `/plasma/${city}`, text: `Plasma Donation in ${cityName}` },
      { href: `/donate-blood/${city}`, text: `Donate Blood in ${cityName}` },
      { href: `/how-it-works`, text: 'How Blood Donation Works' },
      { href: `/requirements`, text: 'Donation Requirements' },
      { href: `/questions/first-time-donating`, text: 'First Time Donating?' },
      { href: `/blood-types`, text: 'Blood Type Guide' }
    );
  } else if (options.plasmaSlug) {
    const city = options.plasmaSlug;
    const cityName = city.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    relatedLinks.push(
      { href: `/locations/${city}`, text: `${cityName} Donor Center` },
      { href: `/blog/${city}-guide`, text: `${cityName} Blood Donation Guide` },
      { href: `/blog/${city}-compensation`, text: `${cityName} Compensation Info` },
      { href: `/donate-blood/${city}`, text: `Donate Blood in ${cityName}` },
      { href: `/how-it-works`, text: 'How Blood Donation Works' },
      { href: `/requirements`, text: 'Donation Requirements' },
      { href: `/questions/does-it-hurt`, text: 'Does Donating Hurt?' },
      { href: `/faq`, text: 'FAQ' }
    );
  } else if (options.bloodTypeSlug) {
    const bt = options.bloodTypeSlug;
    const btName = bt.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    relatedLinks.push(
      { href: `/blood-types`, text: 'All Blood Types' },
      { href: `/donate-blood/oklahoma-city`, text: 'Donate in Oklahoma City' },
      { href: `/donate-blood/tulsa`, text: 'Donate in Tulsa' },
      { href: `/locations`, text: 'Find a Donor Center' },
      { href: `/requirements`, text: 'Donation Requirements' },
      { href: `/how-it-works`, text: 'How Blood Donation Works' },
      { href: `/questions/first-time-donating`, text: 'First Time Donating?' },
      { href: `/blog`, text: 'Blood Donation Blog' }
    );
  } else if (options.questionSlug) {
    relatedLinks.push(
      { href: `/questions`, text: 'All Questions' },
      { href: `/how-it-works`, text: 'How Blood Donation Works' },
      { href: `/requirements`, text: 'Donation Requirements' },
      { href: `/locations`, text: 'Find a Donor Center' },
      { href: `/blood-types`, text: 'Blood Type Guide' },
      { href: `/faq`, text: 'FAQ' },
      { href: `/donate-blood/oklahoma-city`, text: 'Donate in Oklahoma City' },
      { href: `/blog`, text: 'Blood Donation Blog' }
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


  // 6b) ZIP page unique content differentiation (SEO indexing boost)
  if (options.donateZip) {
    const zipLocalContent = {
      // Oklahoma City area
      '73101': { area: 'Downtown Oklahoma City', landmarks: 'Bricktown Entertainment District, Myriad Botanical Gardens', community: 'the heart of OKC\'s urban core' },
      '73102': { area: 'Downtown Oklahoma City', landmarks: 'Oklahoma City National Memorial, Paycom Center', community: 'downtown Oklahoma City near the central business district' },
      '73103': { area: 'Midtown Oklahoma City', landmarks: 'Automobile Alley, St. Anthony Hospital', community: 'OKC\'s vibrant Midtown neighborhood' },
      '73104': { area: 'Health Sciences Center', landmarks: 'OU Health Sciences Center, Oklahoma Medical Research Foundation', community: 'Oklahoma City\'s medical corridor' },
      '73105': { area: 'Lincoln Terrace', landmarks: 'State Capitol Complex, Governor\'s Mansion', community: 'the Capitol Hill area near state government offices' },
      '73106': { area: 'Heritage Hills', landmarks: 'Heritage Hills Historic District, Classen Blvd corridor', community: 'one of OKC\'s oldest and most charming neighborhoods' },
      '73107': { area: 'West Oklahoma City', landmarks: 'Lake Overholser, Wiley Post Airport', community: 'western Oklahoma City near Lake Overholser' },
      '73108': { area: 'Capitol Hill', landmarks: 'Capitol Hill Main Street, Wheeler District', community: 'the diverse Capitol Hill neighborhood in south OKC' },
      '73109': { area: 'South Oklahoma City', landmarks: 'South Oklahoma City area shopping centers', community: 'the south Oklahoma City corridor' },
      '73110': { area: 'Midwest City', landmarks: 'Tinker Air Force Base, Rose State College', community: 'Midwest City near Tinker AFB' },
      '73111': { area: 'Northeast Oklahoma City', landmarks: 'Remington Park Racing & Casino, Oklahoma City Zoo', community: 'northeast OKC near the Adventure District' },
      '73112': { area: 'Warr Acres / Bethany', landmarks: 'Southern Nazarene University, Warr Acres area', community: 'the Warr Acres / Bethany community' },
      '73114': { area: 'North Oklahoma City', landmarks: 'Penn Square Mall, Nichols Hills', community: 'north central Oklahoma City' },
      '73115': { area: 'Del City / Southeast OKC', landmarks: 'Del City area, Tinker AFB vicinity', community: 'the southeast OKC and Del City area' },
      '73116': { area: 'Nichols Hills / The Village', landmarks: 'Nichols Hills, Casady Square', community: 'the upscale Nichols Hills and Village area' },
      '73117': { area: 'Spencer / Northeast OKC', landmarks: 'Oklahoma City Zoo, Remington Park', community: 'the Spencer and northeast Oklahoma City area' },
      '73118': { area: 'Belle Isle / North OKC', landmarks: 'Belle Isle area, 50 Penn Place', community: 'the Belle Isle neighborhood in north OKC' },
      '73119': { area: 'South Oklahoma City', landmarks: 'South OKC community centers, Western Ave corridor', community: 'south Oklahoma City residential areas' },
      '73120': { area: 'North Oklahoma City', landmarks: 'Quail Springs Mall, Lake Hefner', community: 'north Oklahoma City near Lake Hefner' },
      '73121': { area: 'Northeast Oklahoma City', landmarks: 'Eastside OKC, I-35 corridor', community: 'northeast Oklahoma City' },
      '73122': { area: 'Bethany', landmarks: 'Southern Nazarene University, Lake Overholser', community: 'the Bethany community west of OKC' },
      '73127': { area: 'West Oklahoma City', landmarks: 'Czech Hall, Yukon border area', community: 'west Oklahoma City near the Yukon city limits' },
      '73128': { area: 'West Oklahoma City', landmarks: 'Will Rogers World Airport vicinity', community: 'far west Oklahoma City' },
      '73129': { area: 'Southeast Oklahoma City', landmarks: 'SE 29th corridor, Del City border', community: 'southeast Oklahoma City' },
      '73130': { area: 'Midwest City', landmarks: 'Tinker Air Force Base, Midwest City Parks', community: 'the eastern Midwest City area' },
      '73131': { area: 'Northeast Oklahoma City', landmarks: 'NE OKC, Sooner Road corridor', community: 'far northeast Oklahoma City' },
      '73132': { area: 'Northwest Oklahoma City', landmarks: 'Hefner Parkway area, NW Expressway', community: 'northwest Oklahoma City' },
      '73134': { area: 'North Oklahoma City', landmarks: 'Memorial Road shopping, Quail Springs', community: 'north OKC\'s Memorial Road corridor' },
      '73135': { area: 'South Oklahoma City', landmarks: 'Will Rogers World Airport, SW OKC', community: 'south Oklahoma City near the airport' },
      '73139': { area: 'South Oklahoma City', landmarks: 'South OKC, SW 59th corridor', community: 'the south Oklahoma City area' },
      '73141': { area: 'Northeast Oklahoma City', landmarks: 'Lake Stanley Draper vicinity', community: 'far northeast Oklahoma City' },
      '73142': { area: 'Northwest Oklahoma City', landmarks: 'Lake Hefner, NW OKC golf courses', community: 'northwest Oklahoma City near Lake Hefner' },
      '73145': { area: 'Tinker AFB', landmarks: 'Tinker Air Force Base', community: 'the Tinker Air Force Base community' },
      '73149': { area: 'South Oklahoma City', landmarks: 'South OKC residential community', community: 'south central Oklahoma City' },
      '73150': { area: 'Southeast Oklahoma City', landmarks: 'SE OKC, Choctaw border', community: 'southeast Oklahoma City near Choctaw' },
      '73151': { area: 'Northeast Oklahoma City', landmarks: 'NE OKC, Jones border area', community: 'far northeast Oklahoma City' },
      '73159': { area: 'Southwest Oklahoma City', landmarks: 'SW OKC, Moore border', community: 'southwest Oklahoma City' },
      '73160': { area: 'Moore', landmarks: 'Moore Warren Theatre, Buck Thomas Park', community: 'the Moore community south of OKC' },
      '73162': { area: 'Northwest Oklahoma City', landmarks: 'Deer Creek, NW OKC', community: 'the Deer Creek area in northwest OKC' },
      '73165': { area: 'Southeast Oklahoma City', landmarks: 'SE OKC near Lake Stanley Draper', community: 'southeast Oklahoma City' },
      '73170': { area: 'South Oklahoma City / Moore', landmarks: 'Moore, South OKC corridor', community: 'the South OKC and Moore border area' },
      // Norman
      '73069': { area: 'Norman', landmarks: 'University of Oklahoma, Lloyd Noble Center', community: 'the Norman community, home of OU Sooners' },
      '73071': { area: 'East Norman', landmarks: 'Norman Regional Hospital, east Norman parks', community: 'east Norman residential neighborhoods' },
      '73072': { area: 'West Norman', landmarks: 'Westwood Park, west Norman shopping', community: 'west Norman neighborhoods' },
      // Edmond
      '73003': { area: 'Edmond', landmarks: 'University of Central Oklahoma, Downtown Edmond', community: 'downtown Edmond and the UCO campus area' },
      '73007': { area: 'North Edmond', landmarks: 'Arcadia Lake, north Edmond neighborhoods', community: 'the growing north Edmond community' },
      '73012': { area: 'Edmond', landmarks: 'Hafer Park, Edmond Santa Fe High School', community: 'central Edmond near Hafer Park' },
      '73013': { area: 'South Edmond', landmarks: 'Cross Timbers, south Edmond shopping centers', community: 'south Edmond near I-35' },
      '73025': { area: 'Edmond', landmarks: 'Edmond area neighborhoods, Covell Road', community: 'the Edmond community along Covell Road' },
      '73034': { area: 'Edmond', landmarks: 'Coffee Creek, north Edmond developments', community: 'northeast Edmond neighborhoods' },
      // Tulsa area
      '74101': { area: 'Downtown Tulsa', landmarks: 'BOK Center, Blue Dome District', community: 'the vibrant downtown Tulsa area' },
      '74102': { area: 'Downtown Tulsa', landmarks: 'Tulsa Performing Arts Center, Center of the Universe', community: 'downtown Tulsa\'s arts and business district' },
      '74103': { area: 'Downtown Tulsa', landmarks: 'Brady Arts District, ONEOK Field', community: 'Tulsa\'s historic Brady District' },
      '74104': { area: 'Midtown Tulsa', landmarks: 'Cherry Street, Utica Square', community: 'the popular Cherry Street neighborhood' },
      '74105': { area: 'South Tulsa', landmarks: 'Riverside, Gathering Place park', community: 'Tulsa\'s Riverside area near Gathering Place' },
      '74106': { area: 'North Tulsa', landmarks: 'Greenwood District, OSU-Tulsa', community: 'the historic Greenwood District in north Tulsa' },
      '74107': { area: 'West Tulsa', landmarks: 'West Tulsa, Red Fork area', community: 'west Tulsa residential neighborhoods' },
      '74108': { area: 'Catoosa / East Tulsa', landmarks: 'Hard Rock Hotel & Casino, Cherokee Nation', community: 'the Catoosa and east Tulsa area' },
      '74110': { area: 'North Tulsa', landmarks: 'Mohawk Park, Tulsa Zoo', community: 'north Tulsa near the Tulsa Zoo' },
      '74112': { area: 'East Tulsa', landmarks: 'Woodland Hills Mall, Broken Arrow border', community: 'east Tulsa and the Woodland Hills area' },
      '74114': { area: 'Midtown Tulsa', landmarks: 'Brookside, Philbrook Museum of Art', community: 'the charming Brookside neighborhood' },
      '74115': { area: 'North Tulsa', landmarks: 'Tulsa International Airport, Mohawk area', community: 'north Tulsa near the airport' },
      '74116': { area: 'East Tulsa', landmarks: 'East Tulsa, Garnett Road area', community: 'east Tulsa neighborhoods' },
      '74119': { area: 'Downtown Tulsa', landmarks: 'Blue Dome District, historic Route 66', community: 'downtown Tulsa along Route 66' },
      '74120': { area: 'Midtown Tulsa', landmarks: 'TU campus, Florence Park', community: 'midtown Tulsa near the University of Tulsa' },
      '74126': { area: 'North Tulsa', landmarks: 'Turley, north Tulsa neighborhoods', community: 'the Turley area in far north Tulsa' },
      '74127': { area: 'West Tulsa', landmarks: 'West Tulsa, Sand Springs border', community: 'west Tulsa near Sand Springs' },
      '74128': { area: 'East Tulsa', landmarks: 'East Tulsa, Mingo Road area', community: 'east Tulsa along the Mingo corridor' },
      '74129': { area: 'East Tulsa', landmarks: 'East Tulsa, Garnett area', community: 'east Tulsa residential areas' },
      '74130': { area: 'North Tulsa', landmarks: 'North Tulsa, Owasso border', community: 'far north Tulsa' },
      '74131': { area: 'Southwest Tulsa', landmarks: 'Southwest Tulsa, Jenks border', community: 'southwest Tulsa near Jenks' },
      '74132': { area: 'South Tulsa', landmarks: 'South Tulsa, Creek Turnpike area', community: 'south Tulsa residential neighborhoods' },
      '74133': { area: 'South Tulsa', landmarks: 'Tulsa Hills Shopping Center, south Tulsa', community: 'the Tulsa Hills area in south Tulsa' },
      '74134': { area: 'Southeast Tulsa', landmarks: 'SE Tulsa, Bixby border', community: 'southeast Tulsa' },
      '74135': { area: 'Midtown / South Tulsa', landmarks: 'Oral Roberts University, south Tulsa', community: 'south central Tulsa near ORU' },
      '74136': { area: 'South Tulsa', landmarks: 'Southern Hills Country Club, south Tulsa', community: 'south Tulsa\'s Southern Hills area' },
      '74137': { area: 'South Tulsa', landmarks: 'Jenks border, south Tulsa shopping', community: 'far south Tulsa near Jenks' },
      '74145': { area: 'East Tulsa', landmarks: 'East Tulsa, Memorial Drive area', community: 'east Tulsa along Memorial Drive' },
      '74146': { area: 'East Tulsa', landmarks: 'East Tulsa, I-44 corridor', community: 'east Tulsa near the I-44 corridor' },
      // Broken Arrow
      '74011': { area: 'North Broken Arrow', landmarks: 'Broken Arrow Expressway, Rose District', community: 'northern Broken Arrow near the Rose District' },
      '74012': { area: 'Central Broken Arrow', landmarks: 'Broken Arrow Performing Arts Center, Central Park', community: 'the heart of Broken Arrow' },
      '74013': { area: 'South Broken Arrow', landmarks: 'south Broken Arrow neighborhoods', community: 'south Broken Arrow residential areas' },
      '74014': { area: 'East Broken Arrow', landmarks: 'east Broken Arrow, New Tulsa area', community: 'east Broken Arrow and surrounding communities' },
      // Stillwater
      '74074': { area: 'Stillwater', landmarks: 'Oklahoma State University, Boone Pickens Stadium', community: 'the Stillwater community, home of the OSU Cowboys' },
      '74075': { area: 'North Stillwater', landmarks: 'North Stillwater, Lakeview Road area', community: 'north Stillwater near the lake' },
      '74076': { area: 'Stillwater', landmarks: 'OSU campus, Downtown Stillwater', community: 'central Stillwater near Oklahoma State University' },
      // Enid
      '73701': { area: 'Enid', landmarks: 'Vance Air Force Base, Enid town square', community: 'Enid, home to Vance Air Force Base' },
      '73703': { area: 'North Enid', landmarks: 'Leonardo\'s Discovery Warehouse, Meadowlake Park', community: 'north Enid neighborhoods' },
      '73705': { area: 'East Enid', landmarks: 'Enid Woodring Regional Airport, east Enid', community: 'east Enid area' },
      // Lawton
      '73501': { area: 'Lawton', landmarks: 'Fort Sill, Museum of the Great Plains', community: 'Lawton near Fort Sill Army base' },
      '73503': { area: 'Fort Sill', landmarks: 'Fort Sill Military Reservation', community: 'the Fort Sill military community' },
      '73505': { area: 'East Lawton', landmarks: 'Cameron University, east Lawton', community: 'east Lawton near Cameron University' },
      '73507': { area: 'Lawton', landmarks: 'Wichita Mountains Wildlife Refuge nearby', community: 'Lawton near the Wichita Mountains' },
      // Ada
      '74820': { area: 'Ada', landmarks: 'East Central University, Chickasaw Nation HQ', community: 'Ada, center of the Chickasaw Nation' },
      '74821': { area: 'Ada', landmarks: 'Ada area, Valley View Regional Hospital', community: 'the Ada community in Pontotoc County' },
      // Ardmore
      '73401': { area: 'Ardmore', landmarks: 'Ardmore Convention Center, Lake Murray nearby', community: 'Ardmore, gateway to Lake Murray' },
      '73402': { area: 'Ardmore', landmarks: 'Southern Oklahoma, I-35 corridor', community: 'the Ardmore community in southern Oklahoma' },
      // Yukon
      '73099': { area: 'Yukon', landmarks: 'Czech Heritage, Route 66 landmarks, Yukon\'s Best Flour Mill', community: 'Yukon, the Czech Capital of Oklahoma' },
      '73085': { area: 'Yukon', landmarks: 'West Yukon, Canadian County', community: 'the Yukon and Canadian County area' },
      '73064': { area: 'Mustang', landmarks: 'Mustang Town Center, Wild Horse Park', community: 'the Mustang community west of OKC' },
      // Nearby Tulsa metro
      '74008': { area: 'Bixby', landmarks: 'Bixby community, south of Tulsa', community: 'the family-friendly Bixby community' },
      '74033': { area: 'Glenpool', landmarks: 'Glenpool, south Tulsa metro', community: 'Glenpool in the south Tulsa metro' },
      '74037': { area: 'Jenks', landmarks: 'Jenks Aquarium, Riverwalk', community: 'Jenks, home of the Oklahoma Aquarium' },
      '74047': { area: 'Mounds', landmarks: 'Mounds, Creek County', community: 'the Mounds community in Creek County' },
      '74063': { area: 'Sand Springs', landmarks: 'Sand Springs, Keystone Lake', community: 'Sand Springs near Keystone Lake' },
      '74066': { area: 'Sapulpa', landmarks: 'Downtown Sapulpa, Route 66 heritage', community: 'Sapulpa along historic Route 66' },
      '74070': { area: 'Skiatook', landmarks: 'Skiatook Lake, north Tulsa metro', community: 'Skiatook near the lake' },
      '74055': { area: 'Owasso', landmarks: 'Owasso, north Tulsa suburb', community: 'the growing Owasso community' },
      // Muskogee / Rogers County
      '74401': { area: 'Muskogee', landmarks: 'Honor Heights Park, USS Batfish', community: 'Muskogee, home of Honor Heights Park' },
      '74402': { area: 'Muskogee', landmarks: 'Muskogee Civic Center', community: 'the Muskogee community' },
      '74403': { area: 'East Muskogee', landmarks: 'east Muskogee, Fort Gibson border', community: 'east Muskogee area' },
      '74019': { area: 'Claremore', landmarks: 'Will Rogers Memorial, Rogers State University', community: 'Claremore, birthplace of Will Rogers' },
      '74010': { area: 'Catoosa', landmarks: 'Hard Rock Hotel & Casino, Blue Whale', community: 'Catoosa, home of the famous Blue Whale' },
      '74015': { area: 'Catoosa', landmarks: 'Cherokee Nation facilities, east Catoosa', community: 'the Catoosa community east of Tulsa' },
      '74021': { area: 'Collinsville', landmarks: 'Collinsville, north of Tulsa', community: 'the small-town Collinsville community' },
      '74003': { area: 'Bartlesville', landmarks: 'Price Tower, Woolaroc Museum', community: 'Bartlesville, home of Phillips 66 heritage' },
      '74005': { area: 'Bartlesville', landmarks: 'Downtown Bartlesville, Frank Phillips Home', community: 'Bartlesville in Washington County' },
      '74006': { area: 'Bartlesville', landmarks: 'Bartlesville area, Oklahoma Wesleyan University', community: 'the Bartlesville community' }
    };
    const localInfo = zipLocalContent[options.donateZip];
    if (localInfo) {
      const localSection = `
    <section class="py-8 bg-gray-50 dark:bg-gray-900">
      <div class="max-w-4xl mx-auto px-4">
        <h2 class="text-lg font-bold mb-3 text-gray-900 dark:text-white">Blood Donation in ${localInfo.area}</h2>
        <p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-3">
          Serving ${localInfo.community}, our nearby donor centers make it easy for residents of the ${options.donateZip} ZIP code area to donate blood or plasma.
          Near ${localInfo.landmarks}, donors can visit one of our conveniently located centers and contribute to Oklahoma's life-saving blood supply.
        </p>
        <p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          Every blood donation in ${localInfo.area} can save up to three lives. Walk-ins are welcome, or
          <a href="/how-it-works" class="text-red-700 dark:text-red-400 underline">schedule your appointment</a>
          to skip the wait. First-time donors are always welcome—check our
          <a href="/requirements" class="text-red-700 dark:text-red-400 underline">eligibility requirements</a> to get started.
        </p>
      </div>
    </section>`;
      h = h.replace('</main>', localSection + '\n  </main>');
    }
  }

  // 7) Global AEO: Upgrade Organization → MedicalOrganization on ALL pages
  // This catches pages not handled by section 4 (blog, faq, questions, guides, etc.)
  h = h.replace(
    /"@type"\s*:\s*"Organization"\s*,\s*"name"\s*:\s*"OBI Blood Donor"/g,
    '"@type":"MedicalOrganization","@id":"https://oklahomabloodinstitute.com/#organization","medicalSpecialty":"Blood Banking","name":"OBI Blood Donor","telephone":"+1-877-340-8777"'
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

  // 9) Global brand cleanup — canonical name is "OBI Blood Donor"
  h = h.replace(/Oklahoma Blood Donors/g, 'OBI Blood Donor');
  h = h.replace(/OBI Blood Donor/g, 'OBI Blood Donor');
  h = h.replace(/OK Blood Donor/g, 'OBI Blood Donor');

  // 10) Replace any remaining old logo references with new logo img
  h = h.replace(
    /<img\s+src="\/images\/obi-logo\.png"[^>]*>/gi,
    '<img src="/images/logo.png" alt="OBI Blood Donor" width="36" height="36" class="h-9 w-9 object-contain">'
  );

  // 10b) Fix logo URL in JSON-LD schema
  h = h.replace(/\/images\/obi-logo\.png/g, '/images/logo.png');
  h = h.replace(/"url"\s*:\s*"https:\/\/oklahomabloodinstitute\.com\/images\/hero-donation\.jpg"/g, '"url":"https://oklahomabloodinstitute.com/images/logo.png"');

  // 10c) Inject favicon if not present
  if (!h.includes('favicon.ico')) {
    h = h.replace(
      '<meta charset="UTF-8">',
      '<meta charset="UTF-8">\n  <link rel="icon" type="image/x-icon" href="/favicon.ico">\n  <link rel="icon" type="image/png" sizes="32x32" href="/images/favicon-32x32.png">\n  <link rel="icon" type="image/png" sizes="16x16" href="/images/favicon-16x16.png">\n  <link rel="apple-touch-icon" sizes="180x180" href="/images/apple-touch-icon.png">'
    );
  }

  // 11) Remove obi.org external links (handles nested spans inside anchors)
  h = h.replace(/<li>\s*<a\s+href="https?:\/\/obi\.org"[\s\S]*?<\/a>\s*<\/li>/gi, '');
  h = h.replace(/<a\s+href="https?:\/\/obi\.org"[\s\S]*?<\/a>/gi, '');

  // 12) Remove year dates site-wide (but preserve URLs and schema date fields)
  h = h.replace(/&copy;\s*2026\s*/g, '&copy; ');
  h = h.replace(/©\s*2026\s*/g, '© ');
  h = h.replace(/since 2026/gi, '');
  // Title/heading patterns
  h = h.replace(/– Complete 2026 Guide/g, '– Complete Guide');
  h = h.replace(/Complete 2026 Guide/g, 'Complete Guide');
  h = h.replace(/2026 Guide/g, 'Guide');
  h = h.replace(/2026 Rates/g, 'Current Rates');
  h = h.replace(/Updated 2026/g, 'Updated');
  // Body content patterns (visible text only)
  h = h.replace(/ in 2026/g, '');
  h = h.replace(/ In 2026/g, '');
  h = h.replace(/ for 2026/g, '');
  h = h.replace(/as of 2026/g, '');
  h = h.replace(/>2026 /g, '>');
  // Compensation page specific
  h = h.replace(/2026 compensation/gi, 'Current compensation');
  h = h.replace(/2026 Compensation/g, 'Current Compensation');
  h = h.replace(/2026 Enid/g, 'Enid');
  h = h.replace(/2026 area/g, 'area');
  h = h.replace(/2026 but subject/g, 'but subject');
  h = h.replace(/current as of 2026/gi, 'current');
  // Remove <time> elements with dates
  h = h.replace(/<time[^>]*>[^<]*<\/time>/g, '');
  h = h.replace(/Last reviewed:?\s*\.?\s*/g, '');

  // 13) Ensure app.js + styles.css are loaded on every page (needed for header/footer)
  if (!h.includes('/js/app.js') && h.includes('</body>')) {
    h = h.replace('</body>', '  <script src="/js/app.js"></script>\n</body>');
  }
  if (!h.includes('/css/styles.css') && h.includes('</head>')) {
    h = h.replace('</head>', '  <link rel="stylesheet" href="/css/styles.css">\n</head>');
  }

  return h;
}

// Helper: serve HTML with transformations
function serveHtml(filePath, res, options = {}) {
  fs.readFile(filePath, 'utf8', (err, html) => {
    if (err) {
      const notFound = path.join(VIEWS, '404.html');
      if (fs.existsSync(notFound)) {
        // Read + transform so 404 page gets purged CSS, a11y fixes, etc.
        const notFoundHtml = fs.readFileSync(notFound, 'utf8');
        return res.status(404).type('html').send(transformHtml(notFoundHtml));
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

// SEO landing page for scheduling (separate from the /schedule affiliate redirect)
app.get('/schedule-appointment', (req, res) => {
  serveHtml(path.join(VIEWS, 'schedule.html'), res);
});

// ─── Events ─────────────────────────────────────────────────────────
app.get('/events/all-american-blood-drives', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives.html'), res);
});

// City-specific All American Blood Drive pages (76 cities)
app.get('/events/all-american-blood-drives/ada', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'ada.html'), res);
});
app.get('/events/all-american-blood-drives/altus', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'altus.html'), res);
});
app.get('/events/all-american-blood-drives/alva', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'alva.html'), res);
});
app.get('/events/all-american-blood-drives/amarillo', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'amarillo.html'), res);
});
app.get('/events/all-american-blood-drives/bartlesville', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'bartlesville.html'), res);
});
app.get('/events/all-american-blood-drives/batesville', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'batesville.html'), res);
});
app.get('/events/all-american-blood-drives/beebe', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'beebe.html'), res);
});
app.get('/events/all-american-blood-drives/bellevue', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'bellevue.html'), res);
});
app.get('/events/all-american-blood-drives/benton', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'benton.html'), res);
});
app.get('/events/all-american-blood-drives/bethany', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'bethany.html'), res);
});
app.get('/events/all-american-blood-drives/bristow', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'bristow.html'), res);
});
app.get('/events/all-american-blood-drives/broken-arrow', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'broken-arrow.html'), res);
});
app.get('/events/all-american-blood-drives/buffalo', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'buffalo.html'), res);
});
app.get('/events/all-american-blood-drives/cabot', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'cabot.html'), res);
});
app.get('/events/all-american-blood-drives/cache', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'cache.html'), res);
});
app.get('/events/all-american-blood-drives/chattanooga', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'chattanooga.html'), res);
});
app.get('/events/all-american-blood-drives/chickasha', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'chickasha.html'), res);
});
app.get('/events/all-american-blood-drives/choctaw', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'choctaw.html'), res);
});
app.get('/events/all-american-blood-drives/clarksville', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'clarksville.html'), res);
});
app.get('/events/all-american-blood-drives/clinton', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'clinton.html'), res);
});
app.get('/events/all-american-blood-drives/conway', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'conway.html'), res);
});
app.get('/events/all-american-blood-drives/cordell', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'cordell.html'), res);
});
app.get('/events/all-american-blood-drives/dardanelle', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'dardanelle.html'), res);
});
app.get('/events/all-american-blood-drives/dewitt', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'dewitt.html'), res);
});
app.get('/events/all-american-blood-drives/duncan', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'duncan.html'), res);
});
app.get('/events/all-american-blood-drives/durant', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'durant.html'), res);
});
app.get('/events/all-american-blood-drives/elgin', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'elgin.html'), res);
});
app.get('/events/all-american-blood-drives/elk-city', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'elk-city.html'), res);
});
app.get('/events/all-american-blood-drives/enid', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'enid.html'), res);
});
app.get('/events/all-american-blood-drives/eufaula', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'eufaula.html'), res);
});
app.get('/events/all-american-blood-drives/fairview', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'fairview.html'), res);
});
app.get('/events/all-american-blood-drives/fort-cobb', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'fort-cobb.html'), res);
});
app.get('/events/all-american-blood-drives/fort-sill', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'fort-sill.html'), res);
});
app.get('/events/all-american-blood-drives/fort-smith', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'fort-smith.html'), res);
});
app.get('/events/all-american-blood-drives/friona', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'friona.html'), res);
});
app.get('/events/all-american-blood-drives/guthrie', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'guthrie.html'), res);
});
app.get('/events/all-american-blood-drives/haskell', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'haskell.html'), res);
});
app.get('/events/all-american-blood-drives/heber-springs', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'heber-springs.html'), res);
});
app.get('/events/all-american-blood-drives/hereford', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'hereford.html'), res);
});
app.get('/events/all-american-blood-drives/hooker', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'hooker.html'), res);
});
app.get('/events/all-american-blood-drives/hot-springs', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'hot-springs.html'), res);
});
app.get('/events/all-american-blood-drives/hugo', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'hugo.html'), res);
});
app.get('/events/all-american-blood-drives/idabel', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'idabel.html'), res);
});
app.get('/events/all-american-blood-drives/kingfisher', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'kingfisher.html'), res);
});
app.get('/events/all-american-blood-drives/lakeside-city', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'lakeside-city.html'), res);
});
app.get('/events/all-american-blood-drives/lawton', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'lawton.html'), res);
});
app.get('/events/all-american-blood-drives/little-rock', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'little-rock.html'), res);
});
app.get('/events/all-american-blood-drives/mcalester', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'mcalester.html'), res);
});
app.get('/events/all-american-blood-drives/midwest-city', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'midwest-city.html'), res);
});
app.get('/events/all-american-blood-drives/morrilton', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'morrilton.html'), res);
});
app.get('/events/all-american-blood-drives/norman', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'norman.html'), res);
});
app.get('/events/all-american-blood-drives/north-little-rock', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'north-little-rock.html'), res);
});
app.get('/events/all-american-blood-drives/okeene', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'okeene.html'), res);
});
app.get('/events/all-american-blood-drives/oklahoma-city', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'oklahoma-city.html'), res);
});
app.get('/events/all-american-blood-drives/pauls-valley', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'pauls-valley.html'), res);
});
app.get('/events/all-american-blood-drives/pawhuska', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'pawhuska.html'), res);
});
app.get('/events/all-american-blood-drives/perkins', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'perkins.html'), res);
});
app.get('/events/all-american-blood-drives/perry', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'perry.html'), res);
});
app.get('/events/all-american-blood-drives/pine-bluff', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'pine-bluff.html'), res);
});
app.get('/events/all-american-blood-drives/ponca-city', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'ponca-city.html'), res);
});
app.get('/events/all-american-blood-drives/rush-springs', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'rush-springs.html'), res);
});
app.get('/events/all-american-blood-drives/russellville', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'russellville.html'), res);
});
app.get('/events/all-american-blood-drives/searcy', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'searcy.html'), res);
});
app.get('/events/all-american-blood-drives/seiling', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'seiling.html'), res);
});
app.get('/events/all-american-blood-drives/seminole', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'seminole.html'), res);
});
app.get('/events/all-american-blood-drives/shawnee', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'shawnee.html'), res);
});
app.get('/events/all-american-blood-drives/skiatook', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'skiatook.html'), res);
});
app.get('/events/all-american-blood-drives/spearman', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'spearman.html'), res);
});
app.get('/events/all-american-blood-drives/tecumseh', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'tecumseh.html'), res);
});
app.get('/events/all-american-blood-drives/tulsa', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'tulsa.html'), res);
});
app.get('/events/all-american-blood-drives/vernon', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'vernon.html'), res);
});
app.get('/events/all-american-blood-drives/windthorst', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'windthorst.html'), res);
});
app.get('/events/all-american-blood-drives/woodward', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'woodward.html'), res);
});
app.get('/events/all-american-blood-drives/wynnewood', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'wynnewood.html'), res);
});
app.get('/events/all-american-blood-drives/yale', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'yale.html'), res);
});
app.get('/events/all-american-blood-drives/yukon', (req, res) => {
  serveHtml(path.join(VIEWS, 'events', 'all-american-blood-drives', 'yukon.html'), res);
});

// North Oklahoma City donor center
app.get('/locations/north-oklahoma-city', (req, res) => {
  serveHtml(path.join(VIEWS, 'locations', 'north-oklahoma-city.html'), res);
});

app.get('/locations', (req, res) => {
  serveHtml(path.join(VIEWS, 'locations.html'), res);
});

app.get('/how-it-works', (req, res) => {
  serveHtml(path.join(VIEWS, 'how-it-works.html'), res);
});

app.get('/blood-types', (req, res) => {
  // Serve the guides/blood-types content at /blood-types
  serveHtml(path.join(VIEWS, 'guides', 'blood-types.html'), res);
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
  serveHtml(path.join(VIEWS, 'plasma', 'oklahoma-city.html'), res, { plasmaSlug: 'oklahoma-city', fixYear: true });
});

app.get('/plasma/tulsa', (req, res) => {
  serveHtml(path.join(VIEWS, 'plasma', 'tulsa.html'), res, { plasmaSlug: 'tulsa', fixYear: true });
});

app.get('/plasma/norman', (req, res) => {
  serveHtml(path.join(VIEWS, 'plasma', 'norman.html'), res, { plasmaSlug: 'norman', fixYear: true });
});

app.get('/plasma/edmond', (req, res) => {
  serveHtml(path.join(VIEWS, 'plasma', 'edmond.html'), res, { plasmaSlug: 'edmond', fixYear: true });
});

app.get('/plasma/lawton', (req, res) => {
  serveHtml(path.join(VIEWS, 'plasma', 'lawton.html'), res, { plasmaSlug: 'lawton', fixYear: true });
});

app.get('/plasma/broken-arrow', (req, res) => {
  serveHtml(path.join(VIEWS, 'plasma', 'broken-arrow.html'), res, { plasmaSlug: 'broken-arrow', fixYear: true });
});

app.get('/plasma/enid', (req, res) => {
  serveHtml(path.join(VIEWS, 'plasma', 'enid.html'), res, { plasmaSlug: 'enid', fixYear: true });
});

app.get('/plasma/midwest-city', (req, res) => {
  serveHtml(path.join(VIEWS, 'plasma', 'midwest-city.html'), res, { plasmaSlug: 'midwest-city', fixYear: true });
});


app.get('/plasma/moore', (req, res) => {
  serveHtml(path.join(VIEWS, 'plasma', 'moore.html'), res, { plasmaSlug: 'moore', fixYear: true });
});

app.get('/blog', (req, res) => {
  serveHtml(path.join(VIEWS, 'blog.html'), res, { fixYear: true });
});
// Catch trailing-slash variant to prevent unnecessary 301 redirect
app.get('/blog/', (req, res) => {
  serveHtml(path.join(VIEWS, 'blog.html'), res, { fixYear: true });
});

app.get('/privacy', (req, res) => {
  serveHtml(path.join(VIEWS, 'privacy.html'), res);
});

app.get('/privacy-policy', (req, res) => {
  serveHtml(path.join(VIEWS, 'privacy-policy.html'), res);
});

app.get('/terms', (req, res) => {
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
  serveHtml(path.join(VIEWS, 'questions', `${req.params.slug}.html`), res, { questionSlug: req.params.slug });
});

// Blood type detail pages
app.get('/blood-types/:slug', (req, res) => {
  serveHtml(path.join(VIEWS, 'blood-types', `${req.params.slug}.html`), res, { bloodTypeSlug: req.params.slug });
});

// Plasma city pages
app.get('/plasma/:slug', (req, res) => {
  serveHtml(path.join(VIEWS, 'plasma', `${req.params.slug}.html`), res, { plasmaSlug: req.params.slug, fixYear: true });
});

// Platelet donation hub
app.get('/platelets', (req, res) => {
  serveHtml(path.join(VIEWS, 'platelets', 'index.html'), res);
});

// Platelet donation city pages
app.get('/platelets/:slug', (req, res) => {
  serveHtml(path.join(VIEWS, 'platelets', `${req.params.slug}.html`), res);
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
    res,
    { donateZip: req.params.zip }
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

      // Auto-create signups table if it doesn't exist
      await pool.query(`
        CREATE TABLE IF NOT EXISTS signups (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          zip_code TEXT NOT NULL,
          blood_type TEXT DEFAULT 'unknown',
          phone TEXT,
          dob TEXT,
          source TEXT DEFAULT 'web',
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

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

// ─── Human-Readable Sitemap (HTML) ──────────────────────────────────
// Footer links here. /sitemap.xml stays as pure XML for bots.
app.get('/sitemap', (req, res) => {
  const sitemapPath = path.join(__dirname, 'public', 'sitemap.xml');
  const viewsSitemap = path.join(VIEWS, 'sitemap.xml');
  let xml;
  if (fs.existsSync(sitemapPath)) {
    try { xml = fs.readFileSync(sitemapPath, 'utf8'); } catch (e) { /* fall through */ }
  }
  if (!xml && fs.existsSync(viewsSitemap)) {
    try { xml = fs.readFileSync(viewsSitemap, 'utf8'); } catch (e) { /* fall through */ }
  }
  if (!xml) return res.status(404).send('Sitemap not found');

  const urls = [];
  const urlRegex = /<url>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]*)<\/lastmod>)?(?:\s*<changefreq>([^<]*)<\/changefreq>)?(?:\s*<priority>([^<]*)<\/priority>)?\s*<\/url>/g;
  let m;
  while ((m = urlRegex.exec(xml)) !== null) {
    urls.push({ loc: m[1], lastmod: m[2] || '', changefreq: m[3] || '', priority: m[4] || '' });
  }
  const rows = urls.map(u =>
    `<tr><td><a href="${u.loc}">${u.loc.replace('https://oklahomabloodinstitute.com','')|| '/'}</a></td><td>${u.lastmod}</td><td>${u.priority}</td></tr>`
  ).join('\\n');

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sitemap — OBI Blood Donor</title>
<link rel="canonical" href="https://oklahomabloodinstitute.com/sitemap">
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;color:#1f2937;padding:2rem;max-width:1200px;margin:0 auto}
h1{font-size:2rem;margin-bottom:.5rem}p.sub{color:#6b7280;margin-bottom:2rem}.count{color:#b91c1c;font-weight:700}
table{width:100%;border-collapse:collapse;box-shadow:0 1px 3px rgba(0,0,0,.1);border-radius:.5rem;overflow:hidden}
thead{background:#b91c1c}th{color:#fff;padding:.75rem 1rem;text-align:left;font-size:.9rem}
td{padding:.75rem 1rem;font-size:.9rem;border-bottom:1px solid #e5e7eb}tr:hover{background:#f9fafb}
a{color:#b91c1c;text-decoration:none}a:hover{text-decoration:underline}
@media(max-width:768px){body{padding:1rem}th,td{padding:.5rem;font-size:.8rem}}</style></head>
<body><h1>Sitemap</h1><p class="sub">OBI Blood Donor &mdash; <span class="count">${urls.length}</span> pages</p>
<table><thead><tr><th>URL</th><th>Last Modified</th><th>Priority</th></tr></thead><tbody>${rows}</tbody></table>
<p style="margin-top:2rem;font-size:.8rem;color:#9ca3af">This sitemap helps search engines discover all pages on our site.</p></body></html>`;

  res.set('Content-Type', 'text/html');
  res.set('Cache-Control', 'public, max-age=3600');
  return res.status(200).send(html);
});

// ─── Robots.txt ─────────────────────────────────────────────────────
app.get('/robots.txt', (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600'); // 1 hour — never cache robots.txt for days
  res.type('text').send(
    `User-agent: *\nAllow: /\n\nSitemap: https://oklahomabloodinstitute.com/sitemap.xml\n`
  );
});

// ─── Campus Cluster Pages ──────────────────────────────────────────
app.get('/campuses', (req, res) => {
  serveHtml(path.join(VIEWS, 'campuses', 'index.html'), res);
});

app.get('/campuses/osu', (req, res) => {
  serveHtml(path.join(VIEWS, 'campuses', 'osu.html'), res);
});

app.get('/campuses/osu/blood-drive', (req, res) => {
  serveHtml(path.join(VIEWS, 'campuses', 'osu', 'blood-drive.html'), res);
});

app.get('/campuses/ou', (req, res) => {
  serveHtml(path.join(VIEWS, 'campuses', 'ou.html'), res);
});

app.get('/campuses/ou/blood-drive', (req, res) => {
  serveHtml(path.join(VIEWS, 'campuses', 'ou', 'blood-drive.html'), res);
});

// ─── Compare Cluster Pages ───────────────────────────────────────────
app.get('/compare', (req, res) => {
  serveHtml(path.join(VIEWS, 'compare', 'index.html'), res);
});

// Redirects for old/short compare URLs
app.get('/compare/blood-vs-plasma', (req, res) => {
  res.redirect(301, '/compare/whole-blood-vs-plasma');
});
app.get('/compare/obi-vs-red-cross', (req, res) => {
  res.redirect(301, '/compare');
});
app.get('/compare/obi-vs-oneblood', (req, res) => {
  res.redirect(301, '/compare');
});

app.get('/compare/:slug', (req, res) => {
  serveHtml(path.join(VIEWS, 'compare', `${req.params.slug}.html`), res);
});

// ─── FAQ Children Pages ──────────────────────────────────────────────
app.get('/faq/:slug', (req, res) => {
  serveHtml(path.join(VIEWS, 'faq', `${req.params.slug}.html`), res);
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
    // Read + transform so 404 page gets purged CSS, a11y fixes, etc.
    const html = fs.readFileSync(notFound, 'utf8');
    return res.status(404).type('html').send(transformHtml(html));
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
