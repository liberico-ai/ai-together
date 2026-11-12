"""Narrow dashboard transport. AI OS remains the identity/data authority.

Installed in the default dashboard profile because Hermes deliberately strips
cookies from secondary-profile plugin IPC. Never weaken that Hermes boundary.
No secret files, arbitrary URL proxy, bridge endpoint or business mutations.
"""
import re
from http.cookies import SimpleCookie
from pathlib import Path

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response

router = APIRouter()
ORIGIN = "https://hermes.btnet.vn"
HOST = "hermes.btnet.vn"
EXPECTED_HOME = Path("/home/iptech/.hermes").resolve()
BACKEND = "http://127.0.0.1:3148"
COOKIE = "libetech_session"
COOKIE_PATH = "/api/plugins/libetech-ai-os-web/"
ROUTES = {
    ("GET", "health"): "/api/health",
    ("GET", "me"): "/api/auth/me",
    ("GET", "workspace"): "/api/v1/workspace",
    ("POST", "login"): "/api/auth/login",
    ("POST", "logout"): "/api/auth/logout",
    ("POST", "telegram-code"): "/api/auth/telegram-code",
}

def error(code, status):
    return JSONResponse({"data": None, "error": {"code": code, "message": code}},
                        status_code=status, headers={"Cache-Control": "no-store"})

def admitted(request):
    from hermes_constants import get_hermes_home
    from hermes_cli.web_server import _require_token
    _require_token(request)
    return get_hermes_home().resolve() == EXPECTED_HOME

def session_header(raw):
    # Pass only the AI OS cookie. Never pass Hermes credentials to the backend.
    matches = re.findall(r"(?:^|;\s*)libetech_session=([A-Za-z0-9_-]{43})(?=;|$)", raw)
    return f"{COOKIE}={matches[0]}" if len(matches) == 1 else ""

def scoped_cookie(raw):
    jar = SimpleCookie()
    jar.load(raw)
    value = jar[COOKIE].value if COOKIE in jar else None
    if value is None or (value and not re.fullmatch(r"[A-Za-z0-9_-]{43}", value)):
        raise ValueError("Unexpected backend cookie")
    return (f"{COOKIE}={value}; Path={COOKIE_PATH}; HttpOnly; Secure; SameSite=Strict; "
            f"Max-Age={28800 if value else 0}")

@router.api_route("/{action}", methods=["GET", "POST"])
async def relay(action: str, request: Request):
    if not admitted(request):
        return error("PROFILE_DENIED", 403)
    path = ROUTES.get((request.method, action))
    if not path:
        return error("ROUTE_DENIED", 404)
    if any(k != "profile" or v != "default" for k, v in request.query_params.multi_items()):
        return error("QUERY_DENIED", 403)
    if request.headers.get("host") != HOST:
        return error("HOST_DENIED", 403)
    if request.headers.get("sec-fetch-site") == "cross-site":
        return error("ORIGIN_DENIED", 403)
    if request.method == "POST" and request.headers.get("origin") != ORIGIN:
        return error("ORIGIN_DENIED", 403)
    if request.method == "POST" and request.headers.get("content-type", "").split(";")[0] != "application/json":
        return error("CONTENT_TYPE_DENIED", 415)
    data = bytearray()
    async for chunk in request.stream():
        data.extend(chunk)
        if len(data) > 8192:
            return error("PAYLOAD_TOO_LARGE", 413)
    headers = {"Host": HOST, "Accept": "application/json", "Content-Type": "application/json"}
    if request.method == "POST":
        headers["Origin"] = request.headers["origin"]  # validated browser origin, never invented
    cookie = session_header(request.headers.get("cookie", ""))
    if cookie:
        headers["Cookie"] = cookie
    try:
        async with httpx.AsyncClient(timeout=6, trust_env=False, follow_redirects=False) as client:
            response = await client.request(request.method, BACKEND + path, headers=headers, content=bytes(data))
        if 300 <= response.status_code < 400 or len(response.content) > 1048576:
            return error("BACKEND_RESPONSE_DENIED", 502)
        if not response.headers.get("content-type", "").startswith("application/json"):
            return error("BACKEND_RESPONSE_DENIED", 502)
        result = Response(response.content, response.status_code, media_type="application/json",
                          headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"})
        if action in {"login", "logout"} and "set-cookie" in response.headers:
            result.headers["Set-Cookie"] = scoped_cookie(response.headers["set-cookie"])
        return result
    except (httpx.HTTPError, ValueError):
        # Do not log request bodies, cookies, passwords or pairing codes.
        return error("BACKEND_UNAVAILABLE", 502)
