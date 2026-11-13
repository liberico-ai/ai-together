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
python3 "$bundle/deploy/verify-bundle.py" "$bundle"
# Group IDs live on the server (LIBETECH_PILOT_CHATS, pass it through sudo); validate before creating anything.
python3 "$bundle/deploy/provision-server.py" --preflight
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
cp -a "$bundle/." /opt/libetech-ai-os/app/
chown -R libetech-os:libetech-os /opt/libetech-ai-os/app
runuser -u libetech-os -- env PATH=/opt/libetech-ai-os/node/bin:/usr/bin:/bin bash -c 'cd /opt/libetech-ai-os/app && npm ci --ignore-scripts && npm run build'
chown -R root:root /opt/libetech-ai-os/app /opt/libetech-ai-os/node
chmod -R a+rX /opt/libetech-ai-os/app /opt/libetech-ai-os/node
chmod -R go-w /opt/libetech-ai-os/app /opt/libetech-ai-os/node
pg_createcluster "$major" libetech-ai-os --port 5547 --start
runuser -u postgres -- createdb -p 5547 libetech_ai_os
for migration in "$bundle"/migrations/*.sql; do
 runuser -u postgres -- psql -X -q -v ON_ERROR_STOP=1 -p 5547 -d libetech_ai_os < "$migration"
done
# Archive must exclude schema_migrations data. Schema has already been installed above.
runuser -u postgres -- pg_restore --exit-on-error --single-transaction --data-only --no-owner -p 5547 -d libetech_ai_os < "$dump"
python3 "$bundle/deploy/provision-server.py"
install -m 644 "$bundle/deploy/libetech-ai-os.service" /etc/systemd/system/libetech-ai-os.service
systemctl daemon-reload
systemctl enable --now libetech-ai-os.service
curl --fail --retry 10 --retry-delay 1 --retry-connrefused --silent http://127.0.0.1:3148/api/health
echo
echo 'Backend is private on 127.0.0.1:3148. Existing gateway was not restarted.'
echo 'Installing the independent bridge through the standard Hermes scanner; answer any scanner consent prompt yourself.'
runuser -u iptech -- env HERMES_HOME=/home/iptech/.hermes/profiles/libetech /home/iptech/.local/bin/hermes plugins install /opt/libetech-ai-os/app/bot-plugin
echo 'Record the activation receipt. If it requests a shared gateway restart, stop for explicit approval.'
