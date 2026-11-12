"""Transport-only adapter. The AI OS backend owns identity and project authorization."""
from __future__ import annotations
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import secrets
import stat
import time
import urllib.error
import urllib.request

VERSION = "0.3.0"
EXPECTED_HOME = Path("/home/iptech/.hermes/profiles/libetech")
ENDPOINT = "http://127.0.0.1:3148/api/bridge"
POSITIVE = re.compile(r"[1-9][0-9]{0,19}\Z")
APPROVAL_ID = re.compile(r"[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\Z")
APPROVAL_ROLES = {"viewer": "Chỉ đọc", "engineer": "Thực hiện", "manager": "Điều phối",
                  "technical": "Nghiệm thu kỹ thuật", "business": "Nghiệm thu nghiệp vụ"}
REPORT_PERMISSIONS = {"people_read": "Xem điểm nhân sự", "quality_review": "Đánh giá phản hồi",
                      "report_approve": "Chốt kết quả"}

def validated_context(values):
    if (values.get("platform") != "telegram" or values.get("profile") != "libetech"
        or not POSITIVE.fullmatch(values.get("user_id", ""))
        or not POSITIVE.fullmatch(values.get("message_id", ""))):
        raise ValueError("BOUND_TELEGRAM_REQUIRED")
    chat, kind, actor = values.get("chat_id", ""), values.get("chat_type", ""), values["user_id"]
    if not ((kind in {"private", "dm"} and chat == actor)
            or (kind in {"group", "supergroup"} and re.fullmatch(r"-[1-9][0-9]{0,19}", chat))):
        raise ValueError("CHAT_IDENTITY_MISMATCH")
    return {"telegramId": actor, "chatId": chat, "chatType": kind,
            "profile": "libetech", "messageId": values["message_id"]}

def tool_context():
    # No process-environment fallback: concurrent profiles must never share an actor.
    from gateway import session_context
    result = {}
    for name in ("PLATFORM", "PROFILE", "USER_ID", "CHAT_ID", "CHAT_TYPE", "MESSAGE_ID", "ID", "KEY"):
        variable = session_context._VAR_MAP.get("HERMES_SESSION_" + name)
        value = variable.get() if variable else session_context._UNSET
        result[name.lower()] = "" if value is session_context._UNSET else str(value or "")
    if not result["id"] or not result["key"]:
        raise ValueError("BOUND_SESSION_REQUIRED")
    return validated_context(result)

def command_context(source):
    # The gateway supplies source to native command handlers before any model turn.
    if source is None or getattr(source, "is_bot", False) or getattr(source, "profile_route_rejected", False):
        raise ValueError("BOUND_TELEGRAM_REQUIRED")
    platform = getattr(source, "platform", None)
    values = {name: str(getattr(source, name, "") or "") for name in ("profile", "user_id", "chat_id", "chat_type", "message_id")}
    values["platform"] = str(getattr(platform, "value", platform) or "")
    return validated_context(values)

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise ValueError("BRIDGE_REDIRECT_DENIED")

def call_backend(home, payload):
    if home.resolve() != EXPECTED_HOME:
        raise ValueError("PROFILE_SCOPE_MISMATCH")
    path = home / "runtime/libetech-ai-os/bridge.json"
    if path.is_symlink() or path.parent.is_symlink() or not path.is_file():
        raise ValueError("BRIDGE_NOT_CONFIGURED")
    if stat.S_IMODE(path.stat().st_mode) & 0o077:
        raise ValueError("BRIDGE_CONFIG_PERMISSIONS")
    key = json.loads(path.read_text())["key"]
    if not isinstance(key, str) or len(key) < 43:
        raise ValueError("BRIDGE_NOT_CONFIGURED")
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode()
    timestamp, nonce = str(int(time.time() * 1000)), secrets.token_urlsafe(24)
    text = timestamp.encode() + b"\n" + nonce.encode() + b"\nPOST\n/api/bridge\n" + raw
    headers = {"Content-Type": "application/json", "X-Libetech-Timestamp": timestamp,
               "X-Libetech-Nonce": nonce, "X-Libetech-Signature": hmac.new(key.encode(), text, hashlib.sha256).hexdigest()}
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    request = urllib.request.Request(ENDPOINT, data=raw, headers=headers, method="POST")
    try:
        response = opener.open(request, timeout=5)
    except urllib.error.HTTPError as exc:
        response = exc
    with response:
        content = response.read(65537)
        if len(content) > 65536:
            raise ValueError("BRIDGE_RESPONSE_TOO_LARGE")
        result = json.loads(content)
        if result.get("error"):
            raise ValueError(str(result["error"].get("code", "BRIDGE_UNAVAILABLE")))
        return result["data"]

