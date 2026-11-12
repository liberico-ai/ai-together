#!/bin/sh
set -eu
runtime_dir=$(mktemp -d)
container="libetech-spec004-fixture-$$"
cleanup() {
  docker stop "$container" >/dev/null 2>&1 || true
  rm -f "$runtime_dir/postgres.env"
  rmdir "$runtime_dir"
}
trap cleanup EXIT
umask 077
SPEC004_TEMP_PASSWORD=$(node -e 'process.stdout.write(require("node:crypto").randomBytes(24).toString("hex"))')
export SPEC004_TEMP_PASSWORD
printf '%s\n' POSTGRES_USER=spec004_operator POSTGRES_DB=spec004_verify "POSTGRES_PASSWORD=$SPEC004_TEMP_PASSWORD" > "$runtime_dir/postgres.env"
docker run --pull never --rm --detach --name "$container" --env-file "$runtime_dir/postgres.env" \
  --publish 127.0.0.1:35448:5432 postgres:16 >/dev/null
attempt=0
until docker exec "$container" pg_isready -h 127.0.0.1 -d spec004_verify -U spec004_operator >/dev/null 2>&1; do
  attempt=$((attempt+1))
  if [ "$attempt" -ge 40 ]; then exit 1; fi
  sleep 1
done
node scripts/native-spec004-fixture.mjs
