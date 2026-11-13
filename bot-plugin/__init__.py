"""Transport-only adapter. The AI OS backend owns identity and project authorization.

Two principals, two key files. The bot (`bridge.json`) reads and links only. The intake/delivery adapter
(`intake.json`) posts group messages and reports outbox receipts. Neither decides, assigns or accepts anything.
"""
from __future__ import annotations
from contextlib import contextmanager
from datetime import datetime, timezone
import fcntl
import hashlib
import hmac
import http.client
import json
import logging
import os
from pathlib import Path
import re
import secrets
import stat
import time
import urllib.error
import urllib.request
import uuid

VERSION = "0.3.0"
EXPECTED_HOME = Path("/home/iptech/.hermes/profiles/libetech")
ORIGIN = "http://127.0.0.1:3148"
ENDPOINT = ORIGIN + "/api/bridge"
INTAKE_PATH = "/api/bridge/intake/events"
PULL_PATH = "/api/bridge/outbox/pull"
RECEIPT_PATH = "/api/bridge/outbox/receipts"
# Each route signs with exactly one principal's key file: the bot key never reaches an intake route, nor the reverse.
ROUTE_KEYS = {"/api/bridge": "bridge.json", INTAKE_PATH: "intake.json", PULL_PATH: "intake.json", RECEIPT_PATH: "intake.json"}
MAX_EVENT_BYTES = 16384
MAX_RECEIPT_BYTES = 4096
MAX_RECEIPTS = 10
MAX_TEXT_UNITS = 4096
MAX_ATTACHMENT_BYTES = 20971520
ALLOWED_MIME = frozenset({
    "image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain", "text/csv",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
})
SPOOL_LIMIT = 1000
# Gateway hook observed for intake. Not verified against the running gateway (plan, stop point 3).
INTAKE_HOOK = "pre_gateway_dispatch"
LOG = logging.getLogger("libetech_ai_os_bridge")
POSITIVE = re.compile(r"[1-9][0-9]{0,19}\Z")
APPROVAL_ID = re.compile(r"[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\Z")
UUID = APPROVAL_ID
GROUP_CHAT = re.compile(r"-[1-9][0-9]{0,19}\Z")
MEDIA_GROUP = re.compile(r"[0-9A-Za-z_-]{1,64}\Z")
CODE = re.compile(r"[A-Z0-9_]{1,64}\Z")
# A reconcile receipt must carry a lease token, which the server does not compare for that phase.
# Without a journal line there is no token to repeat, so the nil UUID says "none known" instead of inventing one.
NIL_LEASE = "00000000-0000-0000-0000-000000000000"
APPROVAL_KINDS = ("registration", "access_change")
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

class BackendError(ValueError):
    """An error answer from the backend. str() is the code; `status` is the HTTP status (0 if unknown)."""
    def __init__(self, code, status):
        super().__init__(code)
        self.status = status

def _encode(payload):
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode()

def _read_key(path):
    if path.is_symlink() or path.parent.is_symlink() or not path.is_file():
        raise ValueError("BRIDGE_NOT_CONFIGURED")
    if stat.S_IMODE(path.stat().st_mode) & 0o077:
        raise ValueError("BRIDGE_CONFIG_PERMISSIONS")
    key = json.loads(path.read_text())["key"]
    if not isinstance(key, str) or len(key) < 43:
        raise ValueError("BRIDGE_NOT_CONFIGURED")
    return key

def call_backend(home, payload, *, path="/api/bridge", key_file="bridge.json"):
    if home.resolve() != EXPECTED_HOME:
        raise ValueError("PROFILE_SCOPE_MISMATCH")
    if not isinstance(path, str) or ROUTE_KEYS.get(path) != key_file:
        raise ValueError("BRIDGE_ROUTE_DENIED")
    key = _read_key(home / "runtime/libetech-ai-os" / key_file)
    raw = _encode(payload)
    timestamp, nonce = str(int(time.time() * 1000)), secrets.token_urlsafe(24)
    # The signed text carries this route's own path, so a body signed for one route is refused by every other.
    text = timestamp.encode() + b"\n" + nonce.encode() + b"\nPOST\n" + path.encode() + b"\n" + raw
    headers = {"Content-Type": "application/json", "X-Libetech-Timestamp": timestamp,
               "X-Libetech-Nonce": nonce, "X-Libetech-Signature": hmac.new(key.encode(), text, hashlib.sha256).hexdigest()}
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    request = urllib.request.Request(ORIGIN + path, data=raw, headers=headers, method="POST")
    try:
        response = opener.open(request, timeout=5)
    except urllib.error.HTTPError as exc:
        response = exc
    status = int(getattr(response, "status", None) or getattr(response, "code", None) or 0)
    with response:
        content = response.read(65537)
        if len(content) > 65536:
            raise ValueError("BRIDGE_RESPONSE_TOO_LARGE")
        try:
            result = json.loads(content)
        except ValueError:
            raise BackendError("BRIDGE_UNAVAILABLE", status) from None
        error = result.get("error") if isinstance(result, dict) else None
        if not isinstance(result, dict) or error:
            code = error.get("code") if isinstance(error, dict) else None
            raise BackendError(str(code or "BRIDGE_UNAVAILABLE"), status)
        return result["data"]

