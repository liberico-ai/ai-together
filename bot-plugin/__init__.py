"""Transport-only adapter. The AI OS backend owns identity and project authorization.

Two principals, two key files. The bot (`bridge.json`) reads and links only. The intake/delivery adapter
(`intake.json`) posts group messages and reports outbox receipts. Neither decides, assigns or accepts anything.
"""
from __future__ import annotations
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
import fcntl
import functools
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
import unicodedata
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
# A spooled event the backend keeps ANSWERING with a retryable status leaves the head after this many answers, or once
# it has been spooled longer than SPOOL_MAX_AGE; it moves to intake-dead.jsonl. No answer at all never counts.
SPOOL_MAX_ATTEMPTS = 5
SPOOL_MAX_AGE = timedelta(hours=24)
# Work the hook may do inside the gateway's dispatch path, per message: one live POST plus HOOK_REPLAYS spooled ones,
# each with HOOK_TIMEOUT seconds; the spool lock is waited on for at most SPOOL_LOCK_SECONDS.
HOOK_TIMEOUT = 2
HOOK_REPLAYS = 5
SPOOL_LOCK_SECONDS = 1.0
# Runtime intake.json (never in the repo): {"key": ..., "hookEnabled": true, "chats": ["<group chat id>", ...]}.
INTAKE_CONFIG_FIELDS = frozenset({"key", "hookEnabled", "chats"})
# Gateway hook observed for intake. Not verified against the running gateway (plan, stop point 3).
INTAKE_HOOK = "pre_gateway_dispatch"
LOG = logging.getLogger("libetech_ai_os_bridge")
POSITIVE = re.compile(r"[1-9][0-9]{0,19}\Z")
APPROVAL_ID = re.compile(r"[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\Z")
UUID = APPROVAL_ID
GROUP_CHAT = re.compile(r"-[1-9][0-9]{0,19}\Z")
MEDIA_GROUP = re.compile(r"[0-9A-Za-z_-]{1,64}\Z")
CODE = re.compile(r"[A-Z0-9_]{1,64}\Z")
# This plugin's own commands. Typed in a group by mistake (a pairing code, say), they never reach intake.
OWN_COMMAND = re.compile(r"/(?:libetech(?:[-_][^\s@]*)?|duyet)(?:@\S*)?", re.IGNORECASE)
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

def _read_private_json(path):
    """An owner-only JSON object. Missing, a symlink, or not a JSON object: BRIDGE_NOT_CONFIGURED."""
    if path.is_symlink() or path.parent.is_symlink() or not path.is_file():
        raise ValueError("BRIDGE_NOT_CONFIGURED")
    if stat.S_IMODE(path.stat().st_mode) & 0o077:
        raise ValueError("BRIDGE_CONFIG_PERMISSIONS")
    try:
        value = json.loads(path.read_text())
    except (OSError, ValueError):
        raise ValueError("BRIDGE_NOT_CONFIGURED") from None
    if not isinstance(value, dict):
        raise ValueError("BRIDGE_NOT_CONFIGURED")
    return value

def _key_of(config):
    key = config.get("key")
    if not isinstance(key, str) or len(key) < 43:
        raise ValueError("BRIDGE_NOT_CONFIGURED")
    return key

def _read_key(path):
    return _key_of(_read_private_json(path))

def call_backend(home, payload, *, path="/api/bridge", key_file="bridge.json", timeout=5):
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
        response = opener.open(request, timeout=timeout)
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

def _failure_kind(error):
    """How the intake path treats one failed POST.
    network:  no answer (status 0, OSError, HTTPException). Kept in order and retried; never counted.
    answered: the backend answered 404, 408, 429 or 5xx. Retried, counted against SPOOL_MAX_ATTEMPTS and SPOOL_MAX_AGE.
    disabled: this gateway's intake key file is missing or unsafe. Nothing new is spooled; what is spooled stays.
    final:    anything else, including 401 and 403. Retrying cannot help: the message is dropped with its code."""
    if isinstance(error, BackendError):
        if error.status == 0:
            return "network"
        return "answered" if error.status >= 500 or error.status in (404, 408, 429) else "final"
    if isinstance(error, ValueError):
        return "disabled" if str(error) in ("BRIDGE_NOT_CONFIGURED", "BRIDGE_CONFIG_PERMISSIONS") else "final"
    return "network" if isinstance(error, (OSError, http.client.HTTPException)) else "final"

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

