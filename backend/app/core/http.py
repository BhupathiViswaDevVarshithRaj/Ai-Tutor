"""HTTP hardening as pure ASGI middleware (safe with streamed SSE replies and file responses)."""

import json

from starlette.types import ASGIApp, Message, Receive, Scope, Send

# The interactive docs load Swagger UI / ReDoc scripts, so they can't use the API's strict CSP.
DOCS_PATHS = ("/docs", "/redoc", "/openapi.json")

BASE_HEADERS = {
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer",
    "cross-origin-resource-policy": "same-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
}
# The API returns JSON, audio and video only: nothing in it should run, load or be framed.
API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
HSTS = "max-age=31536000; includeSubDomains"


class SecurityHeadersMiddleware:
    """Adds browser security headers, and `Cache-Control: no-store` unless a route set its own
    (API responses hold personal data and shouldn't sit in shared or browser caches)."""

    def __init__(self, app: ASGIApp, *, hsts: bool) -> None:
        self.app = app
        self.hsts = hsts

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        is_docs = scope["path"].endswith(DOCS_PATHS)

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                present = {name.lower() for name, _ in headers}
                extra = dict(BASE_HEADERS)
                if not is_docs:
                    extra["content-security-policy"] = API_CSP
                if self.hsts:
                    extra["strict-transport-security"] = HSTS
                extra.setdefault("cache-control", "no-store")
                headers += [
                    (name.encode(), value.encode())
                    for name, value in extra.items()
                    if name.encode() not in present
                ]
                message = {**message, "headers": headers}
            await send(message)

        await self.app(scope, receive, send_with_headers)


class BodySizeLimitMiddleware:
    """Rejects request bodies over `max_bytes` with 413, whether or not Content-Length is sent.

    Paths in `exempt` enforce their own (larger) limit while streaming, e.g. audio uploads.
    """

    def __init__(self, app: ASGIApp, *, max_bytes: int, exempt: tuple[str, ...] = ()) -> None:
        self.app = app
        self.max_bytes = max_bytes
        self.exempt = exempt

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope["path"].startswith(self.exempt):
            await self.app(scope, receive, send)
            return
        declared = dict(scope["headers"]).get(b"content-length")
        if declared and declared.isdigit() and int(declared) > self.max_bytes:
            await self._reject(send)
            return

        received = 0
        started = rejected = False

        async def counting_receive() -> Message:
            # Over the limit: answer 413 ourselves, then tell the app the client went away
            # (FastAPI turns exceptions raised while reading the body into a 400).
            nonlocal received, rejected
            message = await receive()
            if message["type"] == "http.request" and not rejected:
                received += len(message.get("body", b""))
                if received > self.max_bytes and not started:
                    rejected = True
                    await self._reject(send)
            return {"type": "http.disconnect"} if rejected else message

        async def guarded_send(message: Message) -> None:
            nonlocal started
            if rejected:
                return  # the 413 has already been sent
            started = started or message["type"] == "http.response.start"
            await send(message)

        await self.app(scope, counting_receive, guarded_send)

    async def _reject(self, send: Send) -> None:
        limit_mb = self.max_bytes / 1_048_576
        body = json.dumps(
            {"detail": f"Request is larger than {limit_mb:g} MB.", "code": "request_too_large"}
        ).encode()
        await send(
            {
                "type": "http.response.start",
                "status": 413,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(body)).encode()),
                ],
            }
        )
        await send({"type": "http.response.body", "body": body})
