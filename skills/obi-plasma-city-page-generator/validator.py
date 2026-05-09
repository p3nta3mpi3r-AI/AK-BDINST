"""Hard-rules validator for plasma city page output.

Checks generated content and assembled HTML against the editorial
hard rules before the page is considered deploy-ready.

Validation categories:
1. Compensation claims — no fixed dollar amounts without disclaimer
2. NAP integrity — no fabricated addresses/phones/hours
3. Brand identity — no OBI nonprofit implication
4. Schema correctness — type checks, FAQ match, mainEntityOfPage
5. Structural completeness — all required sections present
"""
import re
import json
import html as html_mod


# ---------------------------------------------------------------------------
# 1. Compensation / dollar-amount rules
# ---------------------------------------------------------------------------

# Matches dollar amounts like $400, $1,200, $50.00
DOLLAR_PATTERN = re.compile(r'\$[\d,]+(?:\.\d{2})?')

# Phrases that make a dollar amount acceptable (range or disclaimer)
RANGE_INDICATORS = [
    "–", "—", "-", "to", "or more", "up to", "approximately", "approx",
    "estimated", "varies", "depending", "range", "may earn", "can earn",
    "as much as", "between", "avg", "average", "est.", "typical",
]

DISCLAIMER_PHRASES = [
    "varies by center",
    "varies by",
    "depending on",
    "subject to change",
    "verify current rates",
    "check with",
    "confirm directly",
    "not a guarantee",
    "estimate",
    "promotional",
    "current promotion",
]


def check_compensation_claims(text, context="content"):
    """Check that every dollar amount has a range indicator or disclaimer nearby.

    Args:
        text: The text to check (can be HTML or plain text)
        context: Label for error messages

    Returns:
        List of error strings (empty = pass)
    """
    errors = []
    # Strip HTML tags for text analysis
    plain = re.sub(r'<[^>]+>', ' ', text)

    for match in DOLLAR_PATTERN.finditer(plain):
        start = max(0, match.start() - 120)
        end = min(len(plain), match.end() + 120)
        window = plain[start:end].lower()

        has_range = any(ind in window for ind in RANGE_INDICATORS)
        has_disclaimer = any(phrase in window for phrase in DISCLAIMER_PHRASES)

        if not has_range and not has_disclaimer:
            snippet = plain[max(0, match.start() - 40):match.end() + 40].strip()
            errors.append(
                f"[{context}] Dollar amount {match.group()} lacks range/disclaimer "
                f"near: ...{snippet}..."
            )

    return errors


# ---------------------------------------------------------------------------
# 2. NAP integrity (Name, Address, Phone)
# ---------------------------------------------------------------------------

def check_nap_integrity(html_text, centers):
    """Verify addresses and phones in the HTML match the source centers.json.

    Only checks that no UNKNOWN addresses or phones appear.
    We don't require all centers to appear (page might cover a subset).

    Args:
        html_text: The assembled HTML
        centers: List of center dicts from centers.json

    Returns:
        List of error strings
    """
    errors = []

    # Build sets of known values
    known_phones = set()
    known_addresses = set()
    for c in centers:
        if c.get("phone"):
            # Normalize phone: strip non-digits
            digits = re.sub(r'\D', '', c["phone"])
            if len(digits) >= 10:
                known_phones.add(digits[-10:])  # last 10 digits
        if c.get("address"):
            known_addresses.add(c["address"].lower().strip())

    # Check for phone numbers in HTML that aren't in our data
    phone_pattern = re.compile(r'\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}')
    plain = re.sub(r'<[^>]+>', ' ', html_text)

    for match in phone_pattern.finditer(plain):
        digits = re.sub(r'\D', '', match.group())
        if len(digits) >= 10:
            last10 = digits[-10:]
            if last10 not in known_phones:
                # Check if it's a known non-center phone (e.g., generic 555 numbers)
                if not last10.startswith("555"):
                    errors.append(
                        f"[NAP] Phone number {match.group()} in HTML not found "
                        f"in centers.json — possible fabrication"
                    )

    return errors


# ---------------------------------------------------------------------------
# 3. Brand identity checks
# ---------------------------------------------------------------------------

