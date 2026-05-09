// Oklahoma Blood Donors - Client-side JavaScript

// ============================================================
// DONABLE REDIRECT — fixes all 38 broken signup CTAs
// Added: 2026-05-09  |  Ticket: P0-05
// ============================================================
var DONABLE_URL = 'https://donableapp.com/register/1664F99D-8703-F111-8D4C-002248480912';

// Safe GA4 event helper — no-ops gracefully if GA4 script isn't loaded
function trackEvent(eventName, params) {
  if (typeof gtag === 'function') {
    gtag('event', eventName, params || {});
  }
}

// Page view tracker — captures UTM params and referrer for traffic attribution
function trackPageView() {
  var params = new URLSearchParams(window.location.search);
  fetch('/api/track/page-view', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: window.location.pathname,
      referrer: document.referrer || null,
      utm_source: params.get('utm_source') || null,
      utm_medium: params.get('utm_medium') || null,
      utm_campaign: params.get('utm_campaign') || null,
    })
  }).catch(function() {}); // silent — never block page
}

// Theme toggle
function initTheme() {
  const theme = localStorage.getItem('theme') || 'light';
  document.documentElement.classList.toggle('dark', theme === 'dark');
  updateThemeIcon();
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  updateThemeIcon();
  trackEvent('theme_toggle', { theme: isDark ? 'dark' : 'light' });
}

function updateThemeIcon() {
  const isDark = document.documentElement.classList.contains('dark');
  const sunIcon = document.getElementById('sun-icon');
  const moonIcon = document.getElementById('moon-icon');
  if (sunIcon && moonIcon) {
    sunIcon.style.display = isDark ? 'none' : 'block';
    moonIcon.style.display = isDark ? 'block' : 'none';
  }
}

// Mobile navigation
function toggleMobileNav() {
  const overlay = document.getElementById('mobile-nav-overlay');
  const nav = document.getElementById('mobile-nav');
  if (overlay && nav) {
    overlay.classList.toggle('open');
    nav.classList.toggle('open');
  }
}

function closeMobileNav() {
  const overlay = document.getElementById('mobile-nav-overlay');
  const nav = document.getElementById('mobile-nav');
  if (overlay && nav) {
    overlay.classList.remove('open');
    nav.classList.remove('open');
  }
}

// Dismiss urgency banner
function dismissUrgencyBanner() {
  var banner = document.getElementById('urgency-banner');
  if (banner) {
    banner.style.display = 'none';
    try { sessionStorage.setItem('urgency-banner-dismissed', '1'); } catch(e) {}
    trackEvent('urgency_banner_dismiss');
  }
}

// Restore banner on page load if not dismissed in this session
function restoreUrgencyBanner() {
  try {
    if (!sessionStorage.getItem('urgency-banner-dismissed')) {
      var banner = document.getElementById('urgency-banner');
      if (banner) banner.style.display = '';
    }
  } catch(e) {}
}

// FAQ accordion
function toggleFaq(element) {
  const answer = element.nextElementSibling;
  const icon = element.querySelector('.faq-icon');

  document.querySelectorAll('.faq-answer.open').forEach(el => {
    if (el !== answer) {
      el.classList.remove('open');
      el.style.maxHeight = '0';
      el.style.padding = '0 1.5rem';
      const otherIcon = el.previousElementSibling.querySelector('.faq-icon');
      if (otherIcon) otherIcon.style.transform = 'rotate(0deg)';
    }
  });

  if (answer.classList.contains('open')) {
    answer.classList.remove('open');
    answer.style.maxHeight = '0';
    answer.style.padding = '0 1.5rem';
    if (icon) icon.style.transform = 'rotate(0deg)';
  } else {
    answer.classList.add('open');
    answer.style.maxHeight = answer.scrollHeight + 32 + 'px';
    answer.style.padding = '1rem 1.5rem';
    if (icon) icon.style.transform = 'rotate(180deg)';
  }
}

// FAQ category filter
function filterFaq(category) {
  const items = document.querySelectorAll('.faq-item');
  const buttons = document.querySelectorAll('.category-btn');

  buttons.forEach(btn => {
    btn.classList.remove('active', 'bg-red-700', 'text-white');
    btn.classList.add('bg-gray-100', 'text-gray-700');
    if (document.documentElement.classList.contains('dark')) {
      btn.classList.remove('bg-gray-100', 'text-gray-700');
      btn.classList.add('bg-gray-800', 'text-gray-300');
    }
  });

  var activeBtn = document.querySelector('[data-category="' + category + '"\]');
  if (activeBtn) {
    activeBtn.classList.add('active', 'bg-red-700', 'text-white');
    activeBtn.classList.remove('bg-gray-100', 'text-gray-700', 'bg-gray-800', 'text-gray-300');
  }

  items.forEach(item => {
    if (category === 'All' || item.dataset.category === category) {
      item.style.display = 'block';
    } else {
      item.style.display = 'none';
    }
  });
}