def _retryable(error):
    """Transient or operator-fixable: keep the item for a later attempt. A refusal of the item itself is final."""
    if isinstance(error, BackendError):
        return error.status == 0 or error.status >= 500 or error.status in (401, 404, 408, 429)
    if isinstance(error, ValueError):
        return str(error) in ("BRIDGE_NOT_CONFIGURED", "BRIDGE_CONFIG_PERMISSIONS")
    return isinstance(error, (OSError, http.client.HTTPException))

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

# ---- Intake and delivery adapter (intake principal, `intake.json`) ----
# Gateway event contract read by intake_event (to be verified at the runtime wiring, plan stop point 3):
#   event.source: platform, profile, user_id, chat_id, chat_type, message_id, is_bot, profile_route_rejected, thread_id
#   event: text, message_id, reply_to_message_id, reply_to_bot, mentions_bot, media_group_id, edited_at, forwarded,
#          timestamp, internal, is_bot; and for files: attachment (mime_type, file_size, file_name), download_attachment().

def _now():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")

def _iso(moment):
    return moment.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")

def _units(text):
    return len(text.encode("utf-16-le", "surrogatepass")) // 2

def _cut_units(text, limit):
    """Longest prefix within `limit` UTF-16 units (the unit the server's 4 096 limit counts), never splitting a character."""
    kept, used = [], 0
    for char in text:
        width = 2 if ord(char) > 0xFFFF else 1
        if used + width > limit:
            break
        kept.append(char)
        used += width
    return "".join(kept)

def _optional_id(value):
    if value is None or value == "":
        return None
    if type(value) is int:
        value = str(value)
    if not isinstance(value, str) or not POSITIVE.fullmatch(value):
        raise ValueError("INTAKE_EVENT_INVALID")
    return value

def _optional_stamp(value):
    if value is None:
        return None
    try:
        if isinstance(value, datetime) and value.utcoffset() is not None:
            return _iso(value)
        if type(value) in (int, float) and value > 0:
            return _iso(datetime.fromtimestamp(value, timezone.utc))
    except (OverflowError, OSError, ValueError):
        raise ValueError("INTAKE_EVENT_INVALID") from None
    raise ValueError("INTAKE_EVENT_INVALID")

def intake_event(event):
    """Intake body built from the gateway's own event object; identity and placement never come from the text.
    None: not a person's message in a Telegram group of the libetech profile, or a route the gateway rejected."""
    source = getattr(event, "source", None)
    if event is None or source is None or getattr(event, "internal", False) is True:
        return None
    if (getattr(source, "is_bot", False) or getattr(event, "is_bot", False)
            or getattr(source, "profile_route_rejected", False)):
        return None
    platform = getattr(source, "platform", None)
    values = {name: str(getattr(source, name, "") or "") for name in ("profile", "user_id", "chat_id", "chat_type")}
    values["message_id"] = str(getattr(source, "message_id", "") or getattr(event, "message_id", "") or "")
    values["platform"] = str(getattr(platform, "value", platform) or "")
    if values["chat_type"] not in ("group", "supergroup"):
        return None
    try:
        context = dict(validated_context(values))
    except ValueError:
        return None
    # Optional placement: present but malformed is refused, never guessed.
    topic = _optional_id(getattr(source, "thread_id", None))
    reply = _optional_id(getattr(event, "reply_to_message_id", None))
    album = getattr(event, "media_group_id", None)
    if album is not None and album != "":
        album = str(album) if type(album) is int else album
        if not isinstance(album, str) or not MEDIA_GROUP.fullmatch(album):
            raise ValueError("INTAKE_EVENT_INVALID")
        context["mediaGroupId"] = album
    if topic:
        context["topicId"] = topic
    if reply:
        context["replyToMessageId"] = reply
    edited = _optional_stamp(getattr(event, "edited_at", None))
    seen = getattr(event, "timestamp", None)
    observed = _iso(seen) if isinstance(seen, datetime) and seen.utcoffset() is not None else _now()
    text = getattr(event, "text", "")
    text = text.encode("utf-8", "replace").decode("utf-8") if isinstance(text, str) else ""
    addressed = (text.lstrip().startswith("/") or getattr(event, "mentions_bot", False) is True
                 or getattr(event, "reply_to_bot", False) is True)
    payload = {"context": context, "observedAt": observed}
    if edited:
        payload["editedAt"] = edited
    payload.update(addressed=addressed, spooled=False, forwarded=getattr(event, "forwarded", False) is True,
                   text=text, textTruncated=False, contentHash=hashlib.sha256(text.encode()).hexdigest(),
                   traceId=str(uuid.uuid4()))
    return payload

