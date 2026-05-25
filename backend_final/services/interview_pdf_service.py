"""
InterviewVault — Interview Report PDF Renderer
═══════════════════════════════════════════════════════════════════════════════

Renders a multi-page styled PDF of an InterviewSession.report using ReportLab.
The output mirrors the in-app /interviews/:id report — score header, category
scores, strengths/gaps, the new action plan (Item 4), communication analysis,
and a transcript appendix.

Used by ``GET /api/interviews/sessions/{id}/report.pdf``.
"""
from __future__ import annotations

import io
from datetime import datetime
from typing import Any, Dict, List

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


# ─── Color palette (matches the in-app dark UI distilled for print) ────────────
INDIGO = colors.HexColor("#6366f1")
PURPLE = colors.HexColor("#a855f7")
EMERALD = colors.HexColor("#10b981")
AMBER = colors.HexColor("#f59e0b")
SLATE = colors.HexColor("#475569")
DARK = colors.HexColor("#0f172a")
MUTED = colors.HexColor("#64748b")
LIGHT_GRAY = colors.HexColor("#f1f5f9")


def _styles():
    base = getSampleStyleSheet()
    return {
        "Title": ParagraphStyle(
            "Title", parent=base["Title"],
            fontName="Helvetica-Bold", fontSize=22, leading=26,
            textColor=DARK, spaceAfter=4,
        ),
        "Subtitle": ParagraphStyle(
            "Subtitle", parent=base["Normal"],
            fontName="Helvetica", fontSize=11, leading=14,
            textColor=MUTED, spaceAfter=14,
        ),
        "H1": ParagraphStyle(
            "H1", parent=base["Heading2"],
            fontName="Helvetica-Bold", fontSize=14, leading=18,
            textColor=INDIGO, spaceBefore=12, spaceAfter=6,
        ),
        "H2": ParagraphStyle(
            "H2", parent=base["Heading3"],
            fontName="Helvetica-Bold", fontSize=11, leading=14,
            textColor=DARK, spaceBefore=8, spaceAfter=4,
        ),
        "Body": ParagraphStyle(
            "Body", parent=base["Normal"],
            fontName="Helvetica", fontSize=10, leading=14,
            textColor=DARK, spaceAfter=4, alignment=TA_LEFT,
        ),
        "BodyMuted": ParagraphStyle(
            "BodyMuted", parent=base["Normal"],
            fontName="Helvetica", fontSize=10, leading=14, textColor=MUTED,
        ),
        "Bullet": ParagraphStyle(
            "Bullet", parent=base["Normal"],
            fontName="Helvetica", fontSize=10, leading=14,
            textColor=DARK, leftIndent=14, bulletIndent=4, spaceAfter=2,
        ),
        "Footer": ParagraphStyle(
            "Footer", parent=base["Normal"],
            fontName="Helvetica-Oblique", fontSize=8, leading=10, textColor=MUTED,
        ),
        "TranscriptQ": ParagraphStyle(
            "TranscriptQ", parent=base["Normal"],
            fontName="Helvetica-Bold", fontSize=9.5, leading=13,
            textColor=INDIGO, spaceBefore=6, spaceAfter=2,
        ),
        "TranscriptA": ParagraphStyle(
            "TranscriptA", parent=base["Normal"],
            fontName="Helvetica", fontSize=9.5, leading=13,
            textColor=DARK, leftIndent=12, spaceAfter=4,
        ),
    }


def _verdict_color(verdict: str) -> colors.Color:
    return {
        "Strong Hire": EMERALD,
        "Hire": colors.HexColor("#06b6d4"),
        "Lean Hire": AMBER,
        "Lean No Hire": colors.HexColor("#f97316"),
        "No Hire": colors.HexColor("#ef4444"),
    }.get(verdict or "", INDIGO)


def _priority_color(p: str) -> colors.Color:
    return {"high": colors.HexColor("#ef4444"), "medium": AMBER, "low": EMERALD}.get(
        (p or "medium").lower(), AMBER
    )


def _safe(value: Any) -> str:
    if value is None:
        return ""
    text = str(value)
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def _header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica-Bold", 10)
    canvas.setFillColor(INDIGO)
    canvas.drawString(0.6 * inch, 10.4 * inch, "InterviewVault")
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawRightString(7.9 * inch, 10.4 * inch, "Interview Report")
    canvas.setStrokeColor(LIGHT_GRAY)
    canvas.setLineWidth(0.4)
    canvas.line(0.6 * inch, 10.32 * inch, 7.9 * inch, 10.32 * inch)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawCentredString(4.25 * inch, 0.4 * inch, f"Page {doc.page}")
    canvas.restoreState()