def safe_error(error):
    code = str(error) if isinstance(error, ValueError) else "BRIDGE_UNAVAILABLE"
    if not re.fullmatch(r"[A-Z][A-Z0-9_]{1,80}", code):
        code = "BRIDGE_UNAVAILABLE"
    return {"ok": False, "error": code, "bridgeVersion": VERSION}

def read_request(params, context):
    if (not isinstance(params, dict) or set(params) != {"code", "source_sha"}
        or not isinstance(params["code"], str) or not re.fullmatch(r"[A-Z0-9-]{3,40}", params["code"])
        or not isinstance(params["source_sha"], str) or not re.fullmatch(r"[a-f0-9]{40}", params["source_sha"])):
        raise ValueError("INVALID_REQUEST")
    return {"operation": "reconciliation", "context": context, "code": params["code"], "sourceSha": params["source_sha"]}

def approval_question(row):
    """Show the exact frozen grants in human terms before asking for a vote."""
    if not isinstance(row, dict) or not APPROVAL_ID.fullmatch(str(row.get("id", ""))):
        raise ValueError("APPROVAL_INVALID")
    details = row.get("grant_details")
    frozen = row.get("grants")
    if (not isinstance(details, list) or not isinstance(frozen, list)
        or not 1 <= len(details) <= 30 or len(details) != len(frozen)):
        raise ValueError("APPROVAL_SCOPE_UNAVAILABLE")
    grants = []
    for item in details:
        if not isinstance(item, dict) or item.get("role") not in APPROVAL_ROLES:
            raise ValueError("APPROVAL_SCOPE_UNAVAILABLE")
        name, permissions = item.get("name"), item.get("reportPermissions")
        if not isinstance(name, str) or not name.strip() or not isinstance(permissions, list):
            raise ValueError("APPROVAL_SCOPE_UNAVAILABLE")
        if any(permission not in REPORT_PERMISSIONS for permission in permissions):
            raise ValueError("APPROVAL_SCOPE_UNAVAILABLE")
        clean_name = re.sub(r"\s+", " ", name).strip()
        text = f"{clean_name} ({APPROVAL_ROLES[item['role']]})"
        if permissions:
            text += " + " + ", ".join(REPORT_PERMISSIONS[p] for p in permissions)
        grants.append(text)
    person = re.sub(r"\s+", " ", str(row.get("name", ""))).strip()
    username = str(row.get("username", ""))
    reason = re.sub(r"\s+", " ", str(row.get("reason", ""))).strip()
    if not person or not username or not reason:
        raise ValueError("APPROVAL_INVALID")
    question = (f"Cấp tài khoản cho {person} ({username})?\n"
                f"Quyền sẽ cấp: {'; '.join(grants)}.\nCăn cứ: {reason}\nChọn Yes hoặc No.")
    if len(question) > 1800:
        raise ValueError("APPROVAL_SCOPE_TOO_LONG")
    return question