def fit_event(payload):
    """Cut only the text until the signed body is at most MAX_EVENT_BYTES and the text at most 4 096 UTF-16 units.
    contentHash stays the hash of the full text, taken before any cut."""
    event = dict(payload)
    text = event.get("text", "")
    if not isinstance(text, str):
        raise ValueError("INTAKE_EVENT_INVALID")
    text = text.encode("utf-8", "replace").decode("utf-8")
    if not event.get("textTruncated"):
        event["contentHash"] = hashlib.sha256(text.encode()).hexdigest()
    full = {**event, "text": text, "textTruncated": bool(event.get("textTruncated"))}
    if _units(text) <= MAX_TEXT_UNITS and len(_encode(full)) <= MAX_EVENT_BYTES:
        return full
    text = _cut_units(text, MAX_TEXT_UNITS)
    def fits(count):
        return len(_encode({**event, "text": text[:count], "textTruncated": True})) <= MAX_EVENT_BYTES
    if not fits(0):
        raise ValueError("EVENT_TOO_LARGE")
    low, high = 0, len(text)
    while low < high:
        middle = (low + high + 1) // 2
        if fits(middle):
            low = middle
        else:
            high = middle - 1
    return {**event, "text": text[:low], "textTruncated": True}

def _runtime_dir(home):
    if Path(home).resolve() != EXPECTED_HOME:
        raise ValueError("PROFILE_SCOPE_MISMATCH")
    folder = Path(home) / "runtime/libetech-ai-os"
    if folder.is_symlink() or not folder.is_dir():
        raise ValueError("BRIDGE_NOT_CONFIGURED")
    return folder

def _open_private(path, flags):
    """Owner-only runtime file, never through a symlink; an existing file others can read is refused."""
    descriptor = os.open(path, flags | os.O_NOFOLLOW | getattr(os, "O_CLOEXEC", 0), 0o600)
    info = os.fstat(descriptor)
    if not stat.S_ISREG(info.st_mode) or stat.S_IMODE(info.st_mode) & 0o077:
        os.close(descriptor)
        raise ValueError("RUNTIME_FILE_PERMISSIONS")
    return descriptor

def _write_all(descriptor, data):
    view = memoryview(data)
    while view:
        view = view[os.write(descriptor, view):]

def _read_lines(path):
    """Non-empty lines. Split on "\\n" only: JSON keeps U+2028 and U+0085 unescaped, which splitlines() would cut."""
    try:
        descriptor = _open_private(path, os.O_RDONLY)
    except FileNotFoundError:
        return []
    with os.fdopen(descriptor, "rb") as handle:
        return [line for line in handle.read().decode("utf-8", "replace").split("\n") if line]

def _append_line(path, line):
    descriptor = _open_private(path, os.O_WRONLY | os.O_APPEND | os.O_CREAT)
    try:
        _write_all(descriptor, line.encode() + b"\n")
        os.fsync(descriptor)
    finally:
        os.close(descriptor)

def _write_atomic(path, data):
    temporary = path.with_name(f".{path.name}.{secrets.token_hex(8)}.tmp")
    done = False
    try:
        descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | getattr(os, "O_CLOEXEC", 0), 0o600)
        try:
            _write_all(descriptor, data)
            os.fsync(descriptor)
        finally:
            os.close(descriptor)
        os.replace(temporary, path)
        done = True
    finally:
        if not done and os.path.lexists(temporary):
            os.unlink(temporary)

@contextmanager
def _locked(path):
    descriptor = _open_private(path, os.O_RDWR | os.O_CREAT)
    try:
        fcntl.flock(descriptor, fcntl.LOCK_EX)
        yield
    finally:
        os.close(descriptor)

def _field(raw, name):
    return raw.get(name) if isinstance(raw, dict) else getattr(raw, name, None)

def _file_name(value):
    if not isinstance(value, str):
        return ""
    name = re.sub(r"[\x00-\x1f\x7f]", "", re.split(r"[\\/]", value)[-1])
    return _cut_units(name, 200)

