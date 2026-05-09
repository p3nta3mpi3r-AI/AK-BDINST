// OK Blood Donor - Client-side JavaScript

// Safe GA4 event helper — no-ops gracefully if GA4 script isn't loaded
function trackEvent(eventName, params) {
  if (typeof gtag === 'function') {
    gtag('event', eventName, params || {});
  }
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

  var activeBtn = document.querySelector('[data-category="' + category + '"]');
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

  var activeBtn = document.querySelector('[data-blog-category="' + category + '"]');
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

// Donation schedule form
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
    submitBtn.textContent = 'Signing up...';
    submitBtn.disabled = true;
  }

  try {
    var response = await fetch('/api/signups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    var result = await response.json();

    if (response.ok) {
      trackEvent('donate_signup', { blood_type: data.blood_type, zip_code: data.zip_code });
      // Also track form event client-side for GA4
      trackEvent('form_submit', { form_name: 'donor_signup', page_url: window.location.pathname });
      var shareUrl = encodeURIComponent(window.location.href);
      var shareText = encodeURIComponent('I just signed up to donate blood in Oklahoma \u2014 it takes less than 2 minutes and saves 3 lives. Join me: ' + window.location.href);
      form.innerHTML = '<div class="text-center py-8"><div class="text-5xl mb-3">\uD83C\uDFC6</div><h3 class="text-xl font-bold text-green-600 mb-1">You\'re Signed Up!</h3><p class="text-gray-600 dark:text-gray-400 mb-5">Thank you for becoming a blood donor in Oklahoma. Check your email for next steps \u2014 every donation can save up to 3 lives.</p><p class="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300">Share with a friend:</p><div class="flex justify-center gap-3 flex-wrap"><a href="https://twitter.com/intent/tweet?text=' + shareText + '" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors">X (Twitter)</a><a href="https://www.facebook.com/sharer/sharer.php?u=' + shareUrl + '" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-lg transition-colors">Facebook</a><a href="https://wa.me/?text=' + shareText + '" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors">WhatsApp</a><a href="mailto:?subject=Sign+up+to+donate+blood&body=I+just+signed+up+to+donate+blood+in+Oklahoma.+It+takes+less+than+2+minutes+and+saves+3+lives.+Join+me:+' + shareUrl + '" class="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors">Email</a></div></div>';
    } else {
      if (submitBtn) {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
      showFormError(form, result.error || 'Something went wrong. Please try again.');
    }
  } catch (err) {
    if (submitBtn) {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
    showFormError(form, 'Network error. Please check your connection and try again.');
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

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  initTheme();

  // Defer hero video until after page is interactive
  initHeroVideo();

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

  // Legacy #schedule alias — redirect to #schedule-form for backward compatibility
  // (older content pages and external bookmarks may still use /#schedule)
  if (window.location.hash === '#schedule') {
    history.replaceState(null, null, '#schedule-form');
    var scheduleTarget = document.getElementById('schedule-form');
    if (scheduleTarget) {
      setTimeout(function() {
        scheduleTarget.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }

  // Smooth scroll for anchor links on the same page
  // Handles both href="#section" and href="/#section" (when already on homepage)
  document.querySelectorAll('a[href^="#"], a[href^="/#"]').forEach(function(link) {
    link.addEventListener('click', function(e) {
      var href = this.getAttribute('href');
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
