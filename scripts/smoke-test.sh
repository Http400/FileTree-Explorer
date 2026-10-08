#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "Smoke check failed: $*" >&2
  exit 1
}

[[ $# == 2 ]] || fail "usage: bash scripts/smoke-test.sh URL EXPECTED_SHA"
base_url=${1%/}
expected_sha=$2
[[ $base_url =~ ^https?://[^/]+$ ]] || fail "URL must be an HTTP(S) origin"
[[ $expected_sha =~ ^[0-9a-f]{40}$ ]] || fail "expected revision must be a full SHA"

work=$(mktemp -d)
trap 'rm -f "$work/headers" "$work/body" "$work/index"; rmdir "$work"' EXIT

fetch() {
  local status
  status=$(curl --fail --silent --show-error --path-as-is --compressed \
    --connect-timeout 5 --max-time 15 \
    --dump-header "$work/headers" --output "$work/body" \
    --write-out '%{http_code}' "$base_url$1")
  [[ $status == 200 ]] || fail "$1 returned $status instead of 200"
}

# Retry only readiness; the remaining assertions must pass on the same release.
curl --fail --silent --show-error --connect-timeout 5 --max-time 15 \
  --retry 5 --retry-delay 2 --retry-all-errors \
  --output "$work/body" "$base_url/healthz"
[[ $(cat "$work/body") == ok ]] || fail "unexpected health response"

fetch /version.txt
[[ $(cat "$work/body") == "$expected_sha" ]] || fail "unexpected deployed revision"
grep -Eiq '^cache-control:.*no-cache' "$work/headers" || fail "revision must revalidate"

fetch /
grep -Fq '<div id="root"></div>' "$work/body" || fail "missing application shell"
grep -Eiq '^content-type: *text/html' "$work/headers" || fail "expected HTML"
grep -Eiq '^cache-control:.*no-cache' "$work/headers" || fail "HTML must revalidate"
cp "$work/body" "$work/index"
asset=$(sed -nE 's/.*src="(\/assets\/[^"]+\.js)".*/\1/p' "$work/index")
[[ $asset =~ ^/assets/[a-zA-Z0-9._-]+\.js$ ]] || fail "missing bundled JavaScript"

for route in /tree /tree/root%2Fsrc /tree/root%2Fa%252Fb \
  /tree/root%2Findex.js '/tree/root%2Fsrc?q=Button'; do
  fetch "$route"
  cmp -s "$work/index" "$work/body" || fail "$route did not serve the SPA shell"
done

fetch "$asset"
grep -Eiq '^content-type: *(application|text)/javascript' "$work/headers" \
  || fail "asset is not JavaScript"
grep -Eiq '^cache-control:.*immutable' "$work/headers" || fail "asset is not immutable"
[[ -s $work/body ]] || fail "empty JavaScript asset"

status=$(curl --silent --show-error --connect-timeout 5 --max-time 15 \
  --output "$work/body" --write-out '%{http_code}' \
  "$base_url/assets/filetree-missing-$expected_sha.js")
[[ $status == 404 ]] || fail "missing asset returned $status instead of 404"

fetch /version.txt
[[ $(cat "$work/body") == "$expected_sha" ]] || fail "revision changed during checks"
echo "Smoke checks passed for $base_url at $expected_sha"