def store_attachment(home, raw, download):
    """Keep the bytes of an allowed file under its sha256; the backend only ever gets locator, hash, type and size.
    The file is never opened or parsed. Not stored: {'state': 'failed', 'reasonCode': ...}."""
    mime = _field(raw, "mime_type")
    mime = mime.strip().lower() if isinstance(mime, str) else ""
    declared = _field(raw, "file_size")
    declared = declared if type(declared) is int and declared >= 0 else None
    name = _file_name(_field(raw, "file_name"))
    def failed(reason, size=declared):
        result = {"state": "failed", "reasonCode": reason}
        if mime:
            result["mimeType"] = mime[:100]
        if size is not None:
            result["sizeBytes"] = size
        if name:
            result["fileName"] = name
        return result
    if mime not in ALLOWED_MIME:
        return failed("UNSUPPORTED_TYPE")
    if declared is not None and declared > MAX_ATTACHMENT_BYTES:
        return failed("TOO_LARGE")
    if not callable(download):
        return failed("DOWNLOAD_UNAVAILABLE")
    try:
        data = download()
    except Exception:  # the cause may name the chat or file; only the reason code leaves this function
        return failed("DOWNLOAD_UNAVAILABLE")
    if not isinstance(data, (bytes, bytearray)) or not data:
        return failed("DOWNLOAD_UNAVAILABLE")
    if len(data) > MAX_ATTACHMENT_BYTES:
        return failed("TOO_LARGE", len(data))
    digest = hashlib.sha256(data).hexdigest()
    try:
        folder = _runtime_dir(home) / "attachments"
        if folder.is_symlink():
            raise ValueError("STORE_UNAVAILABLE")
        if not folder.is_dir():
            folder.mkdir(mode=0o700)
        _write_atomic(folder / digest, bytes(data))
    except (OSError, ValueError):
        return failed("STORE_UNAVAILABLE", len(data))
    result = {"state": "stored", "locator": "gw://libetech/attachments/" + digest, "sha256": digest,
              "mimeType": mime, "sizeBytes": len(data)}
    if name:
        result["fileName"] = name
    return result

class Spool:
    """Events the backend could not take yet, oldest first: one JSON line each, owner-only, at most SPOOL_LIMIT."""
    def __init__(self, home):
        self.home = home

    def _paths(self):
        folder = _runtime_dir(self.home)
        return folder / "intake-spool.jsonl", folder / "intake-spool.lock"

    def pending(self):
        return len(_read_lines(self._paths()[0]))

    def put(self, payload):
        path, lock = self._paths()
        line = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        with _locked(lock):
            if len(_read_lines(path)) >= SPOOL_LIMIT:
                raise ValueError("SPOOL_FULL")
            _append_line(path, line)

    def drain(self, send):
        """Replay in order with spooled=True. Stops at the first transient failure; an event the backend refuses for
        itself is dropped with a code in the log. Sending twice after a crash is harmless: the backend keys events by
        chat and message id."""
        path, lock = self._paths()
        lines = _read_lines(path)
        sent = done = forgotten = 0
        try:
            for line in lines:
                try:
                    payload = json.loads(line)
                except ValueError:
                    payload = None
                if not isinstance(payload, dict):
                    LOG.warning("libetech intake spool: %s", "SPOOL_LINE_UNREADABLE")
                else:
                    payload["spooled"] = True
                    try:
                        send(payload)
                        sent += 1
                    except Exception as error:
                        if _retryable(error):
                            break
                        LOG.warning("libetech intake spool dropped one event: %s", safe_error(error)["error"])
                done += 1
                if done - forgotten >= 50:
                    self._forget(path, lock, lines[forgotten:done])
                    forgotten = done
        finally:
            self._forget(path, lock, lines[forgotten:done])
        return sent

    @staticmethod
    def _forget(path, lock, head):
        if not head:
            return
        with _locked(lock):
            current = _read_lines(path)
            if current[:len(head)] == head:
                _write_atomic(path, "".join(line + "\n" for line in current[len(head):]).encode())

def submit_event(home, payload, spool):
    """Post one fitted event on the intake key. Spooled events go first, so the backend never sees a newer message
    before an older one. Network failure or 5xx: the event is spooled; a full spool raises SPOOL_FULL."""
    def post(event):
        return call_backend(home, event, path=INTAKE_PATH, key_file="intake.json")
    if spool.pending():
        spool.drain(post)
        if spool.pending():
            spool.put(payload)
            return {"ok": False, "spooled": True}
    try:
        return {"ok": True, "data": post(payload)}
    except Exception as error:
        if not _retryable(error):
            return {"ok": False, "error": safe_error(error)["error"]}
        spool.put(payload)
        return {"ok": False, "spooled": True}

