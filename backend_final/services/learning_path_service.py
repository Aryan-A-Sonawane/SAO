"""
InterviewVault — Learning Path Service
Hardcoded standard paths (Green) per role + Gemini-generated extended topics (Yellow).
"""
from typing import Dict, List, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from services.ai_service import _generate, _safe_parse_json
import models

# ─── Hardcoded Standard Learning Paths ───────────────────────────────────────
STANDARD_PATHS: Dict[str, Dict[str, Any]] = {
    "data_scientist": {
        "title": "Data Scientist",
        "icon": "📊",
        "description": "Master statistical foundations, ML algorithms, and data story-telling.",
        "green": [
            "Statistics & Probability",
            "Linear Algebra & Calculus",
            "Python for Data Science",
            "SQL & Data Querying",
            "Exploratory Data Analysis",
            "Feature Engineering",
            "Machine Learning Fundamentals",
            "Model Evaluation & Metrics",
        ],
        "yellow_seed": ["NLP & Text Processing", "Computer Vision", "Deep Learning & Neural Networks",
                        "GenAI & LLMs", "MLOps & Model Deployment", "Time Series Analysis",
                        "Recommender Systems", "Big Data & Spark", "A/B Testing & Experimentation"],
    },
    "software_engineer": {
        "title": "Software Engineer",
        "icon": "💻",
        "description": "Excel at DSA, system design, and core CS fundamentals.",
        "green": [
            "Data Structures & Algorithms",
            "System Design",
            "Object-Oriented Programming",
            "Databases (SQL + NoSQL)",
            "Computer Networks",
            "Operating Systems",
            "Concurrency & Multithreading",
            "Behavioral & Leadership",
        ],
        "yellow_seed": ["Distributed Systems", "Kubernetes & Docker", "Microservices Architecture",
                        "Cloud Architecture (AWS/GCP)", "Low-Level System Design",
                        "Security & Authentication", "Performance Optimization", "GraphQL & WebSockets"],
    },
    "ml_engineer": {
        "title": "ML Engineer",
        "icon": "🤖",
        "description": "Build, deploy, and scale production ML systems.",
        "green": [
            "Machine Learning Algorithms",
            "Deep Learning & Neural Networks",
            "Python (NumPy/Pandas/PyTorch)",
            "Data Pipelines & ETL",
            "Model Deployment & Serving",
            "SQL for ML",
            "Statistics & Probability",
            "System Design for ML",
        ],
        "yellow_seed": ["MLOps (MLflow/Kubeflow)", "Feature Stores", "Distributed Training",
                        "LLM Fine-tuning & RLHF", "GenAI Systems & RAG", "Computer Vision in Production",
                        "Recommendation Systems", "Reinforcement Learning"],
    },
    "frontend_developer": {
        "title": "Frontend Developer",
        "icon": "🎨",
        "description": "Craft exceptional user interfaces and web experiences.",
        "green": [
            "HTML & CSS Mastery",
            "JavaScript (ES6+)",
            "React.js Fundamentals",
            "State Management (Redux/Zustand)",
            "REST APIs & Async JS",
            "Web Performance & Optimization",
            "Responsive & Accessible Design",
            "Browser APIs & DOM",
        ],
        "yellow_seed": ["TypeScript", "Next.js & SSR", "Testing (Jest/Cypress/RTL)", "WebSockets & Real-time",
                        "Progressive Web Apps", "Web Animations (GSAP/Framer)", "Micro-frontends",
                        "Design Systems & Storybook"],
    },
    "backend_developer": {
        "title": "Backend Developer",
        "icon": "⚙️",
        "description": "Architect robust APIs, databases, and scalable server systems.",
        "green": [
            "Python / Java / Node.js Core",
            "Databases (SQL + NoSQL)",
            "REST API Design",
            "Authentication & Authorization",
            "System Design",
            "Caching & Message Queues",
            "Security Best Practices",
            "Testing & CI/CD",
        ],
        "yellow_seed": ["Microservices Architecture", "Docker & Kubernetes", "Event-driven Architecture",
                        "gRPC & WebSockets", "Database Internals & Optimization", "Cloud (AWS/GCP/Azure)",
                        "Service Mesh & Observability", "Serverless Computing"],
    },
    "product_manager": {
        "title": "Product Manager",
        "icon": "📋",
        "description": "Define product strategy, drive execution, and ship great products.",
        "green": [
            "Product Strategy & Vision",
            "User Research & Personas",
            "PRD Writing & Documentation",
            "Prioritization Frameworks (RICE, ICE)",
            "Go-to-Market Strategy",
            "Metrics, KPIs & Analytics",
            "Agile / Scrum Process",
            "Stakeholder Management",
        ],
        "yellow_seed": ["Technical Literacy for PMs", "Design Thinking & UX", "Competitive Analysis",
                        "Growth Hacking", "Financial Modeling & Unit Economics", "Data Analysis (SQL basics)",
                        "Product-Led Growth", "AI/ML for Product Managers"],
    },
    "devops_engineer": {
        "title": "DevOps / Cloud Engineer",
        "icon": "☁️",
        "description": "Build reliable infrastructure, CI/CD pipelines, and cloud-native systems.",
        "green": [
            "Linux & Shell Scripting",
            "Docker & Containerization",
            "Kubernetes Orchestration",
            "CI/CD Pipelines",
            "Cloud Fundamentals (AWS/GCP/Azure)",
            "Networking & DNS",
            "Infrastructure as Code (Terraform)",
            "Monitoring & Alerting",
        ],
        "yellow_seed": ["Service Mesh (Istio/Linkerd)", "Observability (Prometheus/Grafana)", "DevSecOps",
                        "Cost Optimization", "Site Reliability Engineering", "GitOps",
                        "Chaos Engineering", "Multi-cloud Strategy"],
    },
    "data_analyst": {
        "title": "Data Analyst",
        "icon": "📈",
        "description": "Turn data into actionable insights with analytics and visualization.",
        "green": [
            "SQL (Advanced Queries)",
            "Excel & Google Sheets",
            "Python / R for Analysis",
            "Statistics & Hypothesis Testing",
            "Data Visualization (Tableau/Power BI)",
            "Business Intelligence",
            "Exploratory Data Analysis",
            "Communication & Storytelling",
        ],
        "yellow_seed": ["Machine Learning Basics", "Predictive Analytics", "A/B Testing",
                        "Big Data Tools (Spark/Hive)", "Dashboard Design", "Data Governance & Quality",
                        "ETL Pipelines", "Cloud Analytics (BigQuery/Redshift)"],
    },
    # ─── New: Technical roles (trending + extended catalog) ─────────────────
    "gen_ai_engineer": {
        "title": "Gen AI Engineer",
        "icon": "🧬",
        "description": "Build production LLM, RAG, and agent systems end-to-end.",
        "green": [
            "LLM Fundamentals & Transformers",
            "Prompt Engineering & Evaluation",
            "RAG Architecture (Embeddings + Vector DBs)",
            "Agentic Frameworks (LangChain/LangGraph)",
            "Fine-Tuning, LoRA & RLHF",
            "Python & PyTorch",
            "ML System Design for GenAI",
            "Safety, Hallucinations & Guardrails",
        ],
        "yellow_seed": ["Multimodal LLMs", "Function/Tool Calling", "Vector DB Internals",
                        "Inference Optimization (vLLM/TGI)", "Eval Harnesses (Ragas/LangSmith)",
                        "Cost & Latency Tuning", "GPU & Distributed Inference", "Synthetic Data Generation"],
    },
    "data_engineer": {
        "title": "Data Engineer",
        "icon": "🛢️",
        "description": "Design and operate scalable batch + streaming data systems.",
        "green": [
            "SQL & Data Modeling",
            "Python for Data Engineering",
            "Batch Processing (Spark/Hadoop)",
            "Streaming (Kafka/Flink)",
            "Data Warehousing (Snowflake/BigQuery)",
            "ETL/ELT Design & Orchestration (Airflow/dbt)",
            "Data Quality & Observability",
            "Cloud Storage & Lakehouses",
        ],
        "yellow_seed": ["Iceberg/Delta/Hudi Table Formats", "CDC Pipelines", "Schema Evolution",
                        "Cost Optimization on Warehouses", "Real-time Feature Pipelines",
                        "Data Mesh Architecture", "Privacy & PII Handling", "Vector & ML Feature Stores"],
    },
    "cloud_architect": {
        "title": "Cloud Architect",
        "icon": "🏛️",
        "description": "Design secure, scalable multi-cloud architectures and governance.",
        "green": [
            "AWS / GCP / Azure Core Services",
            "Networking & VPC Design",
            "Identity, IAM & Zero Trust",
            "Multi-Region & High Availability",
            "Cost Management & FinOps",
            "Infrastructure as Code (Terraform)",
            "Security & Compliance",
            "Migration & Modernization Patterns",
        ],
        "yellow_seed": ["Edge & CDN Strategy", "Hybrid Cloud Patterns", "Disaster Recovery Playbooks",
                        "Serverless Architecture", "Well-Architected Reviews", "Container Platforms (EKS/GKE/AKS)",
                        "Data Lake Architecture", "Observability Stack Design"],
    },
    "site_reliability_engineer": {
        "title": "Site Reliability Engineer",
        "icon": "🛰️",
        "description": "Keep production reliable, fast, and observable at scale.",
        "green": [
            "Linux & Networking Fundamentals",
            "Distributed Systems Reasoning",
            "Observability (Metrics/Logs/Traces)",
            "Incident Response & Postmortems",
            "SLO/SLI/Error Budgets",
            "Capacity Planning & Load Testing",
            "Kubernetes Operations",
            "Chaos Engineering & Resilience",
        ],
        "yellow_seed": ["Service Mesh", "eBPF & Kernel Observability", "Toil Reduction Automation",
                        "Multi-Region Failover", "Database Reliability", "Performance Profiling",
                        "Cost-aware Reliability", "On-call Tooling"],
    },
    "fullstack_developer": {
        "title": "Full-stack Developer",
        "icon": "🧱",
        "description": "Own features end-to-end across frontend, backend, and data.",
        "green": [
            "JavaScript / TypeScript",
            "React or Next.js",
            "Node.js / Python Backend",
            "REST + GraphQL API Design",
            "Databases (SQL + NoSQL)",
            "Authentication & Authorization",
            "Testing (Unit + E2E)",
            "Deployment & CI/CD",
        ],
        "yellow_seed": ["Serverless Functions", "Edge Compute (Cloudflare/Vercel)",
                        "Realtime (WebSockets/SSE)", "Mobile-Responsive Design",
                        "Monorepos & Build Systems", "Caching Strategies", "Observability Basics",
                        "Tailwind & Design Systems"],
    },
    "ios_developer": {
        "title": "iOS Developer",
        "icon": "📱",
        "description": "Ship polished native iOS apps with Swift and SwiftUI.",
        "green": [
            "Swift Language Mastery",
            "SwiftUI & UIKit",
            "iOS App Architecture (MVVM/TCA)",
            "Concurrency (async/await, Combine)",
            "Networking & Persistence",
            "App Store Lifecycle & Distribution",
            "Testing on Apple Platforms",
            "Performance & Memory Profiling",
        ],
        "yellow_seed": ["WidgetKit & Live Activities", "Core Data / SwiftData", "Push & Background Tasks",
                        "Accessibility on iOS", "Animations & Custom Transitions", "ARKit/RealityKit",
                        "App Clips", "CI/CD with Fastlane/Xcode Cloud"],
    },
    "android_developer": {
        "title": "Android Developer",
        "icon": "🤖",
        "description": "Build modern Android apps with Kotlin and Jetpack Compose.",
        "green": [
            "Kotlin Language Mastery",
            "Jetpack Compose",
            "Android Architecture Components",
            "Coroutines & Flow",
            "Room / DataStore Persistence",
            "Networking (Retrofit/Ktor)",
            "Testing & Instrumentation",
            "Material 3 & Theming",
        ],
        "yellow_seed": ["Hilt Dependency Injection", "WorkManager & Background", "App Modularization",
                        "Performance Profiling", "Play Store Release Engineering",
                        "Compose Multiplatform", "Accessibility on Android", "Wear / TV Surfaces"],
    },
    "qa_automation": {
        "title": "QA / Automation Engineer",
        "icon": "🧪",
        "description": "Design test strategies and automation that catch real bugs.",
        "green": [
            "Manual & Exploratory Testing",
            "Test Planning & Strategy",
            "Selenium / Playwright / Cypress",
            "API Testing (Postman/REST Assured)",
            "Mobile Test Automation (Appium)",
            "CI Integration of Test Suites",
            "Performance & Load Testing",
            "Bug Reporting & Triage",
        ],
        "yellow_seed": ["Security Testing Basics", "Contract Testing (Pact)", "Test Data Management",
                        "Chaos & Fault Injection", "Visual Regression", "Accessibility Auditing",
                        "Flaky Test Detection", "AI-Assisted Testing"],
    },
    "security_engineer": {
        "title": "Security Engineer",
        "icon": "🛡️",
        "description": "Threat-model, harden, and respond to security incidents.",
        "green": [
            "Threat Modeling (STRIDE/PASTA)",
            "Application Security (OWASP Top 10)",
            "Authentication & Cryptography",
            "Network Security & TLS",
            "Cloud Security Posture",
            "Incident Response & Forensics",
            "Secure Code Review",
            "Identity & Access Management",
        ],
        "yellow_seed": ["Container & K8s Security", "DevSecOps Pipelines", "Supply Chain Security (SLSA)",
                        "Red Team / Pen Testing", "SIEM & Detection Engineering", "Zero Trust Architecture",
                        "Compliance (SOC2/ISO/PCI)", "AI/LLM Security"],
    },
    "embedded_engineer": {
        "title": "Embedded / Firmware Engineer",
        "icon": "🔌",
        "description": "Build software for constrained hardware and real-time systems.",
        "green": [
            "C / C++ for Embedded",
            "Microcontroller Architecture",
            "RTOS Concepts",
            "Memory & Power Constraints",
            "Peripheral Drivers (UART/SPI/I2C)",
            "Debugging with JTAG/Logic Analyzer",
            "Bootloaders & Firmware Update",
            "Hardware-Software Interfacing",
        ],
        "yellow_seed": ["Embedded Linux", "DSP & Signal Processing", "Wireless Stacks (BLE/Zigbee)",
                        "Safety-Critical Systems", "Edge ML on MCUs", "Functional Safety (ISO 26262)",
                        "Boot ROM & Secure Boot", "Power Profiling"],
    },
    "blockchain_developer": {
        "title": "Blockchain Developer",
        "icon": "⛓️",
        "description": "Build smart contracts and decentralized application backends.",
        "green": [
            "Blockchain Fundamentals",
            "Solidity / EVM Internals",
            "Smart Contract Patterns",
            "Security & Common Exploits",
            "Layer 2 & Rollups",
            "Wallets & Web3 Libraries",
            "Token Standards (ERC-20/721/1155)",
            "Test Frameworks (Hardhat/Foundry)",
        ],
        "yellow_seed": ["zk-SNARKs / zk-Rollups", "Cross-chain Bridges", "DeFi Protocol Design",
                        "Account Abstraction", "MEV Strategies", "Rust + Solana / Move",
                        "Auditing Workflows", "Onchain Analytics"],
    },
    # ─── Management & non-technical / cross-functional ─────────────────────
    "engineering_manager": {
        "title": "Engineering Manager",
        "icon": "👥",
        "description": "Lead engineering teams: people, process, delivery, technical judgment.",
        "green": [
            "People Management & 1:1s",
            "Performance Reviews & Career Frameworks",
            "Hiring & Interviewing",
            "Roadmap & Delivery Planning",
            "Engineering Metrics (DORA)",
            "Cross-functional Stakeholder Mgmt",
            "Technical Decision-making",
            "Coaching & Conflict Resolution",
        ],
        "yellow_seed": ["Org Design & Team Topologies", "Layoffs & Hard Conversations",
                        "Budgeting & Headcount Planning", "Engineering Culture & Values",
                        "Remote Team Leadership", "Mentoring Senior ICs", "Incident Leadership",
                        "Influencing Without Authority"],
    },
    "technical_program_manager": {
        "title": "Technical Program Manager",
        "icon": "🧭",
        "description": "Drive large cross-team technical programs to delivery.",
        "green": [
            "Program & Risk Management",
            "Cross-team Dependency Mapping",
            "Status Reporting & Comms",
            "Roadmap & Milestone Planning",
            "Technical Literacy for TPMs",
            "Stakeholder Alignment",
            "Process Design & Tooling",
            "Launch Readiness & Rollout",
        ],
        "yellow_seed": ["OKRs & Goal Setting", "Vendor & Partner Management", "Compliance & Privacy Programs",
                        "Infrastructure Program Mgmt", "Data Platform Programs", "Incident Programs",
                        "Cost & Capacity Planning", "Internationalization Programs"],
    },
    "product_designer_ux": {
        "title": "Product Designer (UX/UI)",
        "icon": "🎨",
        "description": "Design product experiences from research through pixel-perfect UI.",
        "green": [
            "Design Thinking & Research",
            "Information Architecture",
            "Interaction & Visual Design",
            "Wireframing & Prototyping (Figma)",
            "Design Systems",
            "Usability Testing",
            "Accessibility (WCAG)",
            "Design Critique & Storytelling",
        ],
        "yellow_seed": ["Motion & Microinteractions", "Service Design", "Data Visualization",
                        "Design Ops & Tokens", "Mobile-first Patterns", "Design for AI Surfaces",
                        "Inclusive Design", "Designer-Engineer Collaboration"],
    },
    "business_analyst": {
        "title": "Business Analyst",
        "icon": "📊",
        "description": "Bridge business needs to product/engineering with data and process.",
        "green": [
            "Requirements Gathering",
            "Process Mapping (BPMN)",
            "SQL & Data Analysis",
            "Excel & BI Tools",
            "Stakeholder Interviews",
            "User Stories & Acceptance Criteria",
            "ROI / Cost-Benefit Analysis",
            "Documentation & Communication",
        ],
        "yellow_seed": ["Agile Ceremonies for BAs", "API Documentation Basics",
                        "Visualization (Tableau/Power BI)", "Forecasting Models",
                        "Vendor RFP Process", "Six Sigma Basics", "Change Management",
                        "Business Process Reengineering"],
    },
    "solutions_architect": {
        "title": "Solutions Architect",
        "icon": "🏗️",
        "description": "Design customer-facing technical solutions across cloud & integration.",
        "green": [
            "Solution Design Frameworks",
            "Cloud Service Selection",
            "Integration Patterns",
            "Security & Compliance Mapping",
            "Cost Estimation",
            "Customer Discovery & Workshops",
            "Architecture Diagramming",
            "Migration Strategy",
        ],
        "yellow_seed": ["Data & AI Solutioning", "Multi-Tenant SaaS Patterns", "Industry Verticals",
                        "Pre-sales Storytelling", "RFP & Proposal Writing", "Reference Architectures",
                        "POC Execution", "Customer Success Handoff"],
    },
    "sales_engineer": {
        "title": "Sales Engineer",
        "icon": "🤝",
        "description": "Pre-sales technical specialist running demos, POCs, and deal support.",
        "green": [
            "Discovery & Qualification",
            "Demo Design & Storytelling",
            "Technical Objection Handling",
            "Proof-of-Concept Execution",
            "Product Deep Knowledge",
            "Competitive Positioning",
            "RFP Response Writing",
            "Customer Communication",
        ],
        "yellow_seed": ["Value Engineering & ROI", "Integration & API Demos",
                        "Security Questionnaires", "Industry Vertical Selling",
                        "Champion Building", "Account Strategy", "Renewals & Expansion",
                        "Public Speaking & Webinars"],
    },
    "hr_recruiter": {
        "title": "Tech Recruiter / TA",
        "icon": "🎯",
        "description": "Source, screen, and close technical candidates.",
        "green": [
            "Sourcing Channels & Boolean Search",
            "Candidate Screening & Phone Interviews",
            "Recruiter–Manager Intake Process",
            "ATS Hygiene (Greenhouse/Lever)",
            "Offer Negotiation",
            "Diversity & Inclusion in Hiring",
            "Pipeline Metrics & Reporting",
            "Candidate Experience",
        ],
        "yellow_seed": ["Employer Branding", "Compensation Benchmarking",
                        "Executive Search", "University Recruiting Programs",
                        "Global / Remote Hiring", "Interview Loop Design",
                        "Tech Literacy for Recruiters", "Closing Strategy"],
    },
    "digital_marketing_manager": {
        "title": "Digital Marketing Manager",
        "icon": "📣",
        "description": "Run paid + organic growth across channels with measurable ROI.",
        "green": [
            "Marketing Funnel Strategy",
            "SEO Fundamentals",
            "Paid Acquisition (Google/Meta/LinkedIn)",
            "Email & Lifecycle Marketing",
            "Content Strategy",
            "Analytics (GA4/Mixpanel)",
            "A/B Testing & CRO",
            "Brand Positioning",
        ],
        "yellow_seed": ["Influencer & Partnership Marketing", "Marketing Automation (HubSpot/Marketo)",
                        "Attribution Modeling", "B2B vs B2C Playbooks", "ABM Programs",
                        "Community Marketing", "Generative AI for Marketing", "Localization Strategy"],
    },
}