# An optional field the gateway handed over malformed: left out of the body and logged by name, never guessed.
_DROPPED = object()

def _optional_id(value):
    if value is None or value == "":
        return None
    if type(value) is int:
        value = str(value)
    return value if isinstance(value, str) and POSITIVE.fullmatch(value) else _DROPPED

def _optional_album(value):
    if value is None or value == "":
        return None
    if type(value) is int:
        value = str(value)
    return value if isinstance(value, str) and MEDIA_GROUP.fullmatch(value) else _DROPPED

def _parse_iso(value):
    """An aware ISO 8601 time, or None (naive, unreadable or not a string)."""
    if not isinstance(value, str) or len(value) > 40:
        return None
    try:
        moment = datetime.fromisoformat(value[:-1] + "+00:00" if value.endswith("Z") else value)
    except ValueError:
        return None
    return moment if moment.utcoffset() is not None else None

def _optional_stamp(value):
    """An aware datetime, epoch seconds (Telegram's `date`) or an aware ISO string, as the wire time. None when absent;
    _DROPPED when naive or unreadable, so a naive time is never read as UTC and never replaced by "now"."""
    if value is None or value == "":
        return None
    if isinstance(value, str):
        value = _parse_iso(value)
    try:
        if isinstance(value, datetime) and value.utcoffset() is not None:
            return _iso(value)
        if type(value) in (int, float) and value > 0:
            return _iso(datetime.fromtimestamp(value, timezone.utc))
    except (OverflowError, OSError, ValueError):
        pass
    return _DROPPED

def _own_command(text):
    words = text.split(None, 1)
    return bool(words) and OWN_COMMAND.fullmatch(words[0]) is not None

def intake_event(event, chats=None):
    """Intake body built from the gateway's own event object; identity and placement never come from the text.
    None: not a person's message in a Telegram group of the libetech profile, a route the gateway rejected, a chat not
    in `chats` (the gateway-side allowlist from intake.json, which the hook always passes; the server's allowlist stays
    authoritative), no `chats` at all (None: fails closed, never permissive), one of this plugin's own commands, or an
    empty message without a file. Never raises for a malformed
    optional field: that field is dropped with INTAKE_FIELD_DROPPED in the log and the message is still recorded."""
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
    # Before anything is downloaded, spooled or posted: only the chats this gateway may take. No list: none.
    if chats is None or context["chatId"] not in chats:
        return None
    text = getattr(event, "text", "")
    text = text.encode("utf-8", "replace").decode("utf-8") if isinstance(text, str) else ""
    if _own_command(text):
        return None
    if not text.strip() and getattr(event, "attachment", None) is None:
        return None
    dropped = []
    def optional(name, value):
        if value is _DROPPED:
            dropped.append(name)
            return None
        return value
    topic = optional("topicId", _optional_id(getattr(source, "thread_id", None)))
    reply = optional("replyToMessageId", _optional_id(getattr(event, "reply_to_message_id", None)))
    album = optional("mediaGroupId", _optional_album(getattr(event, "media_group_id", None)))
    edited = optional("editedAt", _optional_stamp(getattr(event, "edited_at", None)))
    # observedAt is required by the intake schema, so an absent or unusable gateway time becomes the time seen here.
    observed = optional("observedAt", _optional_stamp(getattr(event, "timestamp", None))) or _now()
    for name in dropped:
        LOG.warning("libetech intake: %s %s", "INTAKE_FIELD_DROPPED", name)
    if album:
        context["mediaGroupId"] = album
    if topic:
        context["topicId"] = topic
    if reply:
        context["replyToMessageId"] = reply
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
    # PostgreSQL text refuses U+0000, so NUL is removed from the text that is SENT, after hashing: contentHash stays
    # the hash of the full original text (brief), so it is not the hash of the sent text when a NUL was removed.
    # Removing NUL alone does not set textTruncated.
    text = text.replace("\x00", "")
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
    """Exclusive spool lock, never waited on for long: the hook runs in the gateway's dispatch path. Still held by
    another process after SPOOL_LOCK_SECONDS: SPOOL_BUSY (the caller's message is then lost: a known limit)."""
    descriptor = _open_private(path, os.O_RDWR | os.O_CREAT)
    try:
        deadline = time.monotonic() + SPOOL_LOCK_SECONDS
        while True:
            try:
                fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                if time.monotonic() >= deadline:
                    raise ValueError("SPOOL_BUSY") from None
                time.sleep(0.05)
        yield
    finally:
        os.close(descriptor)