def _score_block(report: Dict[str, Any], session_meta: Dict[str, Any], st: Dict[str, ParagraphStyle]) -> List:
    overall = report.get("overall_score")
    verdict = report.get("verdict") or "—"
    overall_text = f"{round(float(overall))}" if overall is not None else "—"
    vc = _verdict_color(verdict)

    score_para = Paragraph(
        f'<font size="40"><b>{overall_text}</b></font><font size="14" color="#64748b">/100</font>',
        st["Body"],
    )
    verdict_para = Paragraph(
        f'<font color="{vc.hexval()}" size="14"><b>{_safe(verdict)}</b></font><br/>'
        f'<font color="#64748b" size="9">verdict</font>',
        st["Body"],
    )
    meta_lines = [
        f'<b>Role:</b> {_safe(session_meta.get("job_role") or "—")}',
        f'<b>Mode:</b> {_safe(session_meta.get("mode") or "—")}',
        f'<b>Topics:</b> {_safe(", ".join((report.get("topics_covered") or [])[:6]) or "—")}',
        f'<b>Date:</b> {_safe(session_meta.get("created_at") or "—")}',
    ]
    meta_para = Paragraph("<br/>".join(meta_lines), st["Body"])

    tbl = Table(
        [[score_para, verdict_para, meta_para]],
        colWidths=[1.6 * inch, 1.4 * inch, 4.3 * inch],
    )
    tbl.setStyle(
        TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("BOX", (0, 0), (-1, -1), 0.5, LIGHT_GRAY),
            ("LEFTPADDING", (0, 0), (-1, -1), 12),
            ("RIGHTPADDING", (0, 0), (-1, -1), 12),
            ("TOPPADDING", (0, 0), (-1, -1), 12),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ])
    )
    return [tbl, Spacer(1, 0.18 * inch)]


def _category_table(category_scores: Dict[str, float], st: Dict[str, ParagraphStyle]) -> List:
    if not category_scores:
        return []
    rows = [["Topic", "Score"]]
    for k, v in category_scores.items():
        try:
            score = round(float(v))
        except (TypeError, ValueError):
            score = "—"
        rows.append([str(k).replace("_", " ").title(), str(score)])
    tbl = Table(rows, colWidths=[4.5 * inch, 1.0 * inch], hAlign="LEFT")
    tbl.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), INDIGO),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9.5),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ("LINEBELOW", (0, 0), (-1, 0), 0.6, INDIGO),
        ])
    )
    return [Paragraph("Category scores", st["H1"]), tbl, Spacer(1, 0.18 * inch)]


def _bullet_list(items: List[str], st: Dict[str, ParagraphStyle], muted: bool = False) -> List:
    style = st["BodyMuted"] if muted else st["Bullet"]
    out = []
    for i in items:
        out.append(Paragraph(f"• {_safe(i)}", style))
    return out


def _improvements_table(rows: List[Dict[str, str]], st: Dict[str, ParagraphStyle]) -> List:
    if not rows:
        return [Paragraph("No specific improvements flagged.", st["BodyMuted"])]
    body = [["Priority", "Area", "Concrete action"]]
    cell_styles = TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), DARK),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
    ])
    for r in rows:
        prio = (r.get("priority") or "medium").lower()
        pc = _priority_color(prio)
        body.append([
            Paragraph(
                f'<font color="{pc.hexval()}"><b>{prio.upper()}</b></font>', st["Body"]
            ),
            Paragraph(_safe(r.get("area") or "—"), st["Body"]),
            Paragraph(_safe(r.get("concrete_step") or "—"), st["Body"]),
        ])
    tbl = Table(body, colWidths=[0.85 * inch, 1.6 * inch, 4.55 * inch], hAlign="LEFT")
    tbl.setStyle(cell_styles)
    return [tbl, Spacer(1, 0.12 * inch)]


def _transcript_section(transcript: List[Dict[str, Any]], st: Dict[str, ParagraphStyle]) -> List:
    if not transcript:
        return []
    elements = [Paragraph("Transcript (appendix)", st["H1"])]
    for t in transcript[:80]:  # safety cap
        role = (t.get("role") or "").lower()
        content = _safe(t.get("content") or "")
        if not content:
            continue
        if role == "interviewer":
            elements.append(Paragraph(f"Q. {content}", st["TranscriptQ"]))
        elif role in ("candidate", "user", "student"):
            elements.append(Paragraph(content, st["TranscriptA"]))
    return elements


