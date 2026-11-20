#!/usr/bin/env bash
# Operator-run initial installation only. Refuses to overwrite an existing deployment.
set -euo pipefail
umask 077
[[ $(id -u) == 0 ]] || { echo 'Run this reviewed installer with sudo on d1-ai1.' >&2; exit 1; }
[[ $(hostname) == d1-ai1 ]] || { echo 'Wrong host; expected d1-ai1.' >&2; exit 1; }
bundle=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
dump=${1:?Provide the private pilot data archive as the first argument}
[[ -f "$dump" && ! -L "$dump" ]] || { echo 'Missing regular pilot archive.' >&2; exit 1; }
[[ ! -e /opt/libetech-ai-os && ! -e /var/lib/libetech-ai-os && ! -e /etc/libetech-ai-os ]] || { echo 'Existing installation found. Use a reviewed upgrade, never overwrite it.' >&2; exit 1; }
[[ ! -e /home/iptech/.hermes/profiles/libetech/plugins/libetech-ai-os-bridge ]] || { echo 'Bridge already exists; reconcile before installing.' >&2; exit 1; }
node_source=/home/iptech/.hermes/tools/node-26.12.1-linux-x64
[[ -x "$node_source/bin/node" && -f "$node_source/lib/node_modules/npm/bin/npm-cli.js" ]] || { echo 'Verified Node distribution is missing; stop for review.' >&2; exit 1; }
if ss -ltnH | awk '{print $4}' | grep -Eq ':(3148|5547)$'; then echo 'A target port is occupied; stop for review.' >&2; exit 1; fi
# The release that is to be installed is named by the operator, from the packaging step (the sourceTree that scripts/package-release.py prints), never from beside the bundle: a manifest that is
# consistent for a changed file passes every check that the bundle can make of itself. Like the archive digest below, it is required and is not printed.
release_sha=${LIBETECH_BUNDLE_TREE_SHA256:-}
[[ "$release_sha" =~ ^[0-9a-f]{64}$ ]] || { echo 'Pass the digest of the release (64 lowercase hex digits; the sourceTree that scripts/package-release.py printed) as LIBETECH_BUNDLE_TREE_SHA256.' >&2; exit 1; }
# N4 (DELIVERY-016): nothing is run from the bundle before it has been copied. The bundle lies where the account that the gateway shares may write it, and the build below runs as another
# account in the copy under /opt, so neither is a place to run a verifier or a restore file from with the rights of root or of postgres. Root takes ONE snapshot of the bundle into a directory
# only root can enter, and verifies the snapshot with the checker below, which is part of THIS reviewed script and not read from the bundle; from then on everything that runs as root or as
# postgres is read from the snapshot. The copy under /opt is made from it. What the operator reviewed is this script; the release is named by the digest above.
work=$(mktemp -d /root/.libetech-restore.XXXXXX)
held="$work/archive.dump"
snap="$work/bundle"
trap 'rm -f "$held"; rm -rf -- "$snap"; rmdir "$work" 2>/dev/null || true' EXIT
# The checker prints the tree digest that it computed. It verifies, in the whole tree it is given: the digest of the manifest (recomputed from the file hashes it lists), the hash of every listed
# file (no symlinks, nothing outside the tree), that the tree holds nothing else (a file that python or psql would pick up as root: an unlisted file, a symlink or a symlinked directory, bytecode
# or a bytecode cache; only the two manifests that the packaging writes are allowed besides the listed files), and that the files that the restore runs are listed. python3 -I: nothing from the
# environment or from the tree is imported.
check_bundle() {
 python3 -I - "$1" <<'PY'
import hashlib,json,os,sys
root=os.path.realpath(sys.argv[1])
manifest=json.load(open(root+"/deploy/BUNDLE-MANIFEST.json"))
files=manifest["files"]
tree=hashlib.sha256(json.dumps(files,sort_keys=True,separators=(",",":")).encode()).hexdigest()
if tree!=manifest["treeSha256"]:sys.exit("manifest digest mismatch")
for name,expected in files.items():
    path=os.path.join(root,name)
    if os.path.islink(path) or not os.path.realpath(path).startswith(root+os.sep) or not os.path.isfile(path):sys.exit("invalid bundle path")
    if hashlib.sha256(open(path,"rb").read()).hexdigest()!=expected:sys.exit("bundle content mismatch")
present=set()
for directory,dirs,names in os.walk(root):
    for d in dirs:
        if os.path.islink(os.path.join(directory,d)) or d=="__pycache__":sys.exit("symlinked directory or bytecode cache in bundle")
    for n in names:
        path=os.path.join(directory,n)
        if os.path.islink(path) or n.endswith((".pyc",".pyo")):sys.exit("symlink or bytecode in bundle")
        present.add(os.path.relpath(path,root))
if present-(set(files)|{"deploy/BUNDLE-MANIFEST.json","docs/SOURCE-MANIFEST.json"}):sys.exit("unlisted file in bundle")
for need in ("deploy/pre-restore.sql","deploy/post-restore.sql","deploy/restore-plan.py","migrations/023_thread_order.sql"):
    if need not in files:sys.exit("restore file not listed")
print(tree)
PY
}
mkdir "$snap"
cp -a "$bundle/." "$snap/"
tree=$(check_bundle "$snap") || { echo 'The bundle does not pass the checks of the installer (manifest, hashes, unlisted files, restore files); package the release again. Nothing was installed.' >&2; exit 1; }
[[ "$tree" == "$release_sha" ]] || { echo 'The bundle is not the release that LIBETECH_BUNDLE_TREE_SHA256 names; nothing was installed.' >&2; exit 1; }
# Group IDs live on the server (LIBETECH_PILOT_CHATS, pass it through sudo); validate before creating anything.
python3 "$snap/deploy/provision-server.py" --preflight
# The archive is read ONCE. It is loaded with the rights of a superuser and with every guard of the database off, and it lies where the account that the gateway shares can write it. So: copy it
# to a file that only root can read, check that copy against the SHA-256 recorded when the archive was made (LIBETECH_ARCHIVE_SHA256: from the operator, never from beside the archive; pass it
# through sudo like LIBETECH_PILOT_CHATS; integrity, not identity), and let every later step read the copy. The copy is not kept after a restore that passed.
archive_sha=${LIBETECH_ARCHIVE_SHA256:-}
[[ "$archive_sha" =~ ^[0-9a-f]{64}$ ]] || { echo 'Pass the SHA-256 (64 lowercase hex digits) recorded when the archive was made as LIBETECH_ARCHIVE_SHA256.' >&2; exit 1; }
cat -- "$dump" > "$held"
[[ $(sha256sum "$held" | cut -d' ' -f1) == "$archive_sha" ]] || { echo 'The archive does not match LIBETECH_ARCHIVE_SHA256; nothing was loaded.' >&2; exit 1; }
if ! command -v pg_createcluster >/dev/null; then
 apt-get update
 DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql
