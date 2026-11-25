"""Kunlik svodka (spravka) uchun A4 PDF generatori."""
from __future__ import annotations
import os
from datetime import datetime, timedelta
from typing import List, Tuple

from fpdf import FPDF

FONT_CANDIDATES: List[Tuple[str, str]] = [
    ("C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/arialbd.ttf"),
    ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    ("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"),
]


def _setup_font(pdf: FPDF) -> Tuple[str, bool]:
    for reg, bold in FONT_CANDIDATES:
        if os.path.exists(reg):
            pdf.add_font("UniFont", "", reg, uni=True)
            pdf.add_font("UniFont", "B", bold if os.path.exists(bold) else reg, uni=True)
            return "UniFont", True
    return "Helvetica", False


def _safe(text: str, unicode_ok: bool) -> str:
    if unicode_ok:
        return text
    return text.encode("latin-1", "replace").decode("latin-1")


def _parse_iso(val) -> str:
    if not val:
        return "—"
    if isinstance(val, str):
        try:
            val = datetime.fromisoformat(val.replace("Z", "+00:00")).replace(tzinfo=None)
        except ValueError:
            return val[:16]
    return (val + timedelta(hours=5)).strftime("%d.%m.%Y %H:%M")


def build_daily_svodka_pdf(uz_now: datetime, pc: dict, pms: dict, head: dict, active_tasks: int, overdue_units: int) -> bytes:
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()
    font, uni = _setup_font(pdf)

    # Sarlavha
    pdf.set_font(font, "B", 15)
    pdf.cell(0, 9, _safe(f"Kunlik svodka (Spravka) — {uz_now.strftime('%d.%m.%Y')}", uni), ln=True)
    pdf.set_font(font, "", 10)
    pdf.set_text_color(90, 90, 90)
    pdf.cell(0, 6, _safe(f"Shakllantirilgan vaqt: {uz_now.strftime('%d.%m.%Y %H:%M')} (Toshkent)", uni), ln=True)
    pdf.ln(3)

    # Umumiy ko'rsatkichlar
    pdf.set_text_color(20, 20, 20)
    pdf.set_font(font, "B", 10.5)
    summary = (
        f"ПЧ: {pc['submitted']}/{pc['total']}  |  "
        f"ПМС/ОПМС: {pms['submitted']}/{pms['total']}  |  "
        f"Bo'limlar: {head['submitted']}/{head['total']}  |  "
        f"Faol telegrammalar: {active_tasks} (kechikkan: {overdue_units})"
    )
    pdf.cell(0, 7, _safe(summary, uni), ln=True)
    pdf.ln(3)

    def draw_group(title: str, g: dict) -> None:
        pdf.set_font(font, "B", 12)
        pdf.set_text_color(25, 65, 130)
        pdf.cell(0, 8, _safe(f"{title} ({g['submitted']}/{g['total']} topshirdi)", uni), ln=True)

        # Jadval sarlavhasi
        pdf.set_font(font, "B", 9.5)
        pdf.set_fill_color(235, 240, 248)
        pdf.set_text_color(20, 20, 20)
        widths = [12, 72, 36, 20, 50]
        headers = ["№", "Bo'linma", "Holat", "Soni", "Oxirgi vaqt"]
        for w, h in zip(widths, headers):
            pdf.cell(w, 7, _safe(h, uni), border=1, fill=True, align="C" if w != 72 else "L")
        pdf.ln()

        pdf.set_font(font, "", 9.5)
        for idx, r in enumerate(g["rows"], 1):
            ok = r["has_submitted"]
            pdf.set_text_color(20, 120, 50) if ok else pdf.set_text_color(180, 60, 20)
            status_txt = "Topshirdi" if ok else "Topshirmadi"
            pdf.set_text_color(20, 20, 20)
            pdf.cell(widths[0], 6.5, str(idx), border=1, align="C")
            pdf.cell(widths[1], 6.5, _safe(str(r["department_name"])[:36], uni), border=1)
            pdf.set_text_color(20, 120, 50) if ok else pdf.set_text_color(180, 60, 20)
            pdf.cell(widths[2], 6.5, _safe(status_txt, uni), border=1, align="C")
            pdf.set_text_color(20, 20, 20)
            pdf.cell(widths[3], 6.5, f"{r['record_count']} ta", border=1, align="C")
            pdf.cell(widths[4], 6.5, _safe(_parse_iso(r.get("last_at")), uni), border=1, align="C")
            pdf.ln()
        pdf.ln(4)

    draw_group("ПЧ bo'linmalari", pc)
    draw_group("ПМС / ОПМС bo'linmalari", pms)
    draw_group("Bosh bo'limlar (Фойдаланиш, Капитал, ...)", head)
    return bytes(pdf.output())

