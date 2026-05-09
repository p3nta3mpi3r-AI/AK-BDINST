"""Generate unique editorial content per city using Claude LLM.

Takes structured center data for a city and produces:
- TL;DR summary
- Payout-range prose (with disclaimers)
- Maximize-earnings tips
- Eligibility narrative
- Plasma-vs-blood comparison
- 8 FAQ Q&A pairs with city-specific detail
- Related guides suggestions

All content respects hard rules:
- No fixed dollar amounts without disclaimer
- No fabricated data
- No implication site IS the OBI nonprofit
- Brand is "OK Blood Donor"
"""
import os
import sys
import json
import re

# Reuse the LLM call pattern from content-syndication-machine
try:
    import anthropic
except ImportError:
    # Fallback: use requests directly
    anthropic = None

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-5-20250514")


def call_claude(system_prompt, user_prompt, max_tokens=8000, temperature=0.4):
    """Call Claude API and return text response."""
    if anthropic:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        message = client.messages.create(
            model=MODEL,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        return message.content[0].text
    else:
        import urllib.request
        headers = {
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        body = json.dumps({
            "model": MODEL,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_prompt}],
        }).encode()
        req = urllib.request.Request(
            "https://api.anthropic.com/v1/messages",
            data=body,
            headers=headers,
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode())
        return data["content"][0]["text"]


def parse_json_response(text):
    """Extract JSON from Claude response, handling code fences."""
    # Try to find JSON in code fences first
    fence_match = re.search(r'```(?:json)?\s*\n(.*?)\n```', text, re.DOTALL)
    if fence_match:
        return json.loads(fence_match.group(1))
    # Try raw JSON
    text = text.strip()
    if text.startswith('{'):
        return json.loads(text)
    raise ValueError(f"Could not parse JSON from response: {text[:200]}...")


SYSTEM_PROMPT = """You are an editorial content generator for OK Blood Donor (oklahomabloodinstitute.com),
an independent editorial guide to plasma and blood donation in Oklahoma.

HARD RULES — violating any of these is a generation failure:
1. NEVER state a fixed dollar amount as a guarantee. Always use RANGES with "varies by center" disclaimer.
   GOOD: "New donors may earn approximately $400–$700 or more in their first month"
   BAD: "New donors earn $700 in their first month"
2. NEVER fabricate addresses, phone numbers, or hours. Use only what's provided in the center data.
3. NEVER imply OK Blood Donor IS the Our Blood Institute (OBI) nonprofit. OK Blood Donor is an independent editorial guide.
4. NEVER make medical claims or medical advice. Always say "consult your healthcare provider."
5. Always mention that rates "vary by center, location, promotion, donor weight, and frequency."
6. Use "OK Blood Donor" as the brand name, never "Oklahoma Blood Institute" as YOUR brand.
7. When referring to the real nonprofit, say "Our Blood Institute (formerly Oklahoma Blood Institute)."

TONE: Informational, honest, practical. Like a knowledgeable friend who did the research so you don't have to.
Write at a 9th-grade reading level. Avoid jargon. Use active voice."""