# ─── Job Role Cards for Onboarding ───────────────────────────────────────────
# `trending: True` surfaces a 🔥 chip on the card (most-hired roles right now).
# `category` lets the onboarding UI render section headers
# ("Engineering / Data / AI / Management / Design / Go-to-market").
ROLE_CARDS = [
    # Engineering — core
    {"id": "software_engineer", "title": "Software Engineer", "icon": "💻", "category": "Engineering",
     "tags": ["DSA", "System Design", "CS Fundamentals"], "color": "#6366f1"},
    {"id": "fullstack_developer", "title": "Full-stack Developer", "icon": "🧱", "category": "Engineering",
     "tags": ["React", "Node", "APIs"], "color": "#6366f1", "trending": True},
    {"id": "frontend_developer", "title": "Frontend Developer", "icon": "🎨", "category": "Engineering",
     "tags": ["React", "JavaScript", "UI/UX"], "color": "#f59e0b"},
    {"id": "backend_developer", "title": "Backend Developer", "icon": "⚙️", "category": "Engineering",
     "tags": ["APIs", "Databases", "System Design"], "color": "#3b82f6"},
    {"id": "ios_developer", "title": "iOS Developer", "icon": "📱", "category": "Engineering",
     "tags": ["Swift", "SwiftUI", "Combine"], "color": "#0ea5e9"},
    {"id": "android_developer", "title": "Android Developer", "icon": "🤖", "category": "Engineering",
     "tags": ["Kotlin", "Compose", "Jetpack"], "color": "#22c55e"},
    {"id": "embedded_engineer", "title": "Embedded / Firmware", "icon": "🔌", "category": "Engineering",
     "tags": ["C/C++", "RTOS", "Drivers"], "color": "#94a3b8"},
    {"id": "blockchain_developer", "title": "Blockchain Developer", "icon": "⛓️", "category": "Engineering",
     "tags": ["Solidity", "EVM", "L2"], "color": "#f97316"},
    # Data + AI
    {"id": "data_scientist", "title": "Data Scientist", "icon": "📊", "category": "Data & AI",
     "tags": ["ML", "Statistics", "Python"], "color": "#10b981"},
    {"id": "ml_engineer", "title": "ML Engineer", "icon": "🤖", "category": "Data & AI",
     "tags": ["Deep Learning", "MLOps", "LLMs"], "color": "#a855f7"},
    {"id": "gen_ai_engineer", "title": "Gen AI Engineer", "icon": "🧬", "category": "Data & AI",
     "tags": ["LLMs", "RAG", "Agents"], "color": "#a855f7", "trending": True},
    {"id": "data_engineer", "title": "Data Engineer", "icon": "🛢️", "category": "Data & AI",
     "tags": ["Spark", "Kafka", "Warehousing"], "color": "#0d9488", "trending": True},
    {"id": "data_analyst", "title": "Data Analyst", "icon": "📈", "category": "Data & AI",
     "tags": ["SQL", "Visualization", "BI"], "color": "#84cc16"},
    # Infra / Cloud / Reliability / Security
    {"id": "devops_engineer", "title": "DevOps / Cloud", "icon": "☁️", "category": "Infra & Reliability",
     "tags": ["Docker", "K8s", "CI/CD"], "color": "#06b6d4"},
    {"id": "cloud_architect", "title": "Cloud Architect", "icon": "🏛️", "category": "Infra & Reliability",
     "tags": ["AWS", "Azure", "GCP"], "color": "#06b6d4", "trending": True},
    {"id": "site_reliability_engineer", "title": "Site Reliability Engineer", "icon": "🛰️", "category": "Infra & Reliability",
     "tags": ["SLOs", "Observability", "Chaos"], "color": "#0891b2", "trending": True},
    {"id": "security_engineer", "title": "Security Engineer", "icon": "🛡️", "category": "Infra & Reliability",
     "tags": ["AppSec", "Threat Modeling", "IAM"], "color": "#ef4444"},
    {"id": "qa_automation", "title": "QA / Automation", "icon": "🧪", "category": "Infra & Reliability",
     "tags": ["Playwright", "Selenium", "API Testing"], "color": "#facc15"},
    # Product, design, management
    {"id": "product_manager", "title": "Product Manager", "icon": "📋", "category": "Product & Management",
     "tags": ["Strategy", "Metrics", "Agile"], "color": "#ec4899"},
    {"id": "technical_program_manager", "title": "Technical PM", "icon": "🧭", "category": "Product & Management",
     "tags": ["Programs", "Risk", "Roadmap"], "color": "#ec4899"},
    {"id": "engineering_manager", "title": "Engineering Manager", "icon": "👥", "category": "Product & Management",
     "tags": ["People", "Delivery", "Hiring"], "color": "#d946ef"},
    {"id": "product_designer_ux", "title": "Product Designer (UX/UI)", "icon": "🎨", "category": "Product & Management",
     "tags": ["Figma", "Research", "Systems"], "color": "#f472b6"},
    {"id": "business_analyst", "title": "Business Analyst", "icon": "📊", "category": "Product & Management",
     "tags": ["SQL", "Process", "Stakeholders"], "color": "#64748b"},
    # Go-to-market / customer facing
    {"id": "solutions_architect", "title": "Solutions Architect", "icon": "🏗️", "category": "Go-to-market",
     "tags": ["Pre-sales", "POC", "Integration"], "color": "#0ea5e9"},
    {"id": "sales_engineer", "title": "Sales Engineer", "icon": "🤝", "category": "Go-to-market",
     "tags": ["Demos", "POCs", "Objection Handling"], "color": "#22d3ee"},
    {"id": "hr_recruiter", "title": "Tech Recruiter", "icon": "🎯", "category": "Go-to-market",
     "tags": ["Sourcing", "ATS", "Offers"], "color": "#fb7185"},
    {"id": "digital_marketing_manager", "title": "Digital Marketing Manager", "icon": "📣", "category": "Go-to-market",
     "tags": ["SEO", "Paid", "Analytics"], "color": "#f59e0b"},
]


