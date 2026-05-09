"""Assemble a complete, deploy-ready HTML page for /plasma/[city].

Takes structured content (from content_generator) and schema (from schema_builder)
and produces a self-contained HTML file matching the proven template from the
existing OKC/Tulsa/Norman plasma pages.

Output is a complete HTML document with:
- <head> with meta tags, canonical URL, and JSON-LD schema
- Header with OK Blood Donor branding and nav
- Breadcrumbs
- Hero (eyebrow, h1)
- TL;DR callout
- Comparison table of centers
- Payout section (new donor arc, returning pay, payment method, honest ceiling)
- Maximize earnings tips
- Eligibility quick-check
- Plasma vs blood comparison
- FAQ with <details>/<summary> elements
- Related guides
- CTA box
- Disclaimer
- Footer with affiliate disclosure
"""
import html as html_mod


BASE_URL = "https://oklahomabloodinstitute.com"
BRAND_NAME = "OK Blood Donor"


def _esc(text):
    """HTML-escape text."""
    return html_mod.escape(str(text)) if text else ""


def _build_center_row(center):
    """Build a single <tr> for the comparison table."""
    new_donor = "$400–$700+ (varies by promo)"
    returning = "$30–$80/visit, weight-dependent"
    phone = _esc(center.get("phone", "")) or "Contact center"
    hours = _esc(center.get("hours", "")) or "Contact center for hours"
    notes = _esc(center.get("notes", "")) or ""

    addr_parts = [_esc(center.get("address", ""))]
    if center.get("city"):
        addr_parts.append(f"{_esc(center['city'])}, {_esc(center.get('state', 'OK'))} {_esc(center.get('zip', ''))}")
    full_addr = ", ".join(p for p in addr_parts if p)

    return f"""            <tr>
              <td>{_esc(center.get('name', ''))}</td>
              <td>{full_addr}</td>
              <td>{hours}</td>
              <td>{phone}</td>
              <td>{new_donor}</td>
              <td>{returning}</td>
              <td>{notes}</td>
            </tr>"""


def _build_comparison_table(centers):
    """Build the full comparison table HTML."""
    rows = "\n".join(_build_center_row(c) for c in centers)
    return f"""      <div class="table-wrap" style="overflow-x:auto;">
        <table>
          <thead>
            <tr>
              <th>Center</th>
              <th>Address</th>
              <th>Hours</th>
              <th>Phone</th>
              <th>New Donor Bonus (est. range)</th>
              <th>Returning Pay (est. range)</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
{rows}
          </tbody>
        </table>
      </div>"""


def _build_faq_html(faqs):
    """Build the visible FAQ section with <details>/<summary> elements."""
    items = []
    for faq in faqs:
        q = _esc(faq["question"])
        a = _esc(faq["answer"])
        items.append(f"""      <details>
        <summary>{q}</summary>
        <p>{a}</p>
      </details>""")
    return "\n\n".join(items)


def _build_maximize_tips(tips):
    """Build the tips list."""
    items = []
    for tip in tips:
        # Split on first period or colon for bold lead
        parts = tip.split(".", 1) if "." in tip[:60] else tip.split(":", 1)
        if len(parts) == 2 and len(parts[0]) < 60:
            items.append(f"        <li><strong>{_esc(parts[0])}.</strong> {_esc(parts[1].strip())}</li>")
        else:
            items.append(f"        <li>{_esc(tip)}</li>")
    return "\n".join(items)


def _build_eligibility_items(items):
    """Build the eligibility checklist."""
    result = []
    for item in items:
        parts = item.split(":", 1) if ":" in item[:30] else item.split(".", 1)
        if len(parts) == 2 and len(parts[0]) < 30:
            result.append(f"        <li><strong>{_esc(parts[0])}:</strong> {_esc(parts[1].strip())}</li>")
        else:
            result.append(f"        <li>{_esc(item)}</li>")
    return "\n".join(result)


def _build_related_links(city_slug, related_cities):
    """Build related guides links."""
    links = []
    for rc in related_cities:
        rc_slug = rc.lower().replace(" ", "-")
        links.append(f'        <li><a href="/plasma/{rc_slug}">Donate plasma for money in {_esc(rc)}</a></li>')
    # Always include a blood donation link
    links.append(f'        <li><a href="/donate-blood/{city_slug}">Donate blood in the area (nonprofit)</a></li>')
    links.append('        <li><a href="/questions/first-time-donating">First-time donor guide</a></li>')
    return "\n".join(links)


