"""Email sending utility using SMTP (AWS SES or any SMTP provider)."""

import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.config import SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, MAIL_FROM

logger = logging.getLogger("uvicorn.error")

_TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates" / "emails"
_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATE_DIR)),
    autoescape=select_autoescape(["html"]),
)


def render_email(name: str, **context) -> tuple[str, str]:
    """Render an email template by name. Returns (html_body, text_body)."""
    html = _env.get_template(f"{name}.html").render(**context)
    text = _env.get_template(f"{name}.txt").render(**context)
    return html, text


def send_email(to: str, subject: str, html_body: str, text_body: str | None = None) -> None:
    """Send an email. Logs a warning and skips if SMTP is not configured."""
    if not SMTP_HOST or not MAIL_FROM:
        logger.warning("SMTP not configured — skipping email to %s: %s", to, subject)
        return

    msg = MIMEMultipart("alternative")
    msg["From"] = MAIL_FROM
    msg["To"] = to
    msg["Subject"] = subject
    if text_body:
        msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(MAIL_FROM, to, msg.as_string())

    logger.info("Email sent to %s: %s", to, subject)