def get_standard_path(role_id: str) -> Optional[Dict[str, Any]]:
    """Return the hardcoded standard path for a given role."""
    return STANDARD_PATHS.get(role_id)


def get_role_cards() -> List[Dict[str, Any]]:
    return ROLE_CARDS


def generate_extended_topics(role_id: str, existing_yellow: List[str]) -> List[str]:
    """Use Gemini to generate additional extended/optional topics beyond the seed list."""
    path = STANDARD_PATHS.get(role_id)
    if not path:
        return existing_yellow

    role_title = path["title"]
    all_topics = path["green"] + existing_yellow

    prompt = f"""You are an expert career advisor specializing in interview preparation.

Role: {role_title}

Current topics already covered (do NOT repeat these):
{all_topics}

Generate 8-12 additional advanced or niche topics that would be valuable EXTENDED study topics 
for a {role_title} interview candidate who wants to go beyond the basics.
These should be real, specific, and relevant to modern {role_title} interviews.

Return ONLY a JSON array of strings (topic names):
["Topic 1", "Topic 2", ...]

Each topic should be:
- Specific (not generic like "Advanced Concepts")
- Relevant to current industry practices
- Different from the existing topics listed above
- Appropriate as optional extended learning"""

    raw = _generate(prompt, json_mode=True)
    if raw:
        parsed = _safe_parse_json(raw)
        if isinstance(parsed, list):
            # Filter out any duplicates
            new_topics = [t for t in parsed if isinstance(t, str) and t not in all_topics]
            return existing_yellow + new_topics[:8]

    return existing_yellow