def build_page(city_name, city_slug, centers, content, schema_json, year="2026"):
    """Assemble the complete HTML page.

    Args:
        city_name: Display name (e.g., "Edmond")
        city_slug: URL slug (e.g., "edmond")
        centers: List of center dicts for comparison table
        content: Dict from content_generator with all editorial sections
        schema_json: JSON-LD string from schema_builder
        year: Current year

    Returns:
        Complete HTML string ready to write to file.
    """
    title = content.get("title", f"Donate Plasma for Money in {city_name}, OK — {year}")
    meta_desc = _esc(content.get("meta_description", f"Plasma centers in {city_name} compared. Pay rates, hours, and eligibility — {year} guide."))
    canonical = f"{BASE_URL}/plasma/{city_slug}"

    comparison_table = _build_comparison_table(centers)
    faq_html = _build_faq_html(content.get("faqs", []))
    tips_html = _build_maximize_tips(content.get("maximize_tips", []))
    elig_html = _build_eligibility_items(content.get("eligibility_items", []))
    related_html = _build_related_links(city_slug, content.get("related_cities", []))

    center_count = len(centers)
    chains = sorted(set(c["chain"] for c in centers))
    chains_display = ", ".join(chains)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{_esc(title)}</title>
  <meta name="description" content="{meta_desc}">
  <link rel="canonical" href="{canonical}">
  <link rel="stylesheet" href="/css/styles.css">

  <script type="application/ld+json">
  {schema_json}
  </script>
</head>
<body>
  <header>
    <a href="/" class="site-logo">{BRAND_NAME}</a>
    <nav aria-label="Primary">
      <a href="/donate">Donate Blood</a>
      <a href="/plasma/">Plasma Centers</a>
      <a href="/locations">Locations</a>
      <a href="/questions/">FAQs</a>
      <a href="/about">About</a>
      <a href="/schedule" class="cta-primary">Schedule</a>
    </nav>
  </header>

  <main class="article-wrap">
    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <ol>
        <li><a href="/">Home</a></li>
        <li><a href="/plasma/">Plasma</a></li>
        <li aria-current="page">{_esc(city_name)}</li>
      </ol>
    </nav>

    <aside class="affiliate-disclosure" role="note">
      <strong>Independent editorial guide.</strong>
      {BRAND_NAME} is not affiliated with Our Blood Institute (formerly Oklahoma Blood Institute),
      Red Cross, or any commercial plasma chain we cover. We don&rsquo;t collect donations ourselves;
      we help you find the right place to donate. <a href="/about">More on our editorial standards &rarr;</a>
    </aside>

    <span class="eyebrow">Plasma Donation &mdash; {_esc(city_name)}</span>
    <h1>{_esc(title)}</h1>

    <aside class="tldr">
      <strong>TL;DR:</strong> {_esc(content.get('tldr', ''))}
    </aside>

    <section aria-labelledby="centers-heading">
      <h2 id="centers-heading">Plasma Centers in {_esc(city_name)} &mdash; {year} Comparison</h2>
      <p>All {center_count} location{"s" if center_count != 1 else ""} below {"are" if center_count != 1 else "is"} verified as of {year}. Hours and phone numbers reflect publicly listed information; confirm directly with each center before visiting as hours may change.</p>

{comparison_table}
      <p><em>New donor bonus ranges and returning pay ranges are estimates based on publicly available rates and vary by center, current promotions, donor weight, and frequency. Always verify current rates on each center&rsquo;s official website or by calling ahead.</em></p>
    </section>

    <section aria-labelledby="pay-heading">
      <h2 id="pay-heading">What Plasma Donation Actually Pays</h2>
      <p>{_esc(content.get('payout_intro', ''))}</p>

      <h3>The new-donor bonus arc</h3>
      <p>{_esc(content.get('new_donor_arc', ''))}</p>

      <h3>Returning donor pay</h3>
      <p>{_esc(content.get('returning_donor_pay', ''))}</p>

      <h3>How payment works</h3>
      <p>{_esc(content.get('payment_method', ''))}</p>

      <h3>The honest ceiling</h3>
      <p>{_esc(content.get('honest_ceiling', ''))}</p>
    </section>

    <section aria-labelledby="maximize-heading">
      <h2 id="maximize-heading">How to Maximize Your Earnings in {_esc(city_name)}</h2>
      <p>{_esc(content.get('maximize_tips_intro', ''))}</p>
      <ul>
{tips_html}
      </ul>
    </section>

    <section aria-labelledby="eligibility-heading">
      <h2 id="eligibility-heading">Eligibility Quick-Check</h2>
      <p>{_esc(content.get('eligibility_intro', ''))}</p>
      <ul>
{elig_html}
      </ul>
    </section>

    <section aria-labelledby="vs-blood-heading">
      <h2 id="vs-blood-heading">Plasma vs. Blood Donation &mdash; Which Is Right for You?</h2>
      <p>{_esc(content.get('plasma_vs_blood_intro', ''))}</p>
      <p><strong>Choose plasma donation if</strong> {_esc(content.get('choose_plasma', ''))}</p>
      <p><strong>Choose blood donation if</strong> {_esc(content.get('choose_blood', ''))}</p>
      <p>{_esc(content.get('both_option', ''))}</p>
      <p>For nonprofit blood donation options in the area, see our guide at <a href="/donate-blood/{city_slug}">donate blood in {_esc(city_name)}</a>.</p>
    </section>

    <section aria-labelledby="faq-heading">
      <h2 id="faq-heading">Frequently Asked Questions</h2>

