"""
InterviewVault — Company Intelligence Routes
Perplexity + Gemini powered company-specific interview insights.
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import re

import models
from auth import get_current_user
from database import get_db
from services.perplexity_service import search_company_interview_data, synthesize_company_insights
from services.learning_path_service import get_user_learning_path

router = APIRouter(prefix="/api/companies", tags=["Company Intelligence"])

# ─── Pre-seeded Companies ─────────────────────────────────────────────────────
# Logo URLs use Google's s2 favicon proxy for consistent 64px icons across domains.
def _logo(domain: str) -> str:
    return f"https://www.google.com/s2/favicons?domain={domain}&sz=128"


SEEDED_COMPANIES = [
    # ── Big Tech ───────────────────────────────────────────────────────────
    {"name": "Google", "slug": "google", "sector": "Big Tech", "domain": "search & cloud", "logo_url": _logo("google.com")},
    {"name": "Microsoft", "slug": "microsoft", "sector": "Big Tech", "domain": "enterprise software & cloud", "logo_url": _logo("microsoft.com")},
    {"name": "Apple", "slug": "apple", "sector": "Big Tech", "domain": "consumer tech & software", "logo_url": _logo("apple.com")},
    {"name": "Amazon", "slug": "amazon", "sector": "Big Tech", "domain": "e-commerce & cloud", "logo_url": _logo("amazon.com")},
    {"name": "Meta", "slug": "meta", "sector": "Big Tech", "domain": "social media & VR", "logo_url": _logo("meta.com")},
    {"name": "Netflix", "slug": "netflix", "sector": "Big Tech", "domain": "streaming & entertainment", "logo_url": _logo("netflix.com")},
    {"name": "Nvidia", "slug": "nvidia", "sector": "Big Tech", "domain": "GPUs & AI hardware", "logo_url": _logo("nvidia.com")},
    {"name": "Tesla", "slug": "tesla", "sector": "Big Tech", "domain": "EV & autonomous driving", "logo_url": _logo("tesla.com")},

    # ── AI / ML ────────────────────────────────────────────────────────────
    {"name": "OpenAI", "slug": "openai", "sector": "AI & ML", "domain": "frontier AI research", "logo_url": _logo("openai.com")},
    {"name": "Anthropic", "slug": "anthropic", "sector": "AI & ML", "domain": "AI safety & LLMs", "logo_url": _logo("anthropic.com")},
    {"name": "Hugging Face", "slug": "hugging-face", "sector": "AI & ML", "domain": "open ML platform", "logo_url": _logo("huggingface.co")},
    {"name": "Perplexity", "slug": "perplexity", "sector": "AI & ML", "domain": "AI answer engine", "logo_url": _logo("perplexity.ai")},
    {"name": "Cohere", "slug": "cohere", "sector": "AI & ML", "domain": "enterprise LLMs", "logo_url": _logo("cohere.com")},

    # ── Fintech ────────────────────────────────────────────────────────────
    {"name": "Stripe", "slug": "stripe", "sector": "Fintech", "domain": "payments infrastructure", "logo_url": _logo("stripe.com")},
    {"name": "PayPal", "slug": "paypal", "sector": "Fintech", "domain": "digital payments", "logo_url": _logo("paypal.com")},
    {"name": "Visa", "slug": "visa", "sector": "Fintech", "domain": "card networks", "logo_url": _logo("visa.com")},
    {"name": "Coinbase", "slug": "coinbase", "sector": "Fintech", "domain": "crypto exchange", "logo_url": _logo("coinbase.com")},
    {"name": "Robinhood", "slug": "robinhood", "sector": "Fintech", "domain": "retail trading", "logo_url": _logo("robinhood.com")},
    {"name": "Block", "slug": "block", "sector": "Fintech", "domain": "Square & Cash App", "logo_url": _logo("block.xyz")},

    # ── Indian Tech / Unicorns ─────────────────────────────────────────────
    {"name": "Flipkart", "slug": "flipkart", "sector": "India Tech", "domain": "e-commerce", "logo_url": _logo("flipkart.com")},
    {"name": "Razorpay", "slug": "razorpay", "sector": "India Tech", "domain": "payments", "logo_url": _logo("razorpay.com")},
    {"name": "Zomato", "slug": "zomato", "sector": "India Tech", "domain": "food delivery", "logo_url": _logo("zomato.com")},
    {"name": "Swiggy", "slug": "swiggy", "sector": "India Tech", "domain": "food delivery", "logo_url": _logo("swiggy.com")},
    {"name": "PhonePe", "slug": "phonepe", "sector": "India Tech", "domain": "UPI & payments", "logo_url": _logo("phonepe.com")},
    {"name": "Paytm", "slug": "paytm", "sector": "India Tech", "domain": "payments & banking", "logo_url": _logo("paytm.com")},
    {"name": "Zerodha", "slug": "zerodha", "sector": "India Tech", "domain": "stock broking", "logo_url": _logo("zerodha.com")},
    {"name": "CRED", "slug": "cred", "sector": "India Tech", "domain": "credit-card rewards", "logo_url": _logo("cred.club")},
    {"name": "Ola", "slug": "ola", "sector": "India Tech", "domain": "ride-sharing & EV", "logo_url": _logo("olacabs.com")},

    # ── Mobility / Marketplaces ───────────────────────────────────────────
    {"name": "Uber", "slug": "uber", "sector": "Mobility & Marketplaces", "domain": "ride-sharing & logistics", "logo_url": _logo("uber.com")},
    {"name": "Lyft", "slug": "lyft", "sector": "Mobility & Marketplaces", "domain": "ride-sharing", "logo_url": _logo("lyft.com")},
    {"name": "Airbnb", "slug": "airbnb", "sector": "Mobility & Marketplaces", "domain": "travel marketplace", "logo_url": _logo("airbnb.com")},
    {"name": "DoorDash", "slug": "doordash", "sector": "Mobility & Marketplaces", "domain": "food delivery", "logo_url": _logo("doordash.com")},
    {"name": "Instacart", "slug": "instacart", "sector": "Mobility & Marketplaces", "domain": "grocery delivery", "logo_url": _logo("instacart.com")},
    {"name": "Booking.com", "slug": "booking", "sector": "Mobility & Marketplaces", "domain": "travel & hospitality", "logo_url": _logo("booking.com")},

    # ── Cloud / Infra / Dev tools ──────────────────────────────────────────
    {"name": "Snowflake", "slug": "snowflake", "sector": "Cloud & Infra", "domain": "data warehousing", "logo_url": _logo("snowflake.com")},
    {"name": "Databricks", "slug": "databricks", "sector": "Cloud & Infra", "domain": "data & AI platform", "logo_url": _logo("databricks.com")},
    {"name": "MongoDB", "slug": "mongodb", "sector": "Cloud & Infra", "domain": "document database", "logo_url": _logo("mongodb.com")},
    {"name": "Cloudflare", "slug": "cloudflare", "sector": "Cloud & Infra", "domain": "edge network & CDN", "logo_url": _logo("cloudflare.com")},
    {"name": "Datadog", "slug": "datadog", "sector": "Cloud & Infra", "domain": "observability", "logo_url": _logo("datadoghq.com")},
    {"name": "HashiCorp", "slug": "hashicorp", "sector": "Cloud & Infra", "domain": "infra automation", "logo_url": _logo("hashicorp.com")},
    {"name": "GitHub", "slug": "github", "sector": "Cloud & Infra", "domain": "developer platform", "logo_url": _logo("github.com")},
    {"name": "GitLab", "slug": "gitlab", "sector": "Cloud & Infra", "domain": "devops platform", "logo_url": _logo("gitlab.com")},

    # ── Enterprise SaaS ────────────────────────────────────────────────────
    {"name": "Salesforce", "slug": "salesforce", "sector": "Enterprise SaaS", "domain": "CRM & cloud", "logo_url": _logo("salesforce.com")},
    {"name": "Adobe", "slug": "adobe", "sector": "Enterprise SaaS", "domain": "creative & document cloud", "logo_url": _logo("adobe.com")},
    {"name": "Oracle", "slug": "oracle", "sector": "Enterprise SaaS", "domain": "databases & cloud", "logo_url": _logo("oracle.com")},
    {"name": "ServiceNow", "slug": "servicenow", "sector": "Enterprise SaaS", "domain": "workflow automation", "logo_url": _logo("servicenow.com")},
    {"name": "Atlassian", "slug": "atlassian", "sector": "Enterprise SaaS", "domain": "team & dev tools", "logo_url": _logo("atlassian.com")},
    {"name": "Workday", "slug": "workday", "sector": "Enterprise SaaS", "domain": "HR & finance cloud", "logo_url": _logo("workday.com")},
    {"name": "SAP", "slug": "sap", "sector": "Enterprise SaaS", "domain": "ERP & business software", "logo_url": _logo("sap.com")},
    {"name": "Shopify", "slug": "shopify", "sector": "Enterprise SaaS", "domain": "commerce platform", "logo_url": _logo("shopify.com")},

    # ── Social / Consumer ──────────────────────────────────────────────────
    {"name": "LinkedIn", "slug": "linkedin", "sector": "Social & Consumer", "domain": "professional network", "logo_url": _logo("linkedin.com")},
    {"name": "TikTok", "slug": "tiktok", "sector": "Social & Consumer", "domain": "short-video social", "logo_url": _logo("tiktok.com")},
    {"name": "Snap", "slug": "snap", "sector": "Social & Consumer", "domain": "messaging & AR", "logo_url": _logo("snap.com")},
    {"name": "Pinterest", "slug": "pinterest", "sector": "Social & Consumer", "domain": "visual discovery", "logo_url": _logo("pinterest.com")},
    {"name": "Spotify", "slug": "spotify", "sector": "Social & Consumer", "domain": "audio streaming", "logo_url": _logo("spotify.com")},
    {"name": "Discord", "slug": "discord", "sector": "Social & Consumer", "domain": "community chat", "logo_url": _logo("discord.com")},
    {"name": "Reddit", "slug": "reddit", "sector": "Social & Consumer", "domain": "social discussion", "logo_url": _logo("reddit.com")},
    {"name": "X", "slug": "x", "sector": "Social & Consumer", "domain": "real-time social", "logo_url": _logo("x.com")},

    # ── Finance / Trading ──────────────────────────────────────────────────
    {"name": "Goldman Sachs", "slug": "goldman-sachs", "sector": "Finance & Trading", "domain": "investment banking", "logo_url": _logo("goldmansachs.com")},
    {"name": "JPMorgan", "slug": "jpmorgan", "sector": "Finance & Trading", "domain": "banking & trading", "logo_url": _logo("jpmorgan.com")},
    {"name": "Morgan Stanley", "slug": "morgan-stanley", "sector": "Finance & Trading", "domain": "wealth & banking", "logo_url": _logo("morganstanley.com")},
    {"name": "Citadel", "slug": "citadel", "sector": "Finance & Trading", "domain": "hedge fund & quant", "logo_url": _logo("citadel.com")},
    {"name": "Two Sigma", "slug": "two-sigma", "sector": "Finance & Trading", "domain": "quant trading", "logo_url": _logo("twosigma.com")},
    {"name": "Jane Street", "slug": "jane-street", "sector": "Finance & Trading", "domain": "prop trading", "logo_url": _logo("janestreet.com")},
]


def _slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


class AnalyzeRequest(BaseModel):
    company_name: str
    job_role: str


@router.get("")
def list_companies(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """List all known companies with cached insights."""
    cached = db.query(models.CompanyInsight.company_name, models.CompanyInsight.company_slug,
                      models.CompanyInsight.job_role, models.CompanyInsight.logo_url,
                      models.CompanyInsight.domain, models.CompanyInsight.analyzed_at).all()

    seed_by_slug = {s["slug"]: s for s in SEEDED_COMPANIES}

    # Build a unique company list (cached rows take priority for analyzed_at,
    # but we still merge in the seed sector/logo so the UI can group properly).
    seen = set()
    result = []
    for row in cached:
        if row.company_slug not in seen:
            seen.add(row.company_slug)
            seed = seed_by_slug.get(row.company_slug, {})
            result.append({
                "name": row.company_name,
                "slug": row.company_slug,
                "logo_url": row.logo_url or seed.get("logo_url"),
                "domain": row.domain or seed.get("domain", ""),
                "sector": seed.get("sector", "Other"),
                "analyzed_at": row.analyzed_at,
            })

    # Add seeded companies not yet in DB
    for s in SEEDED_COMPANIES:
        if s["slug"] not in seen:
            result.append({**s, "analyzed_at": None})

    return {"companies": result}


@router.get("/{company_slug}/insights")
def get_company_insights(
    company_slug: str,
    job_role: str = "",
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Get cached insights for a company+role. Returns null if not yet analyzed."""
    if not job_role:
        # Default to user's target role
        job_role = current_user.target_role or "software_engineer"

    insight = db.query(models.CompanyInsight).filter(
        models.CompanyInsight.company_slug == company_slug,
        models.CompanyInsight.job_role == job_role,
    ).first()

    if not insight:
        return {"available": False, "company_slug": company_slug, "job_role": job_role}

    return {
        "available": True,
        "company_name": insight.company_name,
        "company_slug": insight.company_slug,
        "job_role": insight.job_role,
        "logo_url": insight.logo_url,
        "domain": insight.domain,
        "topics": insight.topics,
        "topic_weights": insight.topic_weights,
        "patterns": insight.patterns,
        "analysis_summary": insight.analysis_summary,
        "analyzed_at": insight.analyzed_at,
    }