def create_learning_path(db: Session, user: models.User, role_id: str, custom_green: List[str] = None,
                          custom_yellow: List[str] = None) -> models.LearningPath:
    """Create-or-activate a user's learning path for `role_id`.

    If the user already has a path for this role, we simply return it (no
    overwrite — their saved customizations are preserved). Otherwise we create
    a fresh row from the standard template. Supports a single user preparing
    for multiple roles simultaneously.
    """
    path_data = STANDARD_PATHS.get(role_id, {})

    existing = db.query(models.LearningPath).filter(
        models.LearningPath.user_id == user.id,
        models.LearningPath.job_role == role_id,
    ).first()
    if existing:
        return existing

    green = custom_green if custom_green is not None else path_data.get("green", [])
    yellow = custom_yellow if custom_yellow is not None else path_data.get("yellow_seed", [])
    lp = models.LearningPath(
        user_id=user.id,
        job_role=role_id,
        green_topics=green,
        yellow_topics=yellow,
    )
    db.add(lp)
    db.commit()
    db.refresh(lp)
    return lp


def get_user_learning_path(
    db: Session, user_id: int, job_role: Optional[str] = None
) -> Optional[models.LearningPath]:
    """Return one of the user's learning paths.

    - If `job_role` is given, return that specific path.
    - Otherwise return the user's *active* path (matching `User.target_role`),
      falling back to the most-recently-modified path if `target_role` is empty
      or no path matches it (handles legacy data).
    """
    q = db.query(models.LearningPath).filter(models.LearningPath.user_id == user_id)
    if job_role:
        return q.filter(models.LearningPath.job_role == job_role).first()

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user and user.target_role:
        active = q.filter(models.LearningPath.job_role == user.target_role).first()
        if active:
            return active
    return q.order_by(models.LearningPath.last_modified.desc()).first()