def generate_city_content(city_name, city_slug, centers, year="2026"):
    """Generate all editorial sections for a city's plasma page.

    Args:
        city_name: Display name (e.g., "Oklahoma City")
        city_slug: URL slug (e.g., "oklahoma-city")
        centers: List of center dicts from centers.json filtered for this city
        year: Current year for dateline

    Returns:
        Dict with all content sections ready for template assembly.
    """
    center_count = len(centers)
    chains = sorted(set(c["chain"] for c in centers))
    chains_str = ", ".join(chains[:-1]) + f", and {chains[-1]}" if len(chains) > 1 else chains[0]

    # Build center summary for the prompt
    center_lines = []
    for c in centers:
        line = f"- {c['name']}: {c['address']}, {c['city']}, {c['state']} {c['zip']}"
        if c.get("phone"):
            line += f" | Phone: {c['phone']}"
        if c.get("hours"):
            line += f" | Hours: {c['hours']}"
        if c.get("notes"):
            line += f" | Notes: {c['notes']}"
        center_lines.append(line)
    centers_text = "\n".join(center_lines)

    user_prompt = f"""Generate editorial content for a plasma donation city guide page.

CITY: {city_name}, Oklahoma
URL: oklahomabloodinstitute.com/plasma/{city_slug}
YEAR: {year}
NUMBER OF CENTERS: {center_count}
CHAINS PRESENT: {chains_str}

CENTER DATA (use ONLY these addresses/phones/hours — do not invent any):
{centers_text}

Generate a JSON object with these exact keys:

{{
  "title": "How to Donate Plasma for Money in {city_name}, Oklahoma — {year} Guide",
  "meta_description": "SEO meta description, 150-160 chars, includes center count and city name",
  "tldr": "TL;DR paragraph (3-5 sentences). State center count, chains present, new-donor bonus RANGE ($400-$700+), returning pay RANGE ($30-$80/visit). Mention OK Blood Donor does not pay donors. Include 'varies by center' disclaimer.",
  "payout_intro": "1 sentence introducing the payout section",
  "new_donor_arc": "Paragraph about new-donor bonus arc. RANGES only. 'approximately $400 to $700 or more' with disclaimer.",
  "returning_donor_pay": "Paragraph about returning donor pay. Weight-dependent, first vs second donation of week. $30-$50 first, $50-$80 second. Monthly $200-$400 range.",
  "payment_method": "Short paragraph about prepaid debit card payment.",
  "honest_ceiling": "Paragraph with realistic earnings ceiling. Month 1 range, ongoing monthly range. Emphasize these are ESTIMATES not guarantees.",
  "maximize_tips": ["tip1", "tip2", "tip3", "tip4", "tip5", "tip6"],
  "maximize_tips_intro": "1-2 sentence intro for maximize earnings section",
  "eligibility_items": ["item1", "item2", "item3", "item4", "item5", "item6", "item7"],
  "eligibility_intro": "1-2 sentence intro for eligibility section",
  "plasma_vs_blood_intro": "1 sentence section intro",
  "choose_plasma": "Paragraph for 'choose plasma if...' with city-specific detail",
  "choose_blood": "Paragraph for 'choose blood if...' referencing local nonprofit options",
  "both_option": "Short paragraph noting many donors do both",
  "faqs": [
    {{
      "question": "How much can I make donating plasma in {city_name}?",
      "answer": "Detailed answer with RANGES and disclaimers. 3-5 sentences."
    }},
    {{
      "question": "How often can I donate plasma in {city_name}?",
      "answer": "FDA rules: twice per 7-day period, 48hr between. 2-3 sentences."
    }},
    {{
      "question": "Is plasma donation safe?",
      "answer": "FDA-regulated, single-use equipment, apheresis process. 3-4 sentences."
    }},
    {{
      "question": "What is the difference between blood donation and plasma donation pay?",
      "answer": "Nonprofit blood = uncompensated. Commercial plasma = paid via debit card. Time tradeoff. 2-3 sentences."
    }},
    {{
      "question": "Where can I donate plasma near me in {city_name}?",
      "answer": "List ALL centers from the data above with addresses. Reference comparison table. 2-4 sentences."
    }},
    {{
      "question": "How long does a plasma donation take in {city_name}?",
      "answer": "First visit 2-3hrs. Return visits 45-90min. Hydration tip. 2-3 sentences."
    }},
    {{
      "question": "Do I need an appointment to donate plasma in {city_name}?",
      "answer": "Most accept walk-ins. Online scheduling recommended for new donors. 2-3 sentences."
    }},
    {{
      "question": "What do I need to bring to my first plasma donation in {city_name}?",
      "answer": "Photo ID, SSN documentation, proof of address. Meal and hydration prep. 3-4 sentences."
    }}
  ],
  "related_cities": ["list of 2-4 nearby Oklahoma cities that have or might have plasma centers"]
}}

IMPORTANT:
- Every dollar figure MUST be a range (e.g., "$400–$700") not a fixed number
- Every dollar figure MUST include a disclaimer phrase like "varies by center" or "depending on promotion"
- The FAQ answers MUST be substantive (3+ sentences each), not one-liners
- Make the content genuinely unique to {city_name} — reference local geography, nearby cities, student populations if near a university, etc.
- Output valid JSON only. No markdown fences, no preamble."""

    response_text = call_claude(SYSTEM_PROMPT, user_prompt, max_tokens=6000, temperature=0.4)
    content = parse_json_response(response_text)

    # Validate FAQ count
    if len(content.get("faqs", [])) != 8:
        raise ValueError(f"Expected 8 FAQs, got {len(content.get('faqs', []))}")

    return content


if __name__ == "__main__":
    # Quick test with dummy data
    test_centers = [
        {
            "chain": "CSL Plasma",
            "name": "CSL Plasma Test",
            "address": "123 Main St",
            "city": "Edmond",
            "state": "OK",
            "zip": "73034",
            "phone": "(405) 555-0100",
            "hours": "Mon–Fri 7am–7pm",
            "notes": "Test center"
        }
    ]
    if ANTHROPIC_API_KEY:
        result = generate_city_content("Edmond", "edmond", test_centers)
        print(json.dumps(result, indent=2))
    else:
        print("ANTHROPIC_API_KEY not set — skipping live test", file=sys.stderr)
        print('{"status": "dry_run", "message": "Set ANTHROPIC_API_KEY to run live test"}')
