# LibeTech AI OS Hermes portal 0.1.0

Authorized 2026-11-08: server web login through Hermes, private Telegram pairing and read-only pilot verification. This dashboard transport complements AI OS 0.2.0 and bridge 0.2.1. Domain/identity authorization remains in the TypeScript backend; no business writes or direct database access exist here.

Install with the normal Hermes plugin Git admission flow, pinned to the package commit, in the default dashboard profile. Secondary Hermes profiles intentionally strip cookies over plugin IPC; this portal denies those profiles rather than weakening that boundary. The UI explicitly targets `profile=default` and uses the supported authenticated Hermes SDK. A separate AI OS login remains mandatory.

Only six exact method/path pairs reach fixed loopback `127.0.0.1:3148`. The public browser origin is `https://hermes.btnet.vn`. The proxy checks Hermes admission, profile, Host, Origin, content type and body size. It forwards only the AI OS cookie, scoped back to this plugin API with Secure/HttpOnly/SameSite=Strict. It never reads bridge keys, forwards Hermes credentials, follows redirects, logs sensitive bodies or permits business/bridge endpoints.

Before use, configure the existing web service with `LIBETECH_ORIGIN=https://hermes.btnet.vn` and `LIBETECH_LOCAL_AUTH=0`, preserving every other environment value. Restart only `libetech-ai-os.service`. No database restore, credential rotation, existing plugin replacement or shared gateway restart is needed. User enters the password and handles pairing code privately; do not capture the screen while a code/password is shown.

Validation: `python3 -m unittest discover -s tests -v`; `node --check dashboard/dist/index.js`. These tests use a fake upstream and cannot prove live login or Telegram delivery.

Rollback: disable only this plugin through Hermes; restore the protected pre-change web.env and restart only the new web service. Leave database and all existing bot profiles untouched.