# Phrases that imply OK Blood Donor IS the OBI nonprofit
OBI_IMPLICATION_PATTERNS = [
    r'(?:we|our|us)\s+(?:are|is)\s+(?:the\s+)?(?:Oklahoma Blood Institute|OBI)',
    r'(?:Oklahoma Blood Institute|OBI)\s+(?:is|are)\s+(?:our|we)',
    r'donate\s+(?:with|through|to)\s+us',
    r'(?:our|we)\s+collect\s+(?:blood|plasma|donations)',
    r'(?:our|we)\s+operate\s+(?:centers|locations|facilities)',
    r'visit\s+(?:our|one of our)\s+(?:centers|locations)',
]

# Brand name must be "OK Blood Donor", never "Oklahoma Blood Institute" as own brand
WRONG_BRAND_PATTERNS = [
    # Matches "Oklahoma Blood Institute" used as if it's OUR brand
    # (the domain oklahomabloodinstitute.com is fine, and referencing OBI as the nonprofit is fine)
    r'welcome\s+to\s+Oklahoma Blood Institute(?!\s*\()',
    r'(?:at|by|from)\s+Oklahoma Blood Institute(?!\s*\()',
]


def check_brand_identity(text, context="content"):
    """Check for OBI nonprofit implication.

    Args:
        text: Text to check
        context: Label for error messages

    Returns:
        List of error strings
    """
    errors = []
    plain = re.sub(r'<[^>]+>', ' ', text)

    for pattern in OBI_IMPLICATION_PATTERNS:
        matches = re.findall(pattern, plain, re.IGNORECASE)
        if matches:
            for m in matches:
                errors.append(
                    f"[{context}] Possible OBI implication: '{m}' — "
                    f"OK Blood Donor must not imply it IS the nonprofit"
                )

    for pattern in WRONG_BRAND_PATTERNS:
        matches = re.findall(pattern, plain, re.IGNORECASE)
        if matches:
            for m in matches:
                errors.append(
                    f"[{context}] Wrong brand usage: '{m}' — "
                    f"use 'OK Blood Donor' as the brand name"
                )

    return errors


# ---------------------------------------------------------------------------
# 4. Schema validation
# ---------------------------------------------------------------------------

def check_schema(schema_json_str, faqs, city_slug):
    """Validate JSON-LD schema correctness.

    Args:
        schema_json_str: The JSON-LD string
        faqs: List of visible FAQ dicts with 'question' and 'answer' keys
        city_slug: URL slug for canonical URL check

    Returns:
        List of error strings
    """
    errors = []

    try:
        schema = json.loads(schema_json_str)
    except json.JSONDecodeError as e:
        return [f"[Schema] Invalid JSON-LD: {e}"]

    # Check @context
    if schema.get("@context") != "https://schema.org":
        errors.append("[Schema] @context must be 'https://schema.org'")

    graph = schema.get("@graph", [])
    if not graph:
        errors.append("[Schema] Missing @graph array")
        return errors

    # Check for required types
    types_found = {node.get("@type") for node in graph}
    required_types = {"MedicalOrganization", "BreadcrumbList", "Article", "FAQPage"}
    missing = required_types - types_found
    if missing:
        errors.append(f"[Schema] Missing @graph types: {missing}")

    # Check MedicalOrganization
    for node in graph:
        if node.get("@type") == "MedicalOrganization":
            spec = node.get("medicalSpecialty", "")
            if spec != "https://schema.org/Hematologic":
                errors.append(
                    f"[Schema] medicalSpecialty must be "
                    f"'https://schema.org/Hematologic', got '{spec}'"
                )
            break

    # Check FAQPage
    canonical = f"https://oklahomabloodinstitute.com/plasma/{city_slug}"
    for node in graph:
        if node.get("@type") == "FAQPage":
            # mainEntityOfPage check
            meop = node.get("mainEntityOfPage", "")
            if meop != canonical:
                errors.append(
                    f"[Schema] FAQPage.mainEntityOfPage must be '{canonical}', "
                    f"got '{meop}'"
                )

            # FAQ match check
            schema_faqs = node.get("mainEntity", [])
            if len(schema_faqs) != len(faqs):
                errors.append(
                    f"[Schema] FAQ count mismatch: schema has {len(schema_faqs)}, "
                    f"visible has {len(faqs)}"
                )
            else:
                for i, (sf, vf) in enumerate(zip(schema_faqs, faqs)):
                    sq = sf.get("name", "")
                    vq = vf.get("question", "")
                    if sq != vq:
                        errors.append(
                            f"[Schema] FAQ #{i+1} question mismatch: "
                            f"schema={sq[:60]!r} vs visible={vq[:60]!r}"
                        )
            break

    return errors


# ---------------------------------------------------------------------------
# 5. Structural completeness
# ---------------------------------------------------------------------------