def get_user_learning_paths(db: Session, user_id: int) -> List[models.LearningPath]:
    """Return every learning path the user has across all roles."""
    return (
        db.query(models.LearningPath)
        .filter(models.LearningPath.user_id == user_id)
        .order_by(models.LearningPath.created_at.asc())
        .all()
    )


def analyze_resume_for_roles(resume_text: str) -> List[Dict[str, Any]]:
    """Use Gemini to analyze resume and suggest the best-fit roles.

    The role catalog is large now (technical + management + non-technical), so
    we feed the entire ROLE_CARDS list to the model and ask it to rank from
    that universe. Returns top-3 matches; falls back to [] on any failure.
    """
    role_ids = [r["id"] for r in ROLE_CARDS]
    role_lines = "\n".join(f"  - {r['id']}: {r['title']}" for r in ROLE_CARDS)
    prompt = f"""You are a career counselor. Read this resume and identify the top 3 most
suitable job roles from the catalog below. Pick role_ids ONLY from this list:

{role_lines}

Resume text:
{resume_text[:4000]}

For each match provide:
  - confidence (0-100, calibrated — be honest, not generous)
  - 2-3 short reasons grounded in concrete resume facts (avoid generic praise)

Return JSON of this exact shape (top 3 only, ordered by confidence desc):
{{
  "matches": [
    {{ "role_id": "{role_ids[0]}", "confidence": 85,
       "reasons": ["3 yrs Python", "Mentions LeetCode practice", "B.Tech CS"] }}
  ]
}}"""

    raw = _generate(prompt, json_mode=True)
    if raw:
        result = _safe_parse_json(raw)
        if isinstance(result, dict) and "matches" in result:
            matches = result["matches"]
            # Drop anything not in our catalog (Gemini occasionally hallucinates a role id).
            valid = [m for m in matches if isinstance(m, dict) and m.get("role_id") in role_ids]
            return valid[:3]

    return []


