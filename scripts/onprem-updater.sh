#!/bin/sh
set -eu

MANIFEST_PATH="${1:-${PLATFORM_UPDATE_MANIFEST_PATH:-./platform-release.json}}"
COMPOSE_FILE="${PLATFORM_COMPOSE_FILE:-docker-compose.ha.yml}"
READY_URL="${PLATFORM_READY_URL:-http://localhost/api/v1/health/ready}"

for command in jq openssl docker curl; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "Required command is missing: $command" >&2
    exit 1
  }
done

[ -f "$MANIFEST_PATH" ] || {
  echo "Manifest not found: $MANIFEST_PATH" >&2
  exit 1
}
[ -n "${PLATFORM_UPDATE_PUBLIC_KEY:-}" ] || {
  echo "PLATFORM_UPDATE_PUBLIC_KEY is required" >&2
  exit 1
}

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT HUP INT TERM

jq -e '
  (.version | type == "string" and length > 0) and
  (.releaseDate | type == "string" and length > 0) and
  (.images | type == "object" and length > 0) and
  ([.images[] | test("^(?:[A-Za-z0-9._/:~-]+@)?sha256:[0-9a-fA-F]{64}$")] | all) and
  (.checksum | test("^sha256:[0-9a-fA-F]{64}$")) and
  (.signature.algorithm == "Ed25519") and
  (.signature.encoding == "base64") and
  (.signature.value | type == "string" and length > 0)
' "$MANIFEST_PATH" >/dev/null

jq -cj '{version,releaseDate,images:(.images|to_entries|sort_by(.key)|from_entries)}' \
  "$MANIFEST_PATH" > "$tmp_dir/payload.json"

expected_checksum="$(jq -r '.checksum' "$MANIFEST_PATH")"
actual_checksum="sha256:$(openssl dgst -sha256 "$tmp_dir/payload.json" | awk '{print $NF}')"
if [ "$expected_checksum" != "$actual_checksum" ]; then
  echo "Platform manifest checksum verification failed" >&2
  exit 1
fi

printf '%b' "$PLATFORM_UPDATE_PUBLIC_KEY" > "$tmp_dir/public.pem"
jq -r '.signature.value' "$MANIFEST_PATH" | openssl base64 -d -A > "$tmp_dir/signature.bin"
openssl pkeyutl -verify -pubin -inkey "$tmp_dir/public.pem" -rawin \
  -in "$tmp_dir/payload.json" -sigfile "$tmp_dir/signature.bin" >/dev/null

version="$(jq -r '.version' "$MANIFEST_PATH")"
api_image="$(jq -r '.images.api // empty' "$MANIFEST_PATH")"
web_image="$(jq -r '.images.web // empty' "$MANIFEST_PATH")"
[ -n "$api_image" ] && [ -n "$web_image" ] || {
  echo "Manifest images must include api and web" >&2
  exit 1
}
case "$api_image" in
  sha256:*) api_image="${PLATFORM_API_IMAGE_REPOSITORY:?Set PLATFORM_API_IMAGE_REPOSITORY for digest-only manifests}@$api_image" ;;
esac
case "$web_image" in
  sha256:*) web_image="${PLATFORM_WEB_IMAGE_REPOSITORY:?Set PLATFORM_WEB_IMAGE_REPOSITORY for digest-only manifests}@$web_image" ;;
esac
printf '%s\n%s\n' "$api_image" "$web_image" |
  jq -R -s -e 'split("\n")[:-1] | all(test("^[A-Za-z0-9._/:~-]+@sha256:[0-9a-fA-F]{64}$"))' >/dev/null

cat > "$tmp_dir/signed-images.yml" <<EOF
services:
  api:
    image: $api_image
    pull_policy: always
  worker:
    image: $api_image
    pull_policy: always
  collector:
    image: $api_image
    pull_policy: always
  web:
    image: $web_image
    pull_policy: always
EOF

echo "Verified signed platform release $version."
echo "Backup hint: run ./scripts/backup.sh before continuing, and retain the current image IDs."
docker compose -f "$COMPOSE_FILE" -f "$tmp_dir/signed-images.yml" images -q > "$tmp_dir/previous-images.txt" || true

if ! docker compose -f "$COMPOSE_FILE" -f "$tmp_dir/signed-images.yml" pull ||
   ! docker compose -f "$COMPOSE_FILE" -f "$tmp_dir/signed-images.yml" up -d --remove-orphans; then
  echo "Update failed. Roll back by restoring the previous compose/image pins and run:" >&2
  echo "  docker compose -f $COMPOSE_FILE up -d" >&2
  exit 1
fi

ready=false
attempt=1
while [ "$attempt" -le 30 ]; do
  if curl --fail --silent --show-error "$READY_URL" >/dev/null; then
    ready=true
    break
  fi
  sleep 5
  attempt=$((attempt + 1))
done

if [ "$ready" != true ]; then
  echo "Release $version started but readiness failed at $READY_URL." >&2
  echo "Inspect 'docker compose -f $COMPOSE_FILE logs' and roll back to the image IDs recorded before this update." >&2
  exit 1
fi

echo "Platform release $version is ready."