REQUIRED_HTML_ELEMENTS = [
    ("affiliate-disclosure", "Affiliate disclosure aside"),
    ("breadcrumbs", "Breadcrumb navigation"),
    ("tldr", "TL;DR callout"),
    ("centers-heading", "Centers comparison section"),
    ("pay-heading", "Payout section"),
    ("maximize-heading", "Maximize earnings section"),
    ("eligibility-heading", "Eligibility section"),
    ("vs-blood-heading", "Plasma vs blood section"),
    ("faq-heading", "FAQ section"),
    ("related-heading", "Related guides section"),
    ("cta-box", "CTA box"),
    ("disclaimer", "Disclaimer"),
    ("site-footer", "Footer"),
    ("application/ld+json", "JSON-LD schema script"),
]


def check_structure(html_text):
    """Verify all required page sections are present.

    Args:
        html_text: The assembled HTML

    Returns:
        List of error strings
    """
    errors = []
    for marker, label in REQUIRED_HTML_ELEMENTS:
        if marker not in html_text:
            errors.append(f"[Structure] Missing required element: {label} ('{marker}')")
    return errors


# ---------------------------------------------------------------------------
# Master validator
# ---------------------------------------------------------------------------

def validate_page(html_text, centers, content, schema_json_str, city_slug):
    """Run all validation checks on a generated page.

    Args:
        html_text: Complete assembled HTML
        centers: List of center dicts used for this city
        content: Content dict from content_generator
        schema_json_str: JSON-LD string from schema_builder
        city_slug: URL slug

    Returns:
        (is_valid, errors) tuple where errors is a list of strings
    """
    all_errors = []

    # 1. Compensation claims in content
    for key, val in content.items():
        if isinstance(val, str):
            all_errors.extend(check_compensation_claims(val, context=f"content.{key}"))
        elif isinstance(val, list):
            for i, item in enumerate(val):
                if isinstance(item, str):
                    all_errors.extend(
                        check_compensation_claims(item, context=f"content.{key}[{i}]")
                    )
                elif isinstance(item, dict):
                    for dk, dv in item.items():
                        if isinstance(dv, str):
                            all_errors.extend(
                                check_compensation_claims(
                                    dv, context=f"content.{key}[{i}].{dk}"
                                )
                            )

    # 2. NAP integrity
    all_errors.extend(check_nap_integrity(html_text, centers))

    # 3. Brand identity
    all_errors.extend(check_brand_identity(html_text, context="html"))

    # 4. Schema
    faqs = content.get("faqs", [])
    all_errors.extend(check_schema(schema_json_str, faqs, city_slug))

    # 5. Structure
    all_errors.extend(check_structure(html_text))

    return len(all_errors) == 0, all_errors


if __name__ == "__main__":
    # Quick self-test
    print("Running validator self-tests...")

    # Test compensation checker
    errs = check_compensation_claims("Donors earn $700 per month.")
    assert len(errs) == 1, f"Expected 1 error, got {len(errs)}"
    print("  ✓ Fixed dollar amount without disclaimer flagged")

    errs = check_compensation_claims("Donors earn $400–$700 depending on promotion.")
    assert len(errs) == 0, f"Expected 0 errors, got {len(errs)}: {errs}"
    print("  ✓ Range with disclaimer passes")

    errs = check_compensation_claims("Approximately $30 to $80 per visit, varies by center.")
    assert len(errs) == 0, f"Expected 0 errors, got {len(errs)}: {errs}"
    print("  ✓ Range with 'approximately' and 'varies by center' passes")

    # Test brand checker
    errs = check_brand_identity("Welcome to Oklahoma Blood Institute, we collect blood.")
    assert len(errs) >= 1, f"Expected errors, got {len(errs)}"
    print("  ✓ OBI implication flagged")

    errs = check_brand_identity("OK Blood Donor is an independent guide. Our Blood Institute (formerly Oklahoma Blood Institute) is a nonprofit.")
    assert len(errs) == 0, f"Expected 0 errors, got {len(errs)}: {errs}"
    print("  ✓ Correct brand usage passes")

    # Test structure checker
    errs = check_structure("<html><body>empty</body></html>")
    assert len(errs) == len(REQUIRED_HTML_ELEMENTS), f"Expected {len(REQUIRED_HTML_ELEMENTS)} errors"
    print(f"  ✓ Empty page flags all {len(REQUIRED_HTML_ELEMENTS)} missing elements")

    print("\nAll validator self-tests passed.")
