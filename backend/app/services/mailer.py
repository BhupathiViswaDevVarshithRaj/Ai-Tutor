import asyncio
import logging
import smtplib
from email.message import EmailMessage
from typing import Protocol

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class Mailer(Protocol):
    async def send(self, to: str, subject: str, body: str) -> None: ...


class ConsoleMailer:
    """Development mailer: writes the email to the log instead of sending it."""

    async def send(self, to: str, subject: str, body: str) -> None:
        logger.info("EMAIL (console mailer, not sent) to=%s subject=%r\n%s", to, subject, body)


class SMTPMailer:
    def __init__(self, host: str, port: int, user: str, password: str, sender: str) -> None:
        self.host, self.port, self.user, self.password, self.sender = (
            host,
            port,
            user,
            password,
            sender,
        )

    def _send_sync(self, message: EmailMessage) -> None:
        with smtplib.SMTP(self.host, self.port, timeout=15) as smtp:
            smtp.starttls()
            if self.user:
                smtp.login(self.user, self.password)
            smtp.send_message(message)

    async def send(self, to: str, subject: str, body: str) -> None:
        message = EmailMessage()
        message["From"] = self.sender
        message["To"] = to
        message["Subject"] = subject
        message.set_content(body)
        await asyncio.to_thread(self._send_sync, message)


def get_mailer() -> Mailer:
    s = get_settings()
    if s.smtp_host:
        return SMTPMailer(s.smtp_host, s.smtp_port, s.smtp_user, s.smtp_password, s.smtp_from)
    return ConsoleMailer()
