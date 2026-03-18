"""Email sending utility using SMTP (AWS SES or any SMTP provider)."""

import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.config import SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, MAIL_FROM

logger = logging.getLogger("uvicorn.error")


def send_email(to: str, subject: str, html_body: str) -> None:
    """Send an email. Logs a warning and skips if SMTP is not configured."""
    if not SMTP_HOST or not MAIL_FROM:
        logger.warning("SMTP not configured — skipping email to %s: %s", to, subject)
        return

    msg = MIMEMultipart("alternative")
    msg["From"] = MAIL_FROM
    msg["To"] = to
    msg["Subject"] = subject
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(MAIL_FROM, to, msg.as_string())

    logger.info("Email sent to %s: %s", to, subject)
