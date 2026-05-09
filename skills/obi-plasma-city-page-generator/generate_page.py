#!/usr/bin/env python3
"""Main orchestrator for plasma city page generation.

Usage:
    python3 generate_page.py <city_slug> [--output-dir DIR] [--year YEAR] [--dry-run]

Examples:
    python3 generate_page.py edmond
    python3 generate_page.py oklahoma-city --output-dir ./output
    python3 generate_page.py lawton --dry-run
    python3 generate_page.py --list-cities

Pipeline:
    1. Load centers.json and filter for the target city
    2. Call content_generator to produce editorial sections via Claude LLM
    3. Call schema_builder to assemble JSON-LD @graph
    4. Call html_template to assemble the full HTML page
    5. Run validator hard-rules checks
    6. Write output HTML (or print validation report in dry-run mode)
"""
import argparse
import json
import os
import sys
from pathlib import Path

# Module imports (same directory)
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from content_generator import generate_city_content
from schema_builder import build_graph
from html_template import build_page
from validator import validate_page


def load_centers(centers_path=None):
    """Load and return the centers list from centers.json."""
    if centers_path is None:
        centers_path = SCRIPT_DIR / "centers.json"
    with open(centers_path, "r") as f:
        data = json.load(f)
    return data["centers"]


def get_available_cities(centers):
    """Return sorted list of unique city slugs from centers data."""
    slugs = set()
    for c in centers:
        slugs.add(c["city_slug"])
        # Also include nearby cities that map to this center
        for nc in c.get("nearby_cities", []):
            # nearby_cities are display names; slugify them
            slug = nc.lower().replace(" ", "-")
            slugs.add(slug)
    return sorted(slugs)


def filter_centers_for_city(centers, city_slug):
    """Return centers that serve a given city.

    A center serves a city if:
    - Its city_slug matches, OR
    - The city name appears in its nearby_cities list

    Args:
        centers: Full list of center dicts
        city_slug: Target city slug (e.g., "edmond")

    Returns:
        (city_name, filtered_centers) tuple
    """
    direct = []
    nearby = []
    city_name = None

    for c in centers:
        if c["city_slug"] == city_slug:
            direct.append(c)
            city_name = c["city"]
        else:
            # Check nearby_cities
            for nc in c.get("nearby_cities", []):
                nc_slug = nc.lower().replace(" ", "-")
                if nc_slug == city_slug:
                    nearby.append(c)
                    if city_name is None:
                        city_name = nc
                    break

    # Combine: direct centers first, then nearby
    result = direct + nearby

    # If we only found nearby matches, derive city_name from slug
    if city_name is None:
        city_name = city_slug.replace("-", " ").title()

    return city_name, result