{faq_html}
    </section>

    <section class="related" aria-labelledby="related-heading">
      <h2 id="related-heading">Related Guides</h2>
      <ul>
{related_html}
      </ul>
    </section>

    <div class="cta-box">
      <p><strong>Ready to find your nearest plasma center?</strong></p>
      <a href="/locations" class="cta-primary">Browse all Oklahoma plasma locations</a>
      <a href="/schedule" class="cta-primary">Schedule a nonprofit blood donation instead</a>
    </div>

    <aside class="disclaimer">
      <p><strong>Disclaimer:</strong> Compensation rates shown are estimates based on publicly available information as of {year} and vary by center, current promotions, donor weight class, and donation frequency. {BRAND_NAME} does not pay plasma donors and does not operate plasma collection centers. Payments are made by the individual commercial plasma chains ({chains_display}, and others) directly to donors. Donor eligibility is determined by each center at the time of your visit. Information on this page is for educational purposes only and does not constitute medical advice. Always verify current rates, hours, and eligibility requirements directly with each plasma center before visiting.</p>
    </aside>
  </main>

  <footer class="site-footer">
    <div class="container">
      <div class="footer-brand">
        <strong>{BRAND_NAME}</strong>
        <span class="tagline">Independent editorial guide to plasma and blood donation in Oklahoma</span>
      </div>
      <nav class="footer-nav">
        <a href="/">Home</a>
        <a href="/comparison">Comparison</a>
        <a href="/donate-blood">Donate Blood</a>
        <a href="/plasma/">Donate Plasma</a>
        <a href="/about">About</a>
        <a href="/editorial-standards">Editorial Standards</a>
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
      </nav>
      <div class="footer-disclaimer">
        <small>
          {BRAND_NAME} is independent and not affiliated with Our Blood Institute (formerly
          Oklahoma Blood Institute), American Red Cross, CSL Plasma, BioLife Plasma Services,
          Grifols, Octapharma Plasma, or any other plasma or blood collection organization.
          Editorial content. Not medical advice. Consult a licensed healthcare provider regarding
          donation safety for your specific circumstances.
        </small>
      </div>
      <div class="footer-meta">
        <small>&copy; {year} {BRAND_NAME} &middot; Editorial site, no donations collected here.</small>
      </div>
    </div>
  </footer>
</body>
</html>"""


if __name__ == "__main__":
    # Quick structure test
    test_centers = [{"name": "Test Center", "address": "123 Main", "city": "Test",
                     "state": "OK", "zip": "73000", "chain": "CSL Plasma"}]
    test_content = {
        "title": "Test Page",
        "meta_description": "Test",
        "tldr": "Test TL;DR",
        "payout_intro": "Intro",
        "new_donor_arc": "Arc",
        "returning_donor_pay": "Pay",
        "payment_method": "Card",
        "honest_ceiling": "Ceiling",
        "maximize_tips_intro": "Tips intro",
        "maximize_tips": ["Tip 1. Do this", "Tip 2. Do that"],
        "eligibility_intro": "Eligibility intro",
        "eligibility_items": ["Age: 18+", "Weight: 110 lbs"],
        "plasma_vs_blood_intro": "Intro",
        "choose_plasma": "you want money",
        "choose_blood": "you want to help",
        "both_option": "Many do both.",
        "faqs": [{"question": "Q1?", "answer": "A1."}],
        "related_cities": ["Norman"],
    }
    result = build_page("Test City", "test-city", test_centers, test_content, '{"test": true}')
    print(f"Generated {len(result)} chars of HTML")
    # Verify key elements present
    assert BRAND_NAME in result
    assert "affiliate-disclosure" in result
    assert "Disclaimer:" in result
    print("Structure test: PASS")