def build_interview_report_pdf(session) -> bytes:
    """Serialise an InterviewSession model into PDF bytes."""
    report = session.report or {}
    transcript = session.transcript or []
    action = report.get("action_plan") or {}
    communication = report.get("communication") or {}
    st = _styles()

    buf = io.BytesIO()
    doc = BaseDocTemplate(
        buf,
        pagesize=LETTER,
        leftMargin=0.6 * inch,
        rightMargin=0.6 * inch,
        topMargin=0.85 * inch,
        bottomMargin=0.6 * inch,
        title=f"InterviewVault report #{session.id}",
        author="InterviewVault",
    )
    frame = Frame(
        doc.leftMargin, doc.bottomMargin,
        doc.width, doc.height,
        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
    )
    doc.addPageTemplates(PageTemplate(id="main", frames=[frame], onPage=_header_footer))

    flow: List = []

    # Header
    flow.append(Paragraph(f"Interview Report #{session.id}", st["Title"]))
    flow.append(Paragraph(
        f"Generated {datetime.utcnow().strftime('%d %b %Y · %H:%M UTC')} for candidate prep review.",
        st["Subtitle"],
    ))

    # Score block
    session_meta = {
        "job_role": session.job_role,
        "mode": session.mode,
        "created_at": session.created_at.strftime("%d %b %Y · %H:%M") if session.created_at else "",
    }
    flow.extend(_score_block(report, session_meta, st))

    # Detailed feedback
    detailed = report.get("detailed_feedback") or ""
    if detailed:
        flow.append(Paragraph("Interviewer feedback", st["H1"]))
        flow.append(Paragraph(_safe(detailed), st["Body"]))
        flow.append(Spacer(1, 0.1 * inch))

    # Category scores
    flow.extend(_category_table(report.get("category_scores") or {}, st))

    # Strengths / gaps
    flow.append(Paragraph("Strengths", st["H1"]))
    flow.extend(_bullet_list(report.get("strengths") or ["No standout strengths recorded."], st))

    flow.append(Paragraph("Areas to improve", st["H1"]))
    flow.extend(_bullet_list(report.get("weaknesses") or ["No specific weaknesses recorded."], st))

    # ── Action Plan (Item 4) ──────────────────────────────────────────────
    if action:
        flow.append(PageBreak())
        flow.append(Paragraph("Action plan", st["Title"]))
        flow.append(Paragraph(
            "An action-oriented brief tying the interviewer's expectations to your delivery, "
            "with prescriptive next steps.", st["Subtitle"],
        ))

        if action.get("what_interviewer_expected"):
            flow.append(Paragraph("What was expected", st["H1"]))
            flow.extend(_bullet_list(action["what_interviewer_expected"], st))
        if action.get("what_you_delivered"):
            flow.append(Paragraph("What you delivered", st["H1"]))
            flow.extend(_bullet_list(action["what_you_delivered"], st))

        if action.get("technical_improvements"):
            flow.append(Paragraph("Technical improvements", st["H1"]))
            flow.extend(_improvements_table(action["technical_improvements"], st))

        if action.get("non_technical_improvements"):
            flow.append(Paragraph("Non-technical improvements", st["H1"]))
            flow.extend(_improvements_table(action["non_technical_improvements"], st))

        if action.get("next_7_day_plan"):
            flow.append(Paragraph("Your next 7 days", st["H1"]))
            for line in action["next_7_day_plan"]:
                flow.append(Paragraph(f"• {_safe(line)}", st["Bullet"]))

        if action.get("recommended_resources"):
            flow.append(Paragraph("Recommended resources", st["H1"]))
            for r in action["recommended_resources"]:
                title = _safe(r.get("title") or "")
                kind = _safe(r.get("kind") or "")
                url = r.get("url")
                if url:
                    body = f'• <link href="{_safe(url)}" color="{INDIGO.hexval()}">{title}</link> <font color="#64748b">({kind})</font>'
                else:
                    body = f'• {title} <font color="#64748b">({kind})</font>'
                flow.append(Paragraph(body, st["Bullet"]))

    # ── Communication & presence ──────────────────────────────────────────
    if communication:
        flow.append(PageBreak())
        flow.append(Paragraph("Communication & presence", st["Title"]))
        comm_lines = []
        if communication.get("speaking_pace_wpm"):
            comm_lines.append(f"<b>Pace:</b> {communication['speaking_pace_wpm']} wpm")
        if communication.get("word_count"):
            comm_lines.append(f"<b>Words spoken:</b> {communication['word_count']}")
        if communication.get("filler_word_total") is not None:
            comm_lines.append(f"<b>Filler words:</b> {communication['filler_word_total']}")
        if communication.get("eye_contact_pct") is not None:
            comm_lines.append(f"<b>Eye-contact:</b> {communication['eye_contact_pct']}%")
        if comm_lines:
            flow.append(Paragraph(" &nbsp;·&nbsp; ".join(comm_lines), st["Body"]))
            flow.append(Spacer(1, 0.1 * inch))
        language = communication.get("language") or {}
        if language.get("summary"):
            flow.append(Paragraph("Language quality", st["H2"]))
            flow.append(Paragraph(_safe(language["summary"]), st["Body"]))
        if language.get("best_moment"):
            flow.append(Paragraph(f"<b>Best moment:</b> {_safe(language['best_moment'])}", st["BodyMuted"]))
        if language.get("weakest_moment"):
            flow.append(Paragraph(f"<b>Watch out:</b> {_safe(language['weakest_moment'])}", st["BodyMuted"]))

    # Transcript appendix
    flow.append(PageBreak())
    flow.extend(_transcript_section(transcript, st))

    doc.build(flow)
    return buf.getvalue()