def score_resume_against_role(resume_text: str, role_id: str) -> Dict[str, Any]:
    """Score how well a specific resume matches a single target role.

    Used during onboarding when the user has already picked a role and uploads
    a resume — we surface "Your resume fits {role} at NN%" right above the
    top-3 suggestions. Returns:

        {
          "role_id": ...,
          "role_title": ...,
          "percent": 0..100,
          "summary": "1-2 sentence assessment",
          "matched_skills": ["...", "..."],
          "gaps": ["missing/weak topic 1", "..."],
        }

    On LLM failure, returns a neutral 50% with empty arrays so the UI can
    still render — never crashes the onboarding flow.
    """
    path = STANDARD_PATHS.get(role_id)
    role_title = (path or {}).get("title", role_id.replace("_", " ").title())
    must_know = (path or {}).get("green", [])
    stretch = (path or {}).get("yellow_seed", [])
    fallback = {
        "role_id": role_id,
        "role_title": role_title,
        "percent": 50,
        "summary": "Could not analyse resume right now. Showing a neutral match.",
        "matched_skills": [],
        "gaps": [],
    }
    if not resume_text or len(resume_text.strip()) < 50:
        return fallback

    prompt = f"""You are evaluating how well a candidate's resume matches a target job role.

Target role: {role_title}
Must-know topics for this role: {must_know}
Stretch topics for this role: {stretch}

Resume text:
{resume_text[:4000]}

Score from 0 to 100 — be calibrated, not flattering. A junior candidate with
matching background should score ~60-75; a senior who exactly fits should be
85-95; weak/off-target resumes should be under 40.

Return JSON of this exact shape:
{{
  "percent": <int 0-100>,
  "summary": "1-2 sentence honest assessment",
  "matched_skills": ["concrete skill from resume that aligns", "..."],
  "gaps": ["important topic for this role NOT evidenced in the resume", "..."]
}}
Cap matched_skills at 6 and gaps at 5."""

    raw = _generate(prompt, json_mode=True)
    if not raw:
        return fallback
    parsed = _safe_parse_json(raw)
    if not isinstance(parsed, dict):
        return fallback
    try:
        pct = int(parsed.get("percent", 50))
    except (TypeError, ValueError):
        pct = 50
    pct = max(0, min(100, pct))
    return {
        "role_id": role_id,
        "role_title": role_title,
        "percent": pct,
        "summary": str(parsed.get("summary", "")).strip(),
        "matched_skills": [s for s in (parsed.get("matched_skills") or []) if isinstance(s, str)][:6],
        "gaps": [g for g in (parsed.get("gaps") or []) if isinstance(g, str)][:5],
    }


# ─── Custom (JD-driven) role registry ──────────────────────────────────────
# A user can create a role from a JD upload. We keep these in-process so other
# helpers that read STANDARD_PATHS keep working for custom roles too.
def register_custom_role(role_id: str, title: str, green: List[str], yellow: List[str], description: str = "") -> None:
    """Add a custom (JD-derived) role to the in-memory path table so downstream
    code that does ``STANDARD_PATHS.get(role_id)`` keeps functioning.

    The persistent record lives in ``LearningPath`` (with ``source="jd"``);
    this just makes sure the runtime lookup works.
    """
    if not role_id or role_id in STANDARD_PATHS:
        return
    STANDARD_PATHS[role_id] = {
        "title": title or role_id.replace("_", " ").title(),
        "icon": "📄",
        "description": description or "Custom role created from an uploaded job description.",
        "green": list(green or []),
        "yellow_seed": list(yellow or []),
        "custom": True,
    }