// Blog category filter
function filterBlog(category) {
  const cards = document.querySelectorAll('.blog-card');
  const buttons = document.querySelectorAll('.blog-filter-btn');

  buttons.forEach(btn => {
    btn.classList.remove('active', 'bg-red-700', 'text-white');
    btn.classList.add('bg-gray-100', 'text-gray-700');
  });

  var activeBtn = document.querySelector('[data-blog-category="' + category + '"\]');
  if (activeBtn) {
    activeBtn.classList.add('active', 'bg-red-700', 'text-white');
    activeBtn.classList.remove('bg-gray-100', 'text-gray-700');
  }

  cards.forEach(card => {
    if (category === 'All Articles' || card.dataset.category === category) {
      card.style.display = 'block';
    } else {
      card.style.display = 'none';
    }
  });
}

// Inline validation helper
function validateField(id, validator) {
  var el = document.getElementById(id);
  var errorEl = document.getElementById(id + '-error');
  if (!el || !errorEl) return true;
  var value = el.value.trim();
  var result = validator(value);
  if (result !== true) {
    el.classList.add('border-red-500');
    el.classList.remove('border-gray-300', 'border-gray-700');
    errorEl.textContent = result;
    errorEl.classList.remove('hidden');
    return false;
  }
  el.classList.remove('border-red-500');
  el.classList.add('border-gray-300', 'border-gray-700');
  errorEl.classList.add('hidden');
  return true;
}

function clearFieldError(el) {
  var errorEl = document.getElementById(el.id + '-error');
  if (errorEl) {
    errorEl.classList.add('hidden');
    el.classList.remove('border-red-500');
  }
}

// Donation schedule form — PATCHED: saves locally then redirects to Donable
async function submitScheduleForm(event) {
  event.preventDefault();
  var form = event.target;

  // Inline validation
  var nameOk = validateField('name', function(v) { return v.length >= 2 ? true : 'Please enter your full name'; });
  var emailOk = validateField('email', function(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? true : 'Please enter a valid email address'; });
  var zipOk = validateField('zip_code', function(v) { return /^7[34][0-9]{3}$/.test(v) ? true : 'Please enter a valid Oklahoma ZIP code (73000-74999)'; });
  if (!nameOk || !emailOk || !zipOk) return;

  var formData = new FormData(form);
  var data = {
    name: formData.get('name') || '',
    email: formData.get('email') || '',
    zip_code: formData.get('zip_code') || '',
    blood_type: formData.get('blood_type') || 'unknown'
  };

  var submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) {
    var originalText = submitBtn.textContent;
    submitBtn.textContent = 'Redirecting to scheduler...';
    submitBtn.disabled = true;
  }

  try {
    // Save locally for analytics (fire-and-forget)
    fetch('/api/signups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).catch(function() {}); // don't block redirect if local save fails

    trackEvent('donate_signup', { blood_type: data.blood_type, zip_code: data.zip_code });
    trackEvent('form_submit', { form_name: 'donor_signup', page_url: window.location.pathname });

    // REDIRECT TO DONABLE — the actual scheduling system
    window.location.href = DONABLE_URL;

  } catch (err) {
    // Even if tracking fails, send them to Donable
    window.location.href = DONABLE_URL;
  }
}

function showFormError(form, message) {
  var errorEl = form.querySelector('.form-error');
  if (!errorEl) {
    errorEl = document.createElement('div');
    errorEl.className = 'form-error text-red-600 text-sm mt-2 p-3 bg-red-50 rounded-lg';
    form.appendChild(errorEl);
  }
  errorEl.textContent = message;
  setTimeout(function() { if (errorEl.parentNode) errorEl.remove(); }, 5000);
}

// Defer hero video autoplay until after LCP is painted to avoid competing for bandwidth
function initHeroVideo() {
  var video = document.querySelector('.hero-video');
  if (!video) return;
  // Only autoplay after a short delay post-page-load so LCP image has priority
  setTimeout(function() {
    video.play().catch(function() {}); // silently ignore autoplay block
  }, 800);
}

// ============================================================
// DONABLE LINK REWRITER — rewrites all CTA links to Donable
// This runs on every page load and catches ALL href="#schedule-form",
// href="/#schedule-form", and href="/donate" CTA links.
// ============================================================
function rewriteCtaLinks() {
  // Rewrite all schedule-form anchor links
  document.querySelectorAll('a[href="#schedule-form"], a[href="/#schedule-form"]').forEach(function(link) {
    link.href = DONABLE_URL;
    link.addEventListener('click', function() {
      trackEvent('cta_click_donable', { original_href: 'schedule-form', button_text: link.textContent.trim() });
    });
  });

  // Rewrite /donate CTA links (on city pages)
  document.querySelectorAll('a[href="/donate"]').forEach(function(link) {
    var text = link.textContent.trim().toLowerCase();
    if (text.includes('schedule') || text.includes('sign up') || text.includes('donate') || text.includes('now')) {
      link.href = DONABLE_URL;
      link.addEventListener('click', function() {
        trackEvent('cta_click_donable', { original_href: '/donate', button_text: link.textContent.trim() });
      });
    }
  });
}