def _field(raw, name):
    return raw.get(name) if isinstance(raw, dict) else getattr(raw, name, None)

def _file_name(value):
    if not isinstance(value, str):
        return ""
    name = re.sub(r"[\x00-\x1f\x7f]", "", re.split(r"[\\/]", value)[-1])
    # Bidi overrides, zero-width and other format (Cf) characters can disguise a name such as "x\u202efdp.exe" (Sec M4).
    name = "".join(ch for ch in name if unicodedata.category(ch) != "Cf")
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
        # exist_ok: two hooks may create it at once. Whoever created it, it must be an owner-only real folder.
        folder.mkdir(mode=0o700, exist_ok=True)
        info = os.lstat(folder)
        if not stat.S_ISDIR(info.st_mode) or stat.S_IMODE(info.st_mode) & 0o077:
            raise ValueError("STORE_UNAVAILABLE")
        _write_atomic(folder / digest, bytes(data))
    except (OSError, ValueError):
        return failed("STORE_UNAVAILABLE", len(data))
    result = {"state": "stored", "locator": "gw://libetech/attachments/" + digest, "sha256": digest,
              "mimeType": mime, "sizeBytes": len(data)}
    if name:
        result["fileName"] = name
    return result

def _line(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))

def _spool_entry(line):
    """(entry, first spooled time) of one spool line, or None when the line is not one."""
    try:
        entry = json.loads(line)
    except ValueError:
        return None
    if (not isinstance(entry, dict) or set(entry) != {"firstSpooledAt", "attempts", "event"}
            or type(entry["attempts"]) is not int or entry["attempts"] < 0 or not isinstance(entry["event"], dict)):
        return None
    spooled = _parse_iso(entry["firstSpooledAt"])
    return (entry, spooled) if spooled is not None else None

