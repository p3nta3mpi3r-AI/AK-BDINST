#!/usr/bin/env python3
"""
Patch all 10 /donate-blood pages to be transactional landing pages.
Changes per file:
1. Title: "Donate Blood in {City}, OK" -> "Schedule Blood Donation in {City}, OK — Book Today"
2. Meta description -> transactional version
3. H1: "Donate Blood in {City}, OK" -> "Schedule Your Blood Donation in {City}"
4. Add answer-first scheduling CTA block near top (after Quick Answer box)
5. Canonical stays as-is (already correct)
6. Add internal link to /locations/{city} page
"""

import re
import os

DONABLE_LINK = "https://donableapp.com/register/1664F99D-8703-F111-8D4C-002248480912"

cities = {
    "ada": {
        "name": "Ada",
        "slug": "ada",
        "state": "OK",
        "tagline": "Blood donations in Ada support Mercy Hospital Ada and Valley View Regional Hospital."
    },
    "ardmore": {
        "name": "Ardmore",
        "slug": "ardmore",
        "state": "OK",
        "tagline": "Your donation in Ardmore supports Mercy Hospital Ardmore and patients across south-central Oklahoma."
    },
    "broken-arrow": {
        "name": "Broken Arrow",
        "slug": "broken-arrow",
        "state": "OK",
        "tagline": "Broken Arrow donors support Saint Francis Hospital South and the Tulsa metro blood supply."
    },
    "edmond": {
        "name": "Edmond",
        "slug": "edmond",
        "state": "OK",
        "tagline": "Edmond donors help supply OU Health, Mercy, and hospitals across the Oklahoma City metro."
    },
    "enid": {
        "name": "Enid",
        "slug": "enid",
        "state": "OK",
        "tagline": "Enid donations support INTEGRIS Bass Baptist Health Center and northwest Oklahoma communities."
    },
    "lawton": {
        "name": "Lawton",
        "slug": "lawton",
        "state": "OK",
        "tagline": "Lawton donors support Comanche County Memorial Hospital and southwest Oklahoma patients."
    },
    "norman": {
        "name": "Norman",
        "slug": "norman",
        "state": "OK",
        "tagline": "Norman donors help supply Norman Regional Health System and the broader Oklahoma City metro."
    },
    "oklahoma-city": {
        "name": "Oklahoma City",
        "slug": "oklahoma-city",
        "state": "OK",
        "tagline": "Oklahoma City donors support OU Health, Mercy, SSM Health, and hospitals across central Oklahoma."
    },
    "tulsa": {
        "name": "Tulsa",
        "slug": "tulsa",
        "state": "OK",
        "tagline": "Tulsa donors power the blood supply for Saint Francis, Saint John, and Hillcrest hospitals."
    },
    "yukon": {
        "name": "Yukon",
        "slug": "yukon",
        "state": "OK",
        "tagline": "Yukon donors help supply Integris Canadian Valley Hospital and the western OKC metro."
    },
}

BASE_DIR = "/home/user/workspace/obi-site/views/donate-blood"