def generate(city_slug, output_dir=None, year="2026", dry_run=False, centers_path=None):
    """Run the full page generation pipeline for a city.

    Args:
        city_slug: URL slug (e.g., "edmond", "oklahoma-city")
        output_dir: Directory to write output HTML (default: ./output)
        year: Year string for dateline
        dry_run: If True, skip LLM call and use placeholder content
        centers_path: Override path to centers.json

    Returns:
        Dict with status, output_path, validation results
    """
    print(f"\n{'='*60}")
    print(f"  Generating plasma page: /plasma/{city_slug}")
    print(f"{'='*60}\n")

    # Step 1: Load and filter centers
    print("[1/5] Loading centers data...")
    all_centers = load_centers(centers_path)
    city_name, centers = filter_centers_for_city(all_centers, city_slug)

    if not centers:
        print(f"  ERROR: No centers found for city slug '{city_slug}'")
        print(f"  Available cities: {', '.join(get_available_cities(all_centers))}")
        return {"status": "error", "error": f"No centers for '{city_slug}'"}

    print(f"  City: {city_name}")
    print(f"  Centers found: {len(centers)}")
    for c in centers:
        print(f"    - {c['name']} ({c['address']}, {c['city']})")

    # Step 2: Generate content
    if dry_run:
        print("\n[2/5] Generating content (DRY RUN — using placeholder content)...")
        content = _placeholder_content(city_name, city_slug, centers, year)
    else:
        print("\n[2/5] Generating content via Claude LLM...")
        content = generate_city_content(city_name, city_slug, centers, year)
    print(f"  Title: {content['title']}")
    print(f"  FAQs: {len(content.get('faqs', []))}")

    # Step 3: Build schema
    print("\n[3/5] Building JSON-LD schema...")
    schema_json = build_graph(
        city_name, city_slug,
        content["title"],
        content.get("faqs", []),
    )
    schema_parsed = json.loads(schema_json)
    types = [n.get("@type") for n in schema_parsed.get("@graph", [])]
    print(f"  @graph types: {types}")

    # Step 4: Assemble HTML
    print("\n[4/5] Assembling HTML page...")
    html = build_page(city_name, city_slug, centers, content, schema_json, year)
    print(f"  HTML size: {len(html):,} chars")

    # Step 5: Validate
    print("\n[5/5] Running hard-rules validation...")
    is_valid, errors = validate_page(html, centers, content, schema_json, city_slug)

    if is_valid:
        print("  ✅ All validation checks passed")
    else:
        print(f"  ⚠️  {len(errors)} validation issue(s):")
        for err in errors:
            print(f"    - {err}")

    # Write output
    if output_dir is None:
        output_dir = SCRIPT_DIR / "output"
    else:
        output_dir = Path(output_dir)

    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{city_slug}.html"

    with open(output_path, "w") as f:
        f.write(html)
    print(f"\n  📄 Output written to: {output_path}")

    result = {
        "status": "success" if is_valid else "warnings",
        "city_name": city_name,
        "city_slug": city_slug,
        "center_count": len(centers),
        "html_size": len(html),
        "output_path": str(output_path),
        "validation_passed": is_valid,
        "validation_errors": errors,
        "dry_run": dry_run,
    }

    print(f"\n{'='*60}")
    print(f"  Done: /plasma/{city_slug} — {'PASS' if is_valid else 'WARNINGS'}")
    print(f"{'='*60}\n")

    return result