def intake_hook(home, *args, **kwargs):
    """Observe one gateway message. Always None: never blocks, rewrites or reroutes dispatch, never raises into the
    gateway, and logs fixed codes only (no text, chat id or name)."""
    try:
        event = kwargs["event"] if "event" in kwargs else (args[0] if args else None)
        payload = intake_event(event)
        if payload is None:
            return None
        raw = getattr(event, "attachment", None)
        if raw is not None:
            payload["attachment"] = store_attachment(home, raw, getattr(event, "download_attachment", None))
        result = submit_event(home, fit_event(payload), Spool(home))
        if result.get("spooled"):
            LOG.warning("libetech intake: %s", "INTAKE_SPOOLED")
        elif not result.get("ok"):
            LOG.warning("libetech intake: %s", result.get("error", "BRIDGE_UNAVAILABLE"))
    except Exception as error:
        LOG.warning("libetech intake: %s", safe_error(error)["error"])
    return None

TEMPLATES = {
    "intake.received": ("Đã ghi nhận, mã {ref}. PM sẽ xác nhận loại và dự án; đây chưa phải việc đã giao.", ("ref",)),
    "intake.recovered": ("Kết nối đã khôi phục. Tin lúc {observedAt} đã được ghi nhận, mã {ref}.", ("observedAt", "ref")),
    "intake.attachment_failed": ("Đã ghi nhận nội dung, mã {ref}, nhưng chưa lưu được tệp đính kèm. Vui lòng gửi lại tệp.", ("ref",)),
    "account_approval.pending": ("Có phiếu Tech chờ anh/chị xác nhận. Gõ /duyet trong chat riêng này.", ()),
}
TEMPLATE_PARAMS = {"ref": re.compile(r"IN-[0-9A-F]{8}\Z"),
                   "observedAt": re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})\Z")}

def render(template, params):
    """Fixed text per template; parameters are only a reference and a time, checked by shape. Other params are ignored."""
    if not isinstance(template, str) or template not in TEMPLATES:
        raise ValueError("TEMPLATE_UNKNOWN")
    text, names = TEMPLATES[template]
    if not isinstance(params, dict):
        raise ValueError("TEMPLATE_PARAMS_INVALID")
    for name in names:
        value = params.get(name)
        if not isinstance(value, str) or not TEMPLATE_PARAMS[name].fullmatch(value):
            raise ValueError("TEMPLATE_PARAMS_INVALID")
        text = text.replace("{" + name + "}", value)
    return text

class SendRejected(Exception):
    """Raised by a send adapter when Telegram refuses for good: bot blocked, removed from the chat, chat not found."""
    def __init__(self, code="SEND_REJECTED"):
        super().__init__(code)
        self.code = code if isinstance(code, str) and CODE.fullmatch(code) else "SEND_REJECTED"

class SendNotAttempted(Exception):
    """Raised by a send adapter when the connection failed before the request left the gateway."""

def _send_failure(error):
    """Outcome and fixed code of a failed send. Anything not known to be unsent is uncertain: reconcile, never resend."""
    if isinstance(error, SendRejected):
        return "failed_permanent", error.code
    if isinstance(error, PermissionError):
        return "failed_permanent", "SEND_FORBIDDEN"
    if isinstance(error, (SendNotAttempted, ConnectionRefusedError)):
        return "failed_retryable", "SEND_UNREACHABLE"
    if isinstance(error, TimeoutError):
        return "uncertain", "SEND_TIMEOUT"
    return "uncertain", "SEND_UNKNOWN"

class _JournalView:
    STATES = ("sending", "sent", "failed", "receipt", "reported", "rejected")
    PHASES = ("send", "reconcile")

    def __init__(self, lines):
        self.damaged = False
        self.attempts = {}
        self.order = []
        for line in lines:
            try:
                entry = json.loads(line)
            except ValueError:
                entry = None
            if self._valid(entry):
                self.add(entry)
            else:
                self.damaged = True

    @classmethod
    def _valid(cls, entry):
        if (not isinstance(entry, dict) or entry.get("state") not in cls.STATES
                or not isinstance(entry.get("outboxId"), str) or not UUID.fullmatch(entry["outboxId"])
                or type(entry.get("attemptNo")) is not int or entry["attemptNo"] < 1):
            return False
        state = entry["state"]
        if state == "sending":
            return isinstance(entry.get("leaseToken"), str) and bool(UUID.fullmatch(entry["leaseToken"]))
        if state == "sent":
            return isinstance(entry.get("telegramMessageId"), str) and bool(POSITIVE.fullmatch(entry["telegramMessageId"]))
        if state == "receipt":
            return entry.get("phase") in cls.PHASES and isinstance(entry.get("receipt"), dict)
        if state in ("reported", "rejected"):
            return entry.get("phase") in cls.PHASES
        return True

    def add(self, entry):
        key = (entry["outboxId"], entry["attemptNo"])
        record = self.attempts.setdefault(key, {"sending": None, "sent": None, "receipts": {}, "closed": {}})
        state = entry["state"]
        if state in ("sending", "sent"):
            record[state] = record[state] or entry
        elif state == "receipt" and entry["phase"] not in record["receipts"]:
            record["receipts"][entry["phase"]] = entry["receipt"]
            self.order.append((key, entry["phase"]))
        elif state in ("reported", "rejected"):
            record["closed"].setdefault(entry["phase"], (state, entry.get("code")))

    def attempt(self, outbox_id, attempt_no):
        return self.attempts.get((outbox_id, attempt_no))

    def pending(self):
        """Receipts journaled but neither accepted nor refused by the backend, in journal order."""
        return [self.attempts[key]["receipts"][phase] for key, phase in self.order
                if phase not in self.attempts[key]["closed"]]

