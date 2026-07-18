#!/usr/bin/env bash
# verify-bundle.sh — verify the SHA256SUMS manifest of a QS Assets appliance bundle.
#
# Usage:
#   ./verify-bundle.sh [bundle-dir]        (defaults to the script's own directory)
#
# Exits 0 if every file listed in SHA256SUMS matches, non-zero otherwise.
# Also warns about files present in the bundle but missing from the manifest.

set -euo pipefail

BUNDLE_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
SUMS_FILE="${BUNDLE_DIR}/SHA256SUMS"

fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }

[ -d "$BUNDLE_DIR" ] || fail "Not a directory: $BUNDLE_DIR"
[ -f "$SUMS_FILE" ]  || fail "No SHA256SUMS found in $BUNDLE_DIR"

# Pick a checksum tool (sha256sum on Linux, shasum on macOS).
if command -v sha256sum >/dev/null 2>&1; then
  CHECK_CMD=(sha256sum --check --strict)
elif command -v shasum >/dev/null 2>&1; then
  CHECK_CMD=(shasum -a 256 --check --strict)
else
  fail "Neither sha256sum nor shasum is available."
fi

echo "Verifying $(grep -c . "$SUMS_FILE") files against ${SUMS_FILE} ..."
(
  cd "$BUNDLE_DIR"
  "${CHECK_CMD[@]}" SHA256SUMS
) || fail "Checksum verification FAILED — bundle is corrupt or tampered with."

# Report unlisted files (informational; SHA256SUMS itself is expected).
UNLISTED=0
while IFS= read -r f; do
  rel="${f#"$BUNDLE_DIR"/}"
  [ "$rel" = "SHA256SUMS" ] && continue
  [ "$rel" = "SHA256SUMS.sig" ] && continue
  if ! grep -Fq "  ${rel}" "$SUMS_FILE"; then
    printf 'WARN: not covered by SHA256SUMS: %s\n' "$rel" >&2
    UNLISTED=1
  fi
done < <(find "$BUNDLE_DIR" -type f | sort)

if [ "$UNLISTED" -eq 0 ]; then
  echo "OK: all bundle files verified."
else
  echo "OK: listed files verified (warnings above for unlisted files)."
fi