def _placeholder_content(city_name, city_slug, centers, year):
    """Generate placeholder content for dry-run testing (no LLM call)."""
    chains = sorted(set(c["chain"] for c in centers))
    center_count = len(centers)

    # Build center address list for FAQ
    center_list = "; ".join(
        f"{c['name']} at {c['address']}, {c['city']}"
        for c in centers
    )

    return {
        "title": f"Donate Plasma for Money in {city_name}, OK — {year}",
        "meta_description": (
            f"Compare {center_count} plasma centers in {city_name}, OK. "
            f"New donor bonuses, pay rates, hours — {year} guide."
        ),
        "tldr": (
            f"{city_name} has {center_count} plasma center{'s' if center_count != 1 else ''} "
            f"from {', '.join(chains)}. New donors may earn approximately $400–$700 or more "
            f"in their first month depending on current promotions and center. Returning donors "
            f"typically earn $30–$80 per visit, varies by center, weight, and donation frequency. "
            f"OK Blood Donor does not pay donors — we are an independent editorial guide."
        ),
        "payout_intro": (
            f"Here is what plasma donation actually pays in {city_name}, based on publicly "
            f"available rates as of {year}. All figures are estimates and vary by center."
        ),
        "new_donor_arc": (
            "Most commercial plasma chains offer enhanced pay for your first 6–10 donations. "
            "New donors may earn approximately $400–$700 or more during this introductory period, "
            "depending on the center, current promotions, and donation frequency. These bonuses "
            "change frequently, so always verify the current offer directly with the center."
        ),
        "returning_donor_pay": (
            "After the new-donor bonus period, returning donors typically earn $30–$50 for their "
            "first donation of the week and $50–$80 for their second, depending on the center "
            "and donor weight class. Monthly earnings for regular donors generally range from "
            "$200–$400, varies by center and frequency."
        ),
        "payment_method": (
            "All major plasma chains pay via reloadable prepaid debit cards. Payment is loaded "
            "within minutes of completing your donation. Cards work anywhere Visa or Mastercard "
            "is accepted and can be used at ATMs."
        ),
        "honest_ceiling": (
            "Realistically, month-one earnings with a new-donor bonus might reach $400–$700 or more, "
            "but ongoing monthly income for regular twice-weekly donors typically settles to "
            "$200–$400. These are estimates, not guarantees — actual pay varies by center, "
            "current promotions, donor weight, and donation frequency."
        ),
        "maximize_tips_intro": (
            f"A few practical strategies to maximize your plasma donation earnings in {city_name}."
        ),
        "maximize_tips": [
            "Compare new-donor bonuses. Each chain runs different promotions — check all centers in your area before committing to one.",
            "Donate consistently twice per week. Most chains pay more for the second donation of the week, and some have frequency-based bonuses.",
            "Stay hydrated. Drink plenty of water in the 24 hours before your appointment — well-hydrated donors have faster donation times.",
            "Eat a protein-rich meal. A high-protein meal 2–3 hours before donating helps maintain your protein levels and may speed up the process.",
            "Use referral programs. Most chains offer $50–$100 or more per referred friend who completes their first donation, varies by center and promotion.",
            "Watch for seasonal promotions. Centers often boost pay around holidays and during summer when supply drops.",
        ],
        "eligibility_intro": (
            "Most healthy adults can donate plasma. Here is a quick eligibility checklist."
        ),
        "eligibility_items": [
            "Age: 18–69 years old (some centers accept 16–17 with parental consent)",
            "Weight: at least 110 pounds (50 kg)",
            "Health: generally in good health with no active infections",
            "ID: valid government-issued photo ID required",
            "Address: proof of current address (utility bill, bank statement, etc.)",
            "SSN: Social Security documentation required for tax reporting",
            "Medications: most common medications are acceptable — staff will review at screening",
        ],
        "plasma_vs_blood_intro": (
            "Plasma donation and blood donation serve different purposes and work differently."
        ),
        "choose_plasma": (
            f"you want to earn money for your time. Commercial plasma centers in {city_name} "
            "compensate donors via prepaid debit card, typically $30–$80 per visit depending on "
            "center and frequency. You can donate up to twice per week. The process takes "
            "45–90 minutes for return visits."
        ),
        "choose_blood": (
            "you want to make an uncompensated donation to help patients in your community. "
            "Nonprofit organizations like Our Blood Institute (formerly Oklahoma Blood Institute) "
            "supply blood to local hospitals. Whole blood donation takes about 10 minutes and "
            "you can donate every 56 days."
        ),
        "both_option": (
            "Many donors do both — plasma for compensation at a commercial center and blood "
            "at a nonprofit when eligible. Just maintain the required waiting periods between "
            "different donation types."
        ),
        "faqs": [
            {
                "question": f"How much can I make donating plasma in {city_name}?",
                "answer": (
                    f"Plasma donation pay in {city_name} varies by center, current promotions, "
                    "donor weight, and frequency. New donors may earn approximately $400–$700 or "
                    "more during their first month with introductory bonuses. Returning donors "
                    "typically earn $30–$80 per visit. Monthly earnings for regular twice-weekly "
                    "donors generally range from $200–$400. Always verify current rates directly "
                    "with the center."
                ),
            },
            {
                "question": f"How often can I donate plasma in {city_name}?",
                "answer": (
                    "FDA regulations allow plasma donation up to twice within a 7-day period, "
                    "with at least 48 hours between donations. Most centers encourage a regular "
                    "twice-weekly schedule for both donor health and consistent earnings."
                ),
            },
            {
                "question": "Is plasma donation safe?",
                "answer": (
                    "Yes, plasma donation is FDA-regulated and considered safe for healthy adults. "
                    "All equipment is sterile and single-use. The process uses apheresis technology, "
                    "which separates plasma from your blood and returns red blood cells and other "
                    "components to your body. Side effects are generally mild and temporary — most "
                    "commonly light-headedness or bruising at the needle site."
                ),
            },
            {
                "question": "What is the difference between blood donation and plasma donation pay?",
                "answer": (
                    "Nonprofit blood donation through organizations like Our Blood Institute "
                    "(formerly Oklahoma Blood Institute) is uncompensated — donors volunteer "
                    "their time. Commercial plasma donation pays donors via prepaid debit card, "
                    "typically $30–$80 per visit depending on center and frequency. The time "
                    "commitment also differs: blood donation takes about 10 minutes, while "
                    "plasma donation takes 45–90 minutes for return visits."
                ),
            },
            {
                "question": f"Where can I donate plasma near me in {city_name}?",
                "answer": (
                    f"There are {center_count} plasma centers serving the {city_name} area: "
                    f"{center_list}. See the comparison table above for hours, phone numbers, "
                    f"and estimated pay ranges for each center."
                ),
            },
            {
                "question": f"How long does a plasma donation take in {city_name}?",
                "answer": (
                    "Your first plasma donation typically takes 2–3 hours, including registration, "
                    "physical exam, and the donation itself. Return visits are faster, usually "
                    "45–90 minutes. Staying well-hydrated before your appointment can help speed "
                    "up the process."
                ),
            },
            {
                "question": f"Do I need an appointment to donate plasma in {city_name}?",
                "answer": (
                    "Most plasma centers accept walk-ins, but scheduling an appointment online "
                    "is recommended — especially for new donors, as the first visit takes longer. "
                    "Check each center's website or call ahead to schedule."
                ),
            },
            {
                "question": f"What do I need to bring to my first plasma donation in {city_name}?",
                "answer": (
                    "Bring a valid government-issued photo ID (driver's license or passport), "
                    "proof of your current address (utility bill or bank statement), and Social "
                    "Security documentation. Eat a protein-rich meal 2–3 hours before your "
                    "appointment, and drink plenty of water throughout the day."
                ),
            },
        ],
        "related_cities": _suggest_related_cities(city_slug, centers),
    }


