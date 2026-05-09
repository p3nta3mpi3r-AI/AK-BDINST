"""Build the @graph JSON-LD schema bundle for plasma city pages.

Generates a single <script type="application/ld+json"> block containing:
1. MedicalOrganization — OK Blood Donor with medicalSpecialty Hematologic
2. BreadcrumbList — Home > Plasma > [City]
3. Article — with datePublished/dateModified, author/publisher referencing #organization
4. FAQPage — with mainEntityOfPage and mainEntity array of Question/Answer pairs

Critical rules:
- MedicalOrganization (NOT generic Organization)
- medicalSpecialty uses schema.org enum: "https://schema.org/Hematologic"
- FAQPage.mainEntity must EXACTLY match the visible FAQ on the page
- mainEntityOfPage on both Article and FAQPage references the canonical URL
- @context appears only at the outer wrapper level
- Each node gets a unique @id with URL fragment
- Cross-references use @id strings
"""
import json
from datetime import date


BASE_URL = "https://oklahomabloodinstitute.com"
ORG_ID = f"{BASE_URL}/#organization"
BRAND_NAME = "OK Blood Donor"
BRAND_DESCRIPTION = (
    "OK Blood Donor is an independent editorial guide to plasma and blood "
    "donation in Oklahoma. We compare centers, verify pay rates weekly, and "
    "help donors find the right place to donate."
)


def build_organization():
    """MedicalOrganization node for OK Blood Donor."""
    return {
        "@type": "MedicalOrganization",
        "@id": ORG_ID,
        "name": BRAND_NAME,
        "url": BASE_URL,
        "medicalSpecialty": "https://schema.org/Hematologic",
        "description": BRAND_DESCRIPTION,
        "areaServed": {
            "@type": "State",
            "name": "Oklahoma"
        },
        "serviceType": "Plasma Donation Referral"
    }


def build_breadcrumbs(city_name, city_slug):
    """BreadcrumbList: Home > Plasma > [City]."""
    return {
        "@type": "BreadcrumbList",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": 1,
                "name": "Home",
                "item": f"{BASE_URL}/"
            },
            {
                "@type": "ListItem",
                "position": 2,
                "name": "Plasma",
                "item": f"{BASE_URL}/plasma/"
            },
            {
                "@type": "ListItem",
                "position": 3,
                "name": city_name,
                "item": f"{BASE_URL}/plasma/{city_slug}"
            }
        ]
    }


def build_article(city_name, city_slug, title, date_published=None, date_modified=None):
    """Article node with author/publisher referencing the organization."""
    today = date.today().isoformat()
    return {
        "@type": "Article",
        "mainEntityOfPage": f"{BASE_URL}/plasma/{city_slug}",
        "headline": title,
        "datePublished": date_published or today,
        "dateModified": date_modified or today,
        "author": {"@id": ORG_ID},
        "publisher": {"@id": ORG_ID}
    }


def build_faq_page(city_slug, faqs):
    """FAQPage node with mainEntityOfPage and Question/Answer array.

    Args:
        city_slug: URL slug for canonical URL
        faqs: List of dicts with 'question' and 'answer' keys.
              These MUST exactly match the visible FAQ on the page.
    """
    main_entity = []
    for faq in faqs:
        main_entity.append({
            "@type": "Question",
            "name": faq["question"],
            "acceptedAnswer": {
                "@type": "Answer",
                "text": faq["answer"]
            }
        })

    return {
        "@type": "FAQPage",
        "mainEntityOfPage": f"{BASE_URL}/plasma/{city_slug}",
        "mainEntity": main_entity
    }


def build_graph(city_name, city_slug, title, faqs, date_published=None, date_modified=None):
    """Assemble the complete @graph JSON-LD bundle.

    Args:
        city_name: Display name (e.g., "Edmond")
        city_slug: URL slug (e.g., "edmond")
        title: Page headline/title
        faqs: List of dicts with 'question' and 'answer' keys
        date_published: ISO date string (defaults to today)
        date_modified: ISO date string (defaults to today)

    Returns:
        Complete JSON-LD string ready to embed in <script> tag.
    """
    graph = {
        "@context": "https://schema.org",
        "@graph": [
            build_organization(),
            build_breadcrumbs(city_name, city_slug),
            build_article(city_name, city_slug, title, date_published, date_modified),
            build_faq_page(city_slug, faqs),
        ]
    }
    return json.dumps(graph, indent=6, ensure_ascii=False)


def validate_faq_match(schema_faqs, visible_faqs):
    """Verify schema FAQ exactly matches visible FAQ.

    Args:
        schema_faqs: List from the @graph FAQPage mainEntity
        visible_faqs: List of dicts with 'question' and 'answer' from the page

    Returns:
        (is_valid, errors) tuple
    """
    errors = []

    if len(schema_faqs) != len(visible_faqs):
        errors.append(
            f"FAQ count mismatch: schema has {len(schema_faqs)}, "
            f"visible has {len(visible_faqs)}"
        )
        return False, errors

    for i, (s, v) in enumerate(zip(schema_faqs, visible_faqs)):
        s_q = s.get("name", "")
        v_q = v.get("question", "")
        if s_q != v_q:
            errors.append(f"FAQ #{i+1} question mismatch: schema={s_q!r} vs visible={v_q!r}")

        s_a = s.get("acceptedAnswer", {}).get("text", "")
        v_a = v.get("answer", "")
        if s_a != v_a:
            errors.append(f"FAQ #{i+1} answer mismatch (first 80 chars): "
                          f"schema={s_a[:80]!r} vs visible={v_a[:80]!r}")

    return len(errors) == 0, errors


if __name__ == "__main__":
    # Quick test
    test_faqs = [
        {"question": "How much does plasma pay?", "answer": "Varies by center."},
        {"question": "Is it safe?", "answer": "Yes, FDA-regulated."},
    ]
    result = build_graph("Edmond", "edmond", "Test Title", test_faqs)
    parsed = json.loads(result)
    print(json.dumps(parsed, indent=2))

    # Validate
    schema_faqs = parsed["@graph"][3]["mainEntity"]
    valid, errs = validate_faq_match(schema_faqs, test_faqs)
    print(f"\nValidation: {'PASS' if valid else 'FAIL'}")
    for e in errs:
        print(f"  ERROR: {e}")
