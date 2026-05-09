// Oklahoma Blood Donors — Express Server
// Hosted on Render.com behind Cloudflare
//
// NOTE: If you already have a server.js on Render, you only need to add
// the /schedule route (search "SCHEDULE PAGE" below) and copy schedule.html
// into your project root.

const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ───────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// No-cache for HTML pages (Cloudflare handles CDN caching)
app.use((req, res, next) => {
  if (req.accepts('html')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Static files (css/, js/, images/)
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '7d',
  etag: true
}));

// ── HTML Page Routes ────────────────────────────────────────────────
// Each route serves a pre-built HTML file from the views/ directory.
// Adjust paths if your file structure differs.

const VIEWS = path.join(__dirname, 'views');

app.get('/', (req, res) => {
  res.sendFile(path.join(VIEWS, 'index.html'));
});

// ┌──────────────────────────────────────────────────────────────────┐
// │  SCHEDULE PAGE — serves the standalone Donable registration form │
// │  This replaces the old redirect: res.redirect('/#schedule-form') │
// └──────────────────────────────────────────────────────────────────┘
app.get('/schedule', (req, res) => {
  res.sendFile(path.join(VIEWS, 'schedule.html'));
});

app.get('/locations', (req, res) => {
  res.sendFile(path.join(VIEWS, 'locations.html'));
});

app.get('/how-it-works', (req, res) => {
  res.sendFile(path.join(VIEWS, 'how-it-works.html'));
});

app.get('/blood-types', (req, res) => {
  res.sendFile(path.join(VIEWS, 'blood-types.html'));
});

app.get('/questions', (req, res) => {
  res.sendFile(path.join(VIEWS, 'questions.html'));
});

app.get('/about', (req, res) => {
  res.sendFile(path.join(VIEWS, 'about.html'));
});

app.get('/blog', (req, res) => {
  res.sendFile(path.join(VIEWS, 'blog.html'));
});

app.get('/privacy', (req, res) => {
  res.sendFile(path.join(VIEWS, 'privacy.html'));
});

// Content sub-pages (questions, plasma cities, news)
app.get('/questions/:slug', (req, res, next) => {
  const filePath = path.join(VIEWS, 'questions', req.params.slug + '.html');
  res.sendFile(filePath, (err) => { if (err) next(); });
});

app.get('/plasma/:slug', (req, res, next) => {
  const filePath = path.join(VIEWS, 'plasma', req.params.slug + '.html');
  res.sendFile(filePath, (err) => { if (err) next(); });
});

app.get('/donate-blood/:slug', (req, res, next) => {
  const filePath = path.join(VIEWS, 'donate-blood', req.params.slug + '.html');
  res.sendFile(filePath, (err) => { if (err) next(); });
});

app.get('/news/:slug', (req, res, next) => {
  const filePath = path.join(VIEWS, 'news', req.params.slug + '.html');
  res.sendFile(filePath, (err) => { if (err) next(); });
});

// ── API Routes ──────────────────────────────────────────────────────

// Signup endpoint (donor registration)
app.post('/api/signups', async (req, res) => {
  const { name, email, zip_code, blood_type } = req.body;

  // Validation
  if (!name || name.trim().length < 2) {
    return res.status(400).json({ error: 'Name is required' });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email is required' });
  }
  if (!zip_code || !/^7[34][0-9]{3}$/.test(zip_code)) {
    return res.status(400).json({ error: 'Valid Oklahoma ZIP code is required (73xxx or 74xxx)' });
  }

  try {
    // TODO: Insert into your database (SQLite, Postgres, etc.)
    // const result = await db.run(
    //   'INSERT INTO signups (name, email, zip_code, blood_type) VALUES (?, ?, ?, ?)',
    //   [name.trim(), email.trim(), zip_code, blood_type || 'unknown']
    // );
    //
    // For now, log and return success:
    console.log(`New signup: ${name} (${zip_code})`);

    res.status(201).json({
      success: true,
      message: 'Thank you for signing up!',
      signup_id: Date.now().toString(36)
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// ── 404 Handler ─────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).sendFile(path.join(VIEWS, '404.html'), (err) => {
    if (err) {
      res.status(404).send('<h1>Page Not Found</h1>');
    }
  });
});

// ── Start Server ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`OK Blood Donor server running on port ${PORT}`);
});