class Spool:
    """Events the backend could not take yet, oldest first, at most SPOOL_LIMIT, owner-only. One JSON line each:
    {"firstSpooledAt": ISO time, "attempts": retryable answers so far, "event": the intake body}.
    Lines that can never be delivered move to intake-dead.jsonl (owner-only) with a reason, never silently."""
    def __init__(self, home):
        self.home = home

    def _paths(self):
        folder = _runtime_dir(self.home)
        return folder / "intake-spool.jsonl", folder / "intake-spool.lock", folder / "intake-dead.jsonl"

    def pending(self):
        return len(_read_lines(self._paths()[0]))

    def put(self, payload, *, attempts=0):
        path, lock, _ = self._paths()
        line = _line({"firstSpooledAt": _now(), "attempts": attempts, "event": payload})
        with _locked(lock):
            if len(_read_lines(path)) >= SPOOL_LIMIT:
                raise ValueError("SPOOL_FULL")
            _append_line(path, line)

    def drain(self, send, *, limit=None):
        """Replay oldest first with spooled=True, at most `limit` sends. Returns the number sent.
        No answer (network) or no usable key: stop, keep the line and its order, count nothing.
        Answered 404/408/429/5xx: count one attempt; at SPOOL_MAX_ATTEMPTS, or when spooled longer than SPOOL_MAX_AGE,
        the line moves to the dead-letter file (INTAKE_DEAD_LETTER) and the drain continues; otherwise it stays at
        the head with its new count. Any other refusal (401, 403, 422...): dropped with its code, the drain continues.
        Sending twice after a crash is harmless: the backend keys events by chat and message id."""
        path, lock, dead_path = self._paths()
        lines = _read_lines(path)
        now = datetime.now(timezone.utc)
        sent = calls = start = index = 0
        dead, head = [], []
        def bury(value, reason):
            dead.append(_line(dict(value, deadAt=_now(), reason=reason)))
            LOG.warning("libetech intake spool: %s %s", "INTAKE_DEAD_LETTER", reason)
        try:
            while index < len(lines):
                parsed = _spool_entry(lines[index])
                if parsed is None:
                    bury({"line": lines[index]}, "SPOOL_LINE_UNREADABLE")
                    index += 1
                    continue
                if limit is not None and calls >= limit:
                    break
                entry, spooled_at = parsed
                calls += 1
                try:
                    send(dict(entry["event"], spooled=True))
                    sent += 1
                except Exception as error:
                    kind = _failure_kind(error)
                    if kind in ("network", "disabled"):
                        break
                    if kind == "final":
                        LOG.warning("libetech intake spool dropped one event: %s", safe_error(error)["error"])
                    else:
                        entry["attempts"] += 1
                        if entry["attempts"] >= SPOOL_MAX_ATTEMPTS:
                            bury(entry, "INTAKE_RETRY_LIMIT")
                        elif now - spooled_at > SPOOL_MAX_AGE:
                            bury(entry, "INTAKE_TOO_OLD")
                        else:
                            head = [_line(entry)]
                            index += 1
                            break
                index += 1
                if index - start >= 50:
                    self._commit(path, lock, dead_path, lines[start:index], [], dead)
                    start, dead = index, []
        finally:
            self._commit(path, lock, dead_path, lines[start:index], head, dead)
        return sent

    @staticmethod
    def _commit(path, lock, dead_path, consumed, head, dead):
        """Replace the lines this drain settled by `head` (the head line with its new count, if any), after appending
        the dead ones. Nothing is written if another drain settled the same lines first."""
        if not consumed:
            return
        with _locked(lock):
            current = _read_lines(path)
            if current[:len(consumed)] != consumed:
                return
            if dead:
                _append_line(dead_path, "\n".join(dead))
            _write_atomic(path, "".join(line + "\n" for line in head + current[len(consumed):]).encode())

def submit_event(home, payload, spool, *, timeout=5, replays=None):
    """Post one fitted event on the intake key. Spooled events go first (at most `replays` of them), so the backend
    never sees a newer message before an older one; while any remain, the new message is spooled behind them.
    No answer: spooled. Answered 404/408/429/5xx: spooled with that answer counted. 401, 403 and other refusals:
    dropped, the code returned. Intake key file missing or unsafe: nothing is spooled. A full spool raises SPOOL_FULL."""
    def post(event):
        return call_backend(home, event, path=INTAKE_PATH, key_file="intake.json", timeout=timeout)
    if spool.pending():
        spool.drain(post, limit=replays)
        if spool.pending():
            spool.put(payload)
            return {"ok": False, "spooled": True}
    try:
        return {"ok": True, "data": post(payload)}
    except Exception as error:
        kind = _failure_kind(error)
        if kind not in ("network", "answered"):
            return {"ok": False, "error": safe_error(error)["error"]}
        spool.put(payload, attempts=1 if kind == "answered" else 0)
        return {"ok": False, "spooled": True}

def _intake_config(home):
    """Runtime intake.json, read on every hook call so an operator can switch intake off without a restart.
    "hookEnabled" must be the JSON value true for the hook to do anything (absent: false). "chats" lists the group chat
    ids this gateway may take; it mirrors the server's intake.chats, which stays authoritative (absent: none).
    Missing or malformed: BRIDGE_NOT_CONFIGURED; unsafe mode: BRIDGE_CONFIG_PERMISSIONS; any other field or a wrong
    type: INTAKE_CONFIG_INVALID."""
    config = _read_private_json(_runtime_dir(home) / "intake.json")
    _key_of(config)
    enabled = config.get("hookEnabled", False)
    chats = config.get("chats", [])
    if (set(config) - INTAKE_CONFIG_FIELDS or type(enabled) is not bool or not isinstance(chats, list)
            or not all(isinstance(chat, str) and GROUP_CHAT.fullmatch(chat) for chat in chats)):
        raise ValueError("INTAKE_CONFIG_INVALID")
    return {"hookEnabled": enabled, "chats": frozenset(chats)}