class SendJournal:
    """Append-only, owner-only record of what this gateway did with each delivery attempt. 'sending' is on disk
    before Telegram is called and 'sent' with the message id right after, so a reconcile request is answered from
    this record and never guessed. No chat id, text or exception message is written here."""
    def __init__(self, home):
        self.home = home
        self._view = None

    def _path(self):
        return _runtime_dir(self.home) / "send-journal.jsonl"

    def _append(self, entry):
        entry = {**entry, "at": _now()}
        try:
            _append_line(self._path(), json.dumps(entry, ensure_ascii=False, separators=(",", ":")))
        except (OSError, ValueError) as error:
            raise ValueError("JOURNAL_UNAVAILABLE") from error
        if self._view is not None:
            self._view.add(entry)

    def view(self, refresh=False):
        if self._view is None or refresh:
            try:
                self._view = _JournalView(_read_lines(self._path()))
            except (OSError, ValueError) as error:
                raise ValueError("JOURNAL_UNAVAILABLE") from error
        return self._view

    def sending(self, outbox_id, attempt_no, lease_token):
        self._append({"state": "sending", "outboxId": outbox_id, "attemptNo": attempt_no, "leaseToken": lease_token})

    def sent(self, outbox_id, attempt_no, message_id):
        self._append({"state": "sent", "outboxId": outbox_id, "attemptNo": attempt_no, "telegramMessageId": str(message_id)})

    def failed(self, outbox_id, attempt_no, outcome, error_code):
        self._append({"state": "failed", "outboxId": outbox_id, "attemptNo": attempt_no, "outcome": outcome, "errorCode": error_code})

    def queued(self, receipt):
        self._append({"state": "receipt", "outboxId": receipt["outboxId"], "attemptNo": receipt["attemptNo"],
                      "phase": receipt["phase"], "receipt": dict(receipt)})

    def reported(self, receipt):
        self._append({"state": "reported", "outboxId": receipt["outboxId"], "attemptNo": receipt["attemptNo"], "phase": receipt["phase"]})

    def rejected(self, receipt, code):
        self._append({"state": "rejected", "outboxId": receipt["outboxId"], "attemptNo": receipt["attemptNo"],
                      "phase": receipt["phase"], "code": code if isinstance(code, str) and CODE.fullmatch(code) else "RECEIPT_REJECTED"})

def _attempt_key(item):
    if not isinstance(item, dict):
        return None
    outbox_id, attempt_no = item.get("outboxId"), item.get("attemptNo")
    if not isinstance(outbox_id, str) or not UUID.fullmatch(outbox_id) or type(attempt_no) is not int or attempt_no < 1:
        return None
    return outbox_id, attempt_no

def _delivery_target(item):
    audience, chat = item.get("audience"), item.get("chatId")
    topic, reply = item.get("topicId", ""), item.get("replyToMessageId")
    envelope = item.get("envelope")
    payload = envelope.get("payload") if isinstance(envelope, dict) else None
    if (audience not in ("group", "dm") or not isinstance(chat, str)
            or not (GROUP_CHAT if audience == "group" else POSITIVE).fullmatch(chat)
            or not isinstance(topic, str) or (topic and not POSITIVE.fullmatch(topic))
            or not (reply is None or (isinstance(reply, str) and POSITIVE.fullmatch(reply)))
            or (audience == "dm" and (topic or reply is not None)) or not isinstance(payload, dict)):
        raise ValueError("DELIVERY_INVALID")
    return chat, topic or None, reply, payload.get("template"), payload.get("params")