def _suggest_related_cities(city_slug, centers):
    """Suggest related cities based on nearby_cities from centers data."""
    related = set()
    for c in centers:
        for nc in c.get("nearby_cities", []):
            nc_slug = nc.lower().replace(" ", "-")
            if nc_slug != city_slug:
                related.add(nc)
    # Limit to 4
    return sorted(related)[:4]


def main():
    parser = argparse.ArgumentParser(
        description="Generate a plasma donation city guide page.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 generate_page.py edmond                  # Generate Edmond page
  python3 generate_page.py oklahoma-city --dry-run  # Test without LLM call
  python3 generate_page.py --list-cities            # Show available cities
  python3 generate_page.py --all --dry-run          # Generate all cities (dry run)
        """,
    )
    parser.add_argument("city_slug", nargs="?", help="City URL slug (e.g., 'edmond')")
    parser.add_argument("--output-dir", default=None, help="Output directory")
    parser.add_argument("--year", default="2026", help="Year for dateline (default: 2026)")
    parser.add_argument("--dry-run", action="store_true", help="Use placeholder content (no LLM)")
    parser.add_argument("--list-cities", action="store_true", help="List available city slugs")
    parser.add_argument("--all", action="store_true", help="Generate pages for ALL cities")
    parser.add_argument("--centers-file", default=None, help="Override centers.json path")

    args = parser.parse_args()

    if args.list_cities:
        all_centers = load_centers(args.centers_file)
        cities = get_available_cities(all_centers)
        print(f"Available cities ({len(cities)}):")
        for slug in cities:
            _, filtered = filter_centers_for_city(all_centers, slug)
            print(f"  {slug} ({len(filtered)} centers)")
        return

    if args.all:
        all_centers = load_centers(args.centers_file)
        # Only generate for cities that have DIRECT centers (not just nearby)
        direct_slugs = sorted(set(c["city_slug"] for c in all_centers))
        results = []
        for slug in direct_slugs:
            result = generate(
                slug,
                output_dir=args.output_dir,
                year=args.year,
                dry_run=args.dry_run,
                centers_path=args.centers_file,
            )
            results.append(result)

        # Summary
        print(f"\n{'='*60}")
        print(f"  BATCH SUMMARY: {len(results)} cities")
        print(f"{'='*60}")
        passed = sum(1 for r in results if r.get("validation_passed"))
        warned = sum(1 for r in results if r.get("status") == "warnings")
        failed = sum(1 for r in results if r.get("status") == "error")
        print(f"  ✅ Passed: {passed}")
        print(f"  ⚠️  Warnings: {warned}")
        print(f"  ❌ Errors: {failed}")
        return

    if not args.city_slug:
        parser.print_help()
        sys.exit(1)

    result = generate(
        args.city_slug,
        output_dir=args.output_dir,
        year=args.year,
        dry_run=args.dry_run,
        centers_path=args.centers_file,
    )

    if result["status"] == "error":
        sys.exit(1)


if __name__ == "__main__":
    main()