fi
major=$(pg_lsclusters -h | awk '{print $1}' | sort -nu | tail -1)
[[ "$major" =~ ^[0-9]+$ && "$major" -ge 16 ]] || { echo 'PostgreSQL 16 or newer is required.' >&2; exit 1; }
if pg_lsclusters -h | awk '{print $2}' | grep -qx 'libetech-ai-os'; then echo 'Cluster already exists; stop for review.' >&2; exit 1; fi
getent passwd libetech-os >/dev/null || useradd --system --home-dir /var/lib/libetech-ai-os --shell /usr/sbin/nologin libetech-os
install -d -o root -g root -m 755 /opt/libetech-ai-os
install -d -o libetech-os -g libetech-os -m 700 /var/lib/libetech-ai-os
install -d -o root -g root -m 700 /etc/libetech-ai-os
cp -a "$node_source" /opt/libetech-ai-os/node
install -d -o libetech-os -g libetech-os -m 755 /opt/libetech-ai-os/app
cp -a "$snap/." /opt/libetech-ai-os/app/
chown -R libetech-os:libetech-os /opt/libetech-ai-os/app
runuser -u libetech-os -- env PATH=/opt/libetech-ai-os/node/bin:/usr/bin:/bin bash -c 'cd /opt/libetech-ai-os/app && npm ci --ignore-scripts && npm run build'
chown -R root:root /opt/libetech-ai-os/app /opt/libetech-ai-os/node
chmod -R a+rX /opt/libetech-ai-os/app /opt/libetech-ai-os/node
chmod -R go-w /opt/libetech-ai-os/app /opt/libetech-ai-os/node
# The copy under /opt is what the service runs and is built by another account, as before N4; nothing below reads anything from it that root or postgres runs: every one of those files
# comes from the snapshot.
pg_createcluster "$major" libetech-ai-os --port 5547 --start
runuser -u postgres -- createdb -p 5547 libetech_ai_os
for migration in "$snap"/migrations/*.sql; do
 runuser -u postgres -- psql -X -q -v ON_ERROR_STOP=1 -p 5547 -d libetech_ai_os < "$migration"
done
# One rule, deploy/restore-plan.py, for what the archive is and how it is loaded; the user-service installer reads the same file. The archive must be data-only, must exclude
# schema_migrations data (the schema was installed above) and must cover every table of the target; a refused archive stops here, before anything is loaded. Each value is read into a
# variable of its own: an error inside $(...) in the argument of another command is not caught by set -e, and what it would leave empty must stop the install, not pass the check.
tables_sql=$(python3 -I "$snap/deploy/restore-plan.py" --tables-sql)
tables=$(runuser -u postgres -- psql -X -q -At -p 5547 -d libetech_ai_os -c "$tables_sql")
[[ -n "$tables_sql" && -n "$tables" ]] || { echo 'The tables of the target could not be read; nothing was checked and nothing was loaded.' >&2; exit 1; }
kind=$(runuser -u postgres -- pg_restore --list < "$held" | python3 -I "$snap/deploy/restore-plan.py" --tables "$tables")
# The target holds no rows: a load with triggers off puts rows beside whatever is there without a guard to say so.
runuser -u postgres -- psql -X -q -v ON_ERROR_STOP=1 -v VERBOSITY=terse -v SHOW_CONTEXT=never -p 5547 -d libetech_ai_os < "$snap/deploy/pre-restore.sql"
# The arguments are a fixed list printed by restore-plan.py: one transaction, triggers off (the schema has foreign keys that no load order satisfies). If the list is not whole the load does not start.
restore_args=$(python3 -I "$snap/deploy/restore-plan.py" --pg-restore-args)
for flag in --exit-on-error --single-transaction --data-only --no-owner --disable-triggers; do
 [[ " $restore_args " == *" $flag "* ]] || { echo 'The arguments of the load are not whole; nothing was loaded.' >&2; exit 1; }
done
read -ra restore_args <<< "$restore_args"
# The message of pg_restore can quote a row (DETAIL, CONTEXT): it is kept in a file that only root can read and is not shown.
if ! runuser -u postgres -- pg_restore "${restore_args[@]}" -p 5547 -d libetech_ai_os < "$held" 2> "$work/restore.err"; then
 echo "The load failed and was rolled back. Its message can quote a row, so it is not shown: it is in $work/restore.err (root only). Read it on this server; do not paste it anywhere." >&2; exit 1
fi
if [[ "$kind" == pre-023 ]]; then
 # An archive from before 023 carries no thread numbers: applying 023 again numbers its revisions (created_at, revision_no, id) and puts its triggers right. It must not carry a position
 # either (that is an archive of which the number tables were cut out at dump time; the numbering would unsay what the positions say).
 positions=$(runuser -u postgres -- psql -X -q -At -p 5547 -d libetech_ai_os -c "$(python3 -I "$snap/deploy/restore-plan.py" --pre-023-check-sql)")
 [[ "$positions" == 0 ]] || { echo 'The archive carries thread positions but not the number tables, or they could not be counted; do not go on with it.' >&2; exit 1; }
 runuser -u postgres -- psql -X -q -v ON_ERROR_STOP=1 -v VERBOSITY=terse -v SHOW_CONTEXT=never -p 5547 -d libetech_ai_os < "$snap/migrations/023_thread_order.sql"
fi
# The check that ends every restore. It passed only if psql exits 0 and its last line is the JSON answer, with the checks of 023 made; nothing that writes to the database starts before it.
post=$(runuser -u postgres -- psql -X -q -At -v ON_ERROR_STOP=1 -v VERBOSITY=terse -v SHOW_CONTEXT=never -p 5547 -d libetech_ai_os < "$snap/deploy/post-restore.sql")
printf '%s\n' "$post" | tail -n 1 | python3 -I -c 'import json,sys; a=json.loads(sys.stdin.read()); sys.exit(0 if a.get("post_restore")=="pass" and a.get("thread_order")=="checked" else 1)' \
 || { echo 'The post-restore check did not pass; nothing was started. See docs/RUNBOOK-RESTORE-AFTER-023.md.' >&2; exit 1; }
# The second copy of the pilot data is not kept after a restore that passed.
rm -f "$held" "$work/restore.err"
python3 "$snap/deploy/provision-server.py"
install -m 644 "$snap/deploy/libetech-ai-os.service" /etc/systemd/system/libetech-ai-os.service
systemctl daemon-reload
systemctl enable --now libetech-ai-os.service
curl --fail --retry 10 --retry-delay 1 --retry-connrefused --silent http://127.0.0.1:3148/api/health
echo
echo 'Backend is private on 127.0.0.1:3148. Existing gateway was not restarted.'
echo 'Installing the independent bridge through the standard Hermes scanner; answer any scanner consent prompt yourself.'
runuser -u iptech -- env HERMES_HOME=/home/iptech/.hermes/profiles/libetech /home/iptech/.local/bin/hermes plugins install /opt/libetech-ai-os/app/bot-plugin
echo 'Record the activation receipt. If it requests a shared gateway restart, stop for explicit approval.'