def patch_city(slug, info):
    city = info["name"]
    filepath = os.path.join(BASE_DIR, f"{slug}.html")
    
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    original = content
    
    # 1. Fix title
    old_title_pattern = rf'<title>Donate Blood in {re.escape(city)}, OK \| Oklahoma Blood Donors</title>'
    new_title = f'<title>Schedule Blood Donation in {city}, OK — Book Today | Oklahoma Blood Donors</title>'
    content = re.sub(old_title_pattern, new_title, content)
    
    # 2. Fix meta description (all occurrences — meta name, og:description, twitter:description)
    old_meta_desc_pattern = r'<meta name="description" content="[^"]*">'
    new_meta_desc = f'<meta name="description" content="Ready to donate blood in {city}? Schedule your appointment in 2 minutes through our quick online booking. Walk-ins also welcome at the {city} Blood Donor Center.">'
    content = re.sub(old_meta_desc_pattern, new_meta_desc, content, count=1)
    
    old_og_desc_pattern = r'<meta property="og:description" content="[^"]*">'
    new_og_desc = f'<meta property="og:description" content="Ready to donate blood in {city}? Schedule your appointment in 2 minutes through our quick online booking. Walk-ins also welcome at the {city} Blood Donor Center.">'
    content = re.sub(old_og_desc_pattern, new_og_desc, content, count=1)
    
    old_tw_desc_pattern = r'<meta name="twitter:description" content="[^"]*">'
    new_tw_desc = f'<meta name="twitter:description" content="Ready to donate blood in {city}? Schedule your appointment in 2 minutes through our quick online booking. Walk-ins also welcome at the {city} Blood Donor Center.">'
    content = re.sub(old_tw_desc_pattern, new_tw_desc, content, count=1)
    
    # Also update og:title and twitter:title
    old_og_title_pattern = rf'<meta property="og:title" content="Donate Blood in {re.escape(city)}, OK \| Oklahoma Blood Donors">'
    new_og_title = f'<meta property="og:title" content="Schedule Blood Donation in {city}, OK — Book Today | Oklahoma Blood Donors">'
    content = re.sub(old_og_title_pattern, new_og_title, content)
    
    old_tw_title_pattern = rf'<meta name="twitter:title" content="Donate Blood in {re.escape(city)}, OK \| Oklahoma Blood Donors">'
    new_tw_title = f'<meta name="twitter:title" content="Schedule Blood Donation in {city}, OK — Book Today | Oklahoma Blood Donors">'
    content = re.sub(old_tw_title_pattern, new_tw_title, content)
    
    # 3. Fix H1
    old_h1_pattern = rf'<h1 class="[^"]*">Donate Blood in {re.escape(city)}, OK</h1>'
    new_h1 = f'<h1 class="text-3xl md:text-4xl font-bold mb-6 text-gray-900 dark:text-gray-100 leading-tight">Schedule Your Blood Donation in {city}</h1>'
    content = re.sub(old_h1_pattern, new_h1, content)
    
    # 4. Add answer-first scheduling CTA block after the Quick Answer box
    # The quick answer box ends with </div> followed by a blank line and <!-- Body Content -->
    # We insert after the closing </div> of the Quick Answer box
    scheduling_cta = f"""
        <!-- Scheduling CTA — transactional intent block -->
        <div class="bg-red-700 dark:bg-red-800 rounded-xl p-6 mb-8 text-white">
          <p class="font-bold text-lg mb-1">Schedule Your {city} Donation in 2 Minutes</p>
          <p class="text-red-100 text-sm mb-4">{info["tagline"]} Walk-ins also welcome.</p>
          <div class="flex flex-col sm:flex-row gap-3">
            <a href="{DONABLE_LINK}" target="_blank" rel="noopener" data-ga-cta="city_scheduling_cta" class="inline-flex items-center justify-center rounded-md text-sm font-bold h-11 px-8 bg-white text-red-700 hover:bg-red-50 transition-colors shadow-md">
              Book Appointment Online &rarr;
            </a>
            <a href="/locations/{slug}" class="inline-flex items-center justify-center rounded-md text-sm font-medium h-11 px-6 border border-red-300 text-white hover:bg-red-600 transition-colors">
              View center hours and address
            </a>
          </div>
        </div>

"""
    
    # Insert after the Quick Answer box closing div (before <!-- Body Content -->)
    body_content_marker = "        <!-- Body Content -->"
    if body_content_marker in content:
        content = content.replace(body_content_marker, scheduling_cta + body_content_marker, 1)
    
    # 5. Add internal link to /locations/{city} in the existing donate CTA (update the "Find a Center Near You" link)
    # Replace the generic /donate CTA with Donable link + locations link
    old_donate_cta = r'<a href="/donate" class="inline-flex items-center justify-center rounded-md text-sm font-medium h-11 px-8 text-white shadow" style="background-color: oklch\(0\.547 0\.213 27\.325\)" onmouseover="[^"]*" onmouseout="[^"]*">Schedule a Donation</a>'
    new_donate_cta = f'<a href="{DONABLE_LINK}" target="_blank" rel="noopener" data-ga-cta="article_cta" class="inline-flex items-center justify-center rounded-md text-sm font-medium h-11 px-8 text-white shadow" style="background-color: oklch(0.547 0.213 27.325)" onmouseover="this.style.backgroundColor=\'oklch(0.497 0.213 27.325)\'" onmouseout="this.style.backgroundColor=\'oklch(0.547 0.213 27.325)\'">Schedule Appointment</a>'
    content = re.sub(old_donate_cta, new_donate_cta, content)
    
    # Also fix the bottom tiles "Schedule Now" link
    content = content.replace(
        '<a href="/donate" class="p-4 rounded-lg text-center text-white hover:shadow-md transition-shadow" style="background-color: oklch(0.547 0.213 27.325)">',
        f'<a href="{DONABLE_LINK}" target="_blank" rel="noopener" data-ga-cta="bottom_tile" class="p-4 rounded-lg text-center text-white hover:shadow-md transition-shadow" style="background-color: oklch(0.547 0.213 27.325)">'
    )
    
    if content == original:
        print(f"WARNING: No changes made to {slug}.html — check patterns!")
    else:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"✓ Patched {slug}.html")

for slug, info in cities.items():
    try:
        patch_city(slug, info)
    except Exception as e:
        print(f"ERROR on {slug}: {e}")

print("\nAll done.")