def _deliver(item, send, journal, summary):
    key = _attempt_key(item)
    lease = item.get("leaseToken") if key else None
    if key is None or not isinstance(lease, str) or not UUID.fullmatch(lease):
        summary["skipped"] += 1  # cannot be named in a receipt; its lease expires and the backend asks to reconcile
        return None
    outbox_id, attempt_no = key
    def receipt(outcome, **extra):
        made = {"outboxId": outbox_id, "attemptNo": attempt_no, "leaseToken": lease, "phase": "send",
                "outcome": outcome, **extra, "reportedAt": _now()}
        journal.queued(made)
        return made
    seen = journal.view().attempt(outbox_id, attempt_no)
    if seen and seen["sent"]:  # already on Telegram for this attempt: never a second time
        summary["delivered"] += 1
        return receipt("delivered", telegramMessageId=seen["sent"]["telegramMessageId"])
    if seen and seen["sending"]:
        summary["uncertain"] += 1
        return receipt("uncertain", errorCode="SEND_STATE_UNKNOWN")
    try:
        chat_id, topic_id, reply_to, template, params = _delivery_target(item)
        text = render(template, params)
    except ValueError as error:
        summary["failed"] += 1
        return receipt("failed_permanent", errorCode=safe_error(error)["error"])
    journal.sending(outbox_id, attempt_no, lease)
    try:
        message_id = send(chat_id, topic_id, reply_to, text)
    except Exception as error:
        outcome, code = _send_failure(error)
        journal.failed(outbox_id, attempt_no, outcome, code)
        summary["uncertain" if outcome == "uncertain" else "failed"] += 1
        return receipt(outcome, errorCode=code)
    message_id = str(message_id) if type(message_id) in (int, str) else ""
    if not POSITIVE.fullmatch(message_id):
        journal.failed(outbox_id, attempt_no, "uncertain", "SEND_NO_MESSAGE_ID")
        summary["uncertain"] += 1
        return receipt("uncertain", errorCode="SEND_NO_MESSAGE_ID")
    journal.sent(outbox_id, attempt_no, message_id)
    summary["delivered"] += 1
    return receipt("delivered", telegramMessageId=message_id)

def _reconcile(item, journal, summary):
    """Answer an uncertain attempt from the journal only: 'sent' → delivered; 'sending' without 'sent' → no answer
    (left for a person); no line at all → not_sent. A damaged journal never answers not_sent."""
    key = _attempt_key(item)
    if key is None:
        summary["skipped"] += 1
        return None
    view = journal.view()
    seen = view.attempt(*key)
    if seen and ("reconcile" in seen["closed"] or "reconcile" in seen["receipts"]):
        summary["skipped"] += 1  # already answered, refused, or waiting to be resubmitted: never twice
        return None
    sending = seen["sending"] if seen else None
    if seen and seen["sent"]:
        outcome, extra = "delivered", {"telegramMessageId": seen["sent"]["telegramMessageId"]}
        lease = sending["leaseToken"] if sending else NIL_LEASE
    elif sending or view.damaged:
        summary["held"] += 1
        return None
    else:
        outcome, extra, lease = "not_sent", {}, NIL_LEASE
    made = {"outboxId": key[0], "attemptNo": key[1], "leaseToken": lease, "phase": "reconcile",
            "outcome": outcome, **extra, "reportedAt": _now()}
    journal.queued(made)
    summary["reconciled"] += 1
    return made

def _receipt_batches(receipts):
    """At most MAX_RECEIPTS per batch, within MAX_RECEIPT_BYTES, and one receipt per (outboxId, attemptNo): the
    backend names a refusal by that pair only."""
    batches, current, keys = [], [], set()
    for receipt in receipts:
        key = (receipt["outboxId"], receipt["attemptNo"])
        if current and (len(current) >= MAX_RECEIPTS or key in keys
                        or len(_encode({"receipts": current + [receipt]})) > MAX_RECEIPT_BYTES):
            batches.append(current)
            current, keys = [], set()
        current.append(receipt)
        keys.add(key)
    if current:
        batches.append(current)
    return batches

def _refusals(answer):
    if not isinstance(answer, dict) or not isinstance(answer.get("rejected"), list):
        return None
    refused = {}
    for item in answer["rejected"]:
        key = _attempt_key(item)
        if key is None:
            return None
        code = item.get("code")
        refused[key] = code if isinstance(code, str) and CODE.fullmatch(code) else "RECEIPT_REJECTED"
    return refused

def _report_batch(home, journal, batch, summary):
    """True when every receipt of the batch is settled (accepted or refused for good); False leaves them pending."""
    try:
        answer = call_backend(home, {"receipts": batch}, path=RECEIPT_PATH, key_file="intake.json")
    except Exception as error:
        if isinstance(error, BackendError) and error.status in (413, 422):
            if len(batch) > 1:  # refused as a whole: find the bad one instead of refusing all of them
                for receipt in batch:
                    if not _report_batch(home, journal, [receipt], summary):
                        return False
                return True
            journal.rejected(batch[0], str(error))
            summary["rejected"] += 1
            return True
        summary.update(ok=False, error=safe_error(error)["error"])
        return False
    refused = _refusals(answer)
    if refused is None:
        summary.update(ok=False, error="RECEIPT_RESPONSE_INVALID")
        return False
    for receipt in batch:
        code = refused.get((receipt["outboxId"], receipt["attemptNo"]))
        if code:  # refused receipts are journaled with their code and never resubmitted
            journal.rejected(receipt, code)
            summary["rejected"] += 1
        else:
            journal.reported(receipt)
            summary["reported"] += 1
    return True