// ============================================================
// HIDE DUMMY FORM — removes the local signup form from homepage,
// keeps QR code visible and centers it
// ============================================================
function hideDummyForm() {
  // Find the form and hide its parent column
  var form = document.querySelector('form.schedule-form');
  if (form) {
    var formColumn = form.closest('div'); // the grid column wrapping the form
    if (formColumn) {
      formColumn.style.display = 'none';
    }

    // Make the grid single-column so QR code centers
    var grid = form.closest('.grid');
    if (grid) {
      grid.classList.remove('md:grid-cols-2');
      grid.classList.add('md:grid-cols-1');
      grid.style.maxWidth = '400px';
      grid.style.margin = '0 auto';
    }
  }

  // Update the section heading since the form is gone
  var sectionHeadings = document.querySelectorAll('h2');
  sectionHeadings.forEach(function(h2) {
    if (h2.textContent.trim() === 'Ready to Donate?') {
      // Update the subtitle to remove "fill out the quick form" reference
      var subtitle = h2.nextElementSibling;
      if (subtitle && subtitle.tagName === 'P') {
        subtitle.textContent = 'Scan the QR code on your phone to schedule, or tap the button below.';
      }
    }
  });

  // Add a prominent Donable CTA button below the QR code section
  var qrContainer = document.querySelector('form.schedule-form');
  if (!qrContainer) {
    // Form is hidden, find the QR code's parent section and add a button
    var qrImages = document.querySelectorAll('img[src*="chat2db"]');
    qrImages.forEach(function(img) {
      // Only add button in the bottom section (not the hero)
      var section = img.closest('section');
      if (section && !section.querySelector('.hero-video')) {
        var existingBtn = section.querySelector('.donable-cta-added');
        if (!existingBtn) {
          var btnContainer = document.createElement('div');
          btnContainer.className = 'donable-cta-added text-center mt-6';
          btnContainer.innerHTML = '<a href="' + DONABLE_URL + '" class="inline-flex items-center justify-center rounded-md text-sm font-bold h-12 px-8 text-white shadow-lg" style="background-color: oklch(0.547 0.213 27.325)">Schedule My Donation</a>';
          var qrParent = img.closest('.qr-container');
          if (qrParent && qrParent.parentElement) {
            qrParent.parentElement.appendChild(btnContainer);
          }
        }
      }
    });
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  initTheme();

  // Track page view with UTM attribution
  trackPageView();

  // Defer hero video until after page is interactive
  initHeroVideo();

  // *** DONABLE REDIRECT: Rewrite all CTA links to point to Donable ***
  rewriteCtaLinks();

  // *** HIDE DUMMY FORM: Remove the local form, keep QR code ***
  hideDummyForm();

  // Hide sticky bar when near top of page (don't cover hero content)
  var stickyBar = document.getElementById('sticky-mobile-cta');
  if (stickyBar) {
    function updateStickyVisibility() {
      stickyBar.style.display = (window.scrollY < 300) ? 'none' : '';
    }
    updateStickyVisibility();
    window.addEventListener('scroll', updateStickyVisibility, { passive: true });
  }

  // Restore urgency banner if not dismissed in this session
  restoreUrgencyBanner();

  // Smooth scroll for anchor links on the same page
  // NOTE: Most #schedule-form links are now rewritten to Donable by rewriteCtaLinks().
  // This handler still catches any remaining same-page anchors.
  document.querySelectorAll('a[href^="#"], a[href^="/#"]').forEach(function(link) {
    link.addEventListener('click', function(e) {
      var href = this.getAttribute('href');
      // Skip if already rewritten to Donable
      if (href.startsWith('http')) return;
      // For "/#section" links, extract the hash part and only smooth-scroll if we're on the homepage
      var hash = href;
      if (href.startsWith('/#')) {
        if (window.location.pathname === '/') {
          hash = href.substring(1); // "/#foo" → "#foo"
        } else {
          return; // On a different page, let the browser navigate normally
        }
      }
      var target = document.querySelector(hash);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
        // Update URL hash without triggering a page reload
        if (history.pushState) {
          history.pushState(null, null, hash);
        }
      }
    });
  });

  // CTA button click tracking
  document.querySelectorAll('[data-ga-cta]').forEach(function(el) {
    el.addEventListener('click', function() {
      trackEvent('cta_click', { button_location: el.getAttribute('data-ga-cta') });
    });
  });
});