def _intake_hook_enabled(home):
    """Registration only: an absent intake.json is the ordinary case and says nothing; a present one that cannot be
    used is logged by code."""
    if not os.path.lexists(Path(home) / "runtime/libetech-ai-os/intake.json"):
        return False
    try:
        return _intake_config(home)["hookEnabled"]
    except Exception as error:
        LOG.warning("libetech intake hook not registered: %s", safe_error(error)["error"])
        return False

def intake_hook(profile_home, /, *args, **kwargs):
    """Observe one gateway message. Always None: never blocks, rewrites or reroutes dispatch, never raises into the
    gateway, and logs fixed codes only (no text, chat id or name). `profile_home` is positional-only, so a gateway
    keyword named `home` (or anything else) cannot collide with it.
    Bounded work: intake.json first (missing or malformed: nothing else happens); a chat outside its "chats" stops
    before download, spool or POST; then at most HOOK_REPLAYS spooled events and one live POST, each with HOOK_TIMEOUT."""
    try:
        config = _intake_config(profile_home)
        if not config["hookEnabled"]:
            return None
        event = kwargs["event"] if "event" in kwargs else (args[0] if args else None)
        payload = intake_event(event, chats=config["chats"])
        if payload is None:
            return None
        raw = getattr(event, "attachment", None)
        if raw is not None:
            # WIRING-STEP VERIFICATION ITEM: the download stays inline in the gateway's dispatch path, up to
            # MAX_ATTACHMENT_BYTES, with whatever timeout the gateway's download_attachment() has. Check that it is safe
            # there (thread, timeout, side effects) before "hookEnabled" is set on a real gateway.
            payload["attachment"] = store_attachment(profile_home, raw, getattr(event, "download_attachment", None))
        result = submit_event(profile_home, fit_event(payload), Spool(profile_home),
                              timeout=HOOK_TIMEOUT, replays=HOOK_REPLAYS)
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

def _deliver(item, send, journal, summary, allowed):
    """`allowed`: the group chat ids of intake.json "chats". A group target outside it is refused before anything is
    journaled or sent (Security M5: the target comes from the backend; this is defence in depth). DM targets are the
    linked private chats the backend checks, not group chats, so the list does not apply to them."""
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
        if item.get("audience") == "group" and chat_id not in allowed:
            raise ValueError("TARGET_NOT_ALLOWED")
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
        allowed = _intake_config(home)["chats"] if pulled["deliveries"] else frozenset()
        fresh = [receipt for receipt in (_deliver(item, send, journal, summary, allowed) for item in pulled["deliveries"]) if receipt]
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
                return "Không có phiếu cần xác nhận."
            recorded, kinds = [], set()
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
                kinds.add(row.get("kind", "registration"))
            # Say what the vote did not do for the kinds actually voted on (code m-9): a vote never applies anything.
            not_done = ("Chưa tự áp quyền mới hay cấp lời mời nào." if kinds == set(APPROVAL_KINDS)
                        else "Chưa tự áp quyền mới." if kinds == {"access_change"} else "Chưa tự cấp lời mời.")
            return "Đã ghi lựa chọn Telegram: " + "; ".join(recorded) + ". " + not_done
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
    # Intake is a separate principal with its own key file, and its hook is a deliberate step: only with gateway hook
    # support and "hookEnabled": true in intake.json (the key file alone is not enough). Otherwise the plugin registers
    # exactly what it did before. The hook only observes; the real send and outbox schedule are not wired.
    if hasattr(ctx, "register_hook") and _intake_hook_enabled(home):
        try:
            ctx.register_hook(INTAKE_HOOK, functools.partial(intake_hook, home))
        except Exception as error:
            LOG.warning("libetech intake hook not registered: %s", safe_error(error)["error"])