def _report(home, journal, receipts, summary):
    for batch in _receipt_batches(receipts):
        if not _report_batch(home, journal, batch, summary):
            return

def drain_outbox(home, send, journal, *, limit=10):
    """One delivery pass on the intake key: resubmit pending receipts, pull, send each delivery once
    (journal 'sending' → send → journal 'sent'), answer reconcile requests from the journal, report receipts.
    `send(chat_id, topic_id, reply_to, text)` returns the Telegram message id. Not wired to a real send or a schedule
    in this slice; only tests call it."""
    if type(limit) is not int or not 1 <= limit <= 10:
        raise ValueError("INVALID_LIMIT")
    summary = {"ok": True, "delivered": 0, "failed": 0, "uncertain": 0, "reconciled": 0, "held": 0, "skipped": 0,
               "reported": 0, "rejected": 0, "pending": 0}
    try:
        _report(home, journal, journal.view(refresh=True).pending(), summary)
        pulled = call_backend(home, {"limit": limit}, path=PULL_PATH, key_file="intake.json")
        if (not isinstance(pulled, dict) or not isinstance(pulled.get("deliveries"), list)
                or not isinstance(pulled.get("reconcile"), list)
                or len(pulled["deliveries"]) > 10 or len(pulled["reconcile"]) > 10):
            raise ValueError("OUTBOX_RESPONSE_INVALID")
        fresh = [receipt for receipt in (_deliver(item, send, journal, summary) for item in pulled["deliveries"]) if receipt]
        fresh += [receipt for receipt in (_reconcile(item, journal, summary) for item in pulled["reconcile"]) if receipt]
        _report(home, journal, fresh, summary)
    except Exception as error:
        summary.update(ok=False, error=safe_error(error)["error"])
    try:
        summary["pending"] = len(journal.view().pending())
    except ValueError as error:
        summary.update(ok=False, error=safe_error(error)["error"])
    return summary

def _grant_texts(details):
    if not isinstance(details, list) or not 1 <= len(details) <= 30:
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
    return grants

def approval_question(row):
    """Show the exact frozen grants in human terms before asking for a vote. No ballot or project id is shown."""
    if not isinstance(row, dict) or not APPROVAL_ID.fullmatch(str(row.get("id", ""))):
        raise ValueError("APPROVAL_INVALID")
    # Rows from before access-change ballots carry no kind; such a row is a registration and has no previous grants.
    kind = row.get("kind", "registration")
    if kind not in APPROVAL_KINDS or (kind == "registration" and row.get("previous_grant_details") is not None):
        raise ValueError("APPROVAL_INVALID")
    details = row.get("grant_details")
    frozen = row.get("grants")
    if not isinstance(details, list) or not isinstance(frozen, list) or len(details) != len(frozen):
        raise ValueError("APPROVAL_SCOPE_UNAVAILABLE")
    grants = _grant_texts(details)
    # The current grants are frozen with the ballot and are never empty (grants are min 1); an empty list means a
    # project did not resolve, so the card is not shown rather than shown short.
    previous = _grant_texts(row.get("previous_grant_details")) if kind == "access_change" else None
    person = re.sub(r"\s+", " ", str(row.get("name", ""))).strip()
    username = str(row.get("username", ""))
    reason = re.sub(r"\s+", " ", str(row.get("reason", ""))).strip()
    if not person or not username or not reason:
        raise ValueError("APPROVAL_INVALID")
    if kind == "access_change":
        question = (f"Đổi quyền cho {person} ({username})?\nQuyền hiện tại: {'; '.join(previous)}\n"
                    f"Quyền sau khi đổi: {'; '.join(grants)}\nCăn cứ: {reason}\nChọn Yes hoặc No.")
    else:
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
    # Intake is a separate principal: only with gateway hook support and its own key file. Otherwise the plugin
    # registers exactly what it did before. The hook only observes; the real send and outbox schedule are not wired.
    if hasattr(ctx, "register_hook") and (home / "runtime/libetech-ai-os/intake.json").exists():
        try:
            ctx.register_hook(INTAKE_HOOK, lambda *args, **kwargs: intake_hook(home, *args, **kwargs))
        except Exception as error:
            LOG.warning("libetech intake hook not registered: %s", safe_error(error)["error"])