def register(ctx):
    from hermes_constants import get_hermes_home
    home = get_hermes_home().resolve()
    # Registration is side-effect free for Hermes capability probing.
    # The actual request checks the profile before reading credentials or sending.

    def read(params, **kwargs):
        del kwargs
        try:
            result = call_backend(home, read_request(params, tool_context()))
            return json.dumps({"ok": True, "data": result, "bridgeVersion": VERSION}, ensure_ascii=False)
        except Exception as error:
            return json.dumps(safe_error(error))

    def link(raw_args, *, source=None):
        try:
            context = command_context(source)
            if context["chatType"] not in {"private", "dm"}:
                raise ValueError("PRIVATE_CHAT_REQUIRED")
            code = raw_args.strip()
            if not re.fullmatch(r"[A-Za-z0-9_-]{43}", code):
                raise ValueError("INVALID_PAIRING_CODE")
            call_backend(home, {"operation": "pair", "context": context, "code": code})
            return "Đã xác minh và ghép Telegram với tài khoản LibeTech AI OS. Quyền dự án giữ nguyên."
        except Exception as error:
            return safe_error(error)["error"]

    def check(raw_args, *, source=None):
        try:
            parts = raw_args.strip().split()
            if len(parts) != 2:
                raise ValueError("USE_CODE_AND_FULL_SHA")
            result = call_backend(home, read_request({"code": parts[0], "source_sha": parts[1]}, command_context(source)))
            return json.dumps({"ok": True, "data": result, "bridgeVersion": VERSION}, ensure_ascii=False)
        except Exception as error:
            return safe_error(error)["error"]

    def access_pending(raw_args, *, source=None):
        try:
            if raw_args.strip():
                raise ValueError("NO_ARGUMENTS_EXPECTED")
            context = command_context(source)
            if context["chatType"] not in {"private", "dm"}:
                raise ValueError("PRIVATE_CHAT_REQUIRED")
            result = call_backend(home, {"operation": "account_approval_pending", "context": context})
            return json.dumps({"ok": True, "pending": result}, ensure_ascii=False)
        except Exception as error:
            return safe_error(error)["error"]

    def access_vote(raw_args, *, source=None, choice):
        try:
            approval_id = raw_args.strip()
            if not APPROVAL_ID.fullmatch(approval_id):
                raise ValueError("USE_APPROVAL_ID")
            context = command_context(source)
            if context["chatType"] not in {"private", "dm"}:
                raise ValueError("PRIVATE_CHAT_REQUIRED")
            result = call_backend(home, {"operation": "account_approval_vote", "context": context,
                                         "approvalId": approval_id, "choice": choice})
            return json.dumps({"ok": True, "approval": result}, ensure_ascii=False)
        except Exception as error:
            return safe_error(error)["error"]

    def access_review(raw_args, *, source=None):
        """One short DM command, then one Yes/No card per pending ballot."""
        try:
            if raw_args.strip():
                raise ValueError("NO_ARGUMENTS_EXPECTED")
            context = command_context(source)
            if context["chatType"] not in {"private", "dm"}:
                raise ValueError("PRIVATE_CHAT_REQUIRED")
            pending = call_backend(home, {"operation": "account_approval_pending", "context": context})
            if not isinstance(pending, list):
                raise ValueError("APPROVAL_INVALID")
            if not pending:
                return "Không có phiếu cấp tài khoản cần xác nhận."
            recorded = []
            for row in pending:
                selection = ctx.ask_choice(approval_question(row), [
                    {"value": "yes", "label": "Yes · Đồng ý"},
                    {"value": "no", "label": "No · Từ chối"},
                ])
                if selection not in {"yes", "no"}:
                    return ("Đã dừng; phiếu chưa chọn không được ghi nhận. "
                            + (f"Đã ghi {len(recorded)} phiếu trước đó." if recorded else ""))
                call_backend(home, {"operation": "account_approval_vote", "context": context,
                                    "approvalId": row["id"],
                                    "choice": "agree" if selection == "yes" else "reject"})
                recorded.append(f"{row['name']}: {selection.upper()}")
            return "Đã ghi lựa chọn Telegram: " + "; ".join(recorded) + ". Chưa tự cấp lời mời."
        except Exception as error:
            return safe_error(error)["error"]

    ctx.register_tool(name="libetech_os_read", toolset="libetech-ai-os-bridge", handler=read, schema={
        "name": "libetech_os_read", "description": "Read an AI OS reconciliation at the exact full SHA. Backend verifies linked Telegram identity and chat/project scope. Read only; a source closure is not acceptance.",
        "parameters": {"type": "object", "properties": {"code": {"type": "string"}, "source_sha": {"type": "string"}}, "required": ["code", "source_sha"], "additionalProperties": False}})
    # Native commands prevent the pairing secret from entering the model/tool argument history.
    ctx.register_command("libetech-link", handler=link, description="Ghép tài khoản AI OS trong tin nhắn riêng", args_hint="<mã ghép>")
    ctx.register_command("libetech-check", handler=check, description="Đọc hồ sơ AI OS đúng SHA trong phạm vi được giao", args_hint="<mã việc> <SHA đầy đủ>")
    ctx.register_command("libetech-access-pending", handler=access_pending,
                         description="Xem phiếu cấp tài khoản Tech chờ mình duyệt trong DM")
    ctx.register_command("libetech-access-approve", handler=lambda args, *, source=None: access_vote(args, source=source, choice="agree"),
                         description="Đồng ý cấp tài khoản Tech qua Telegram", args_hint="<mã phiếu>")
    ctx.register_command("libetech-access-reject", handler=lambda args, *, source=None: access_vote(args, source=source, choice="reject"),
                         description="Từ chối cấp tài khoản Tech qua Telegram", args_hint="<mã phiếu>")
    ctx.register_command("duyet", handler=access_review,
                         description="Xem phiếu Tech trong chat riêng và chọn Yes hoặc No")