@router.post("/analyze")
def analyze_company(
    data: AnalyzeRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Trigger Perplexity + Gemini analysis for a company + role. Cached after first run."""
    slug = _slugify(data.company_name)

    # Check cache first
    existing = db.query(models.CompanyInsight).filter(
        models.CompanyInsight.company_slug == slug,
        models.CompanyInsight.job_role == data.job_role,
    ).first()

    if existing:
        return {
            "status": "cached",
            "company_slug": slug,
            "company_name": existing.company_name,
            "topics": existing.topics,
            "patterns": existing.patterns,
            "analysis_summary": existing.analysis_summary,
            "topic_weights": existing.topic_weights,
        }

    # Fetch from Perplexity
    raw_data = search_company_interview_data(data.company_name, data.job_role)

    if not raw_data:
        # Fallback: use Gemini knowledge only
        from services.ai_service import _generate, _safe_parse_json
        fallback_prompt = f"""Based on your knowledge, what are the key interview topics and patterns for 
{data.job_role.replace('_', ' ').title()} positions at {data.company_name}?
Return JSON: {{"topics": [...], "topic_weights": {{}}, "patterns": [...], "analysis_summary": "...", "domain": "..."}}"""
        raw_fb = _generate(fallback_prompt, json_mode=True)
        if raw_fb:
            synthesis = _safe_parse_json(raw_fb) or {}
        else:
            synthesis = {}
        raw_data = f"Gemini knowledge-based analysis for {data.company_name}"
    else:
        synthesis = synthesize_company_insights(data.company_name, data.job_role, raw_data)

    # Find logo from seeded list or use favicon
    seed = next((s for s in SEEDED_COMPANIES if s["slug"] == slug), None)
    logo_url = seed["logo_url"] if seed else f"https://www.google.com/s2/favicons?domain={slug}.com&sz=64"

    insight = models.CompanyInsight(
        company_name=data.company_name,
        company_slug=slug,
        job_role=data.job_role,
        logo_url=logo_url,
        topics=synthesis.get("topics", []),
        topic_weights=synthesis.get("topic_weights", {}),
        patterns=synthesis.get("patterns", []),
        analysis_summary=synthesis.get("analysis_summary", ""),
        source_data=raw_data[:5000],
        domain=synthesis.get("domain", "technology"),
    )
    db.add(insight)
    db.commit()
    db.refresh(insight)

    return {
        "status": "analyzed",
        "company_slug": insight.company_slug,
        "company_name": insight.company_name,
        "topics": insight.topics,
        "patterns": insight.patterns,
        "analysis_summary": insight.analysis_summary,
        "topic_weights": insight.topic_weights,
        "domain": insight.domain,
    }


@router.post("/{company_slug}/apply-to-path")
def apply_company_to_path(
    company_slug: str,
    job_role: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Reorder/filter user's learning path based on company insight topic weights."""
    from datetime import datetime

    insight = db.query(models.CompanyInsight).filter(
        models.CompanyInsight.company_slug == company_slug,
        models.CompanyInsight.job_role == job_role,
    ).first()
    if not insight:
        raise HTTPException(status_code=404, detail="Company insights not found. Run analysis first.")

    lp = get_user_learning_path(db, current_user.id)
    if not lp:
        raise HTTPException(status_code=404, detail="No learning path found.")

    company_topics = insight.topics or []
    weights = insight.topic_weights or {}

    # Sort existing green list: company-relevant topics first
    def sort_key(topic):
        # Check if topic matches any company topic (fuzzy)
        for ct in company_topics:
            if ct.lower() in topic.lower() or topic.lower() in ct.lower():
                return -(weights.get(ct, 50))
        return 0

    sorted_green = sorted(lp.green_topics, key=sort_key)

    # Add company-specific topics not in green list to top of yellow
    new_company_topics = [t for t in company_topics if not any(
        t.lower() in g.lower() or g.lower() in t.lower() for g in lp.green_topics
    )]
    new_yellow = new_company_topics + [y for y in lp.yellow_topics if y not in new_company_topics]

    lp.green_topics = sorted_green
    lp.yellow_topics = new_yellow
    lp.company = insight.company_name
    lp.last_modified = datetime.utcnow()
    db.commit()

    return {
        "success": True,
        "green_topics": lp.green_topics,
        "yellow_topics": lp.yellow_topics,
        "message": f"Learning path reordered for {insight.company_name}!",
    }
