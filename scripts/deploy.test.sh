#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd "$(dirname "$0")" && pwd)
work=$(mktemp -d)
trap 'find "$work" -depth -delete' EXIT
mkdir "$work/bin"
mkdir "$work/existing-docker-config"
export PATH="$work/bin:$PATH"
export DOCKER_CONFIG="$work/existing-docker-config"
export TEST_ORIGINAL_DOCKER_CONFIG=$DOCKER_CONFIG
export TEST_LOG="$work/docker.log"
export TEST_FAIL_STAGE='' TEST_FAIL_RELEASE='' TEST_LOCKED=''

cat > "$work/bin/flock" <<'SH'
#!/usr/bin/env bash
[[ -z $TEST_LOCKED ]]
SH
cat > "$work/bin/docker" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
[[ $1 == compose && $2 == --project-name && $3 == filetree-explorer ]]
[[ $4 == --file && $6 == --env-file ]]
release=$(basename "$(dirname "$5")")
shift 7
if [[ $1 == pull ]]; then
  [[ -d $DOCKER_CONFIG && $DOCKER_CONFIG != "$TEST_ORIGINAL_DOCKER_CONFIG" ]]
  [[ ! -e $DOCKER_CONFIG/config.json ]]
fi
printf '%s %s\n' "$release" "$*" >> "$TEST_LOG"
if [[ $1 == "$TEST_FAIL_STAGE" && ( $TEST_FAIL_RELEASE == all || $release == "$TEST_FAIL_RELEASE" ) ]]; then
  exit 1
fi
SH
chmod +x "$work/bin/docker" "$work/bin/flock"

old_sha=1111111111111111111111111111111111111111
new_sha=2222222222222222222222222222222222222222
old_id=$old_sha-1-1
new_id=$new_sha-2-1
digest=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
count=0

fixture() {
  count=$((count + 1))
  root="$work/case-$count"
  mkdir -p "$root/releases/$old_id" "$root/releases/$new_id"
  for release in "$old_id" "$new_id"; do
    printf 'APP_IMAGE=ghcr.io/http400/filetree-explorer@sha256:%s\nAPP_PORT=8080\nAPP_SHA=%s\n' \
      "$digest" "${release%%-*}" > "$root/releases/$release/.env"
    cp "$script_dir/../docker-compose.prod.yml" "$root/releases/$release/"
  done
  : > "$TEST_LOG"
  TEST_FAIL_STAGE='' TEST_FAIL_RELEASE='' TEST_LOCKED=''
}

run() {
  bash "$script_dir/deploy.sh" "$1" "$root" "${2:-$new_id}"
}

expect_failure() {
  if "$@" > "$work/output" 2>&1; then
    echo "Expected failure: $*" >&2
    exit 1
  fi
}

assert_state() {
  [[ $(cat "$root/$1") == "$2" ]]
}

fixture
[[ $(run current) == none ]]
run activate
[[ ! -e $root/current ]]
assert_state pending "$new_id"
run finalize
assert_state current "$new_id"
[[ ! -e $root/pending && ! -e $root/previous ]]
[[ $(run current) == "$new_sha" ]]
run finalize

fixture
printf '%s\n' "$old_id" > "$root/current"
run activate
assert_state current "$old_id"
run finalize
assert_state current "$new_id"
assert_state previous "$old_id"
run rollback
assert_state current "$old_id"
[[ ! -e $root/pending && ! -e $root/previous ]]

for stage in config pull; do
  fixture
  printf '%s\n' "$old_id" > "$root/current"
  TEST_FAIL_STAGE=$stage TEST_FAIL_RELEASE=$new_id
  expect_failure run activate
  assert_state current "$old_id"
  [[ ! -e $root/pending ]]
  if grep -q ' up ' "$TEST_LOG"; then echo "Preflight mutated the stack" >&2; exit 1; fi
done

fixture
printf '%s\n' "$old_id" > "$root/current"
TEST_FAIL_STAGE=up TEST_FAIL_RELEASE=$new_id
expect_failure run activate
assert_state current "$old_id"
[[ ! -e $root/pending ]]
grep -q "^$old_id up .*--pull never" "$TEST_LOG"
run rollback

# Public smoke failure occurs after activation, before finalization.
fixture
printf '%s\n' "$old_id" > "$root/current"
run activate
run rollback
assert_state current "$old_id"
[[ ! -e $root/pending ]]
expect_failure run finalize

fixture
printf '%s\n' "$old_id" > "$root/current"
TEST_FAIL_STAGE=up TEST_FAIL_RELEASE=all
expect_failure run activate
assert_state current "$old_id"
assert_state pending "$new_id"
grep -q 'ROLLBACK FAILED' "$work/output"
TEST_FAIL_STAGE='' TEST_FAIL_RELEASE=''
run rollback
[[ ! -e $root/pending ]]

fixture
TEST_FAIL_STAGE=up TEST_FAIL_RELEASE=$new_id
expect_failure run activate
[[ ! -e $root/current && ! -e $root/pending ]]
grep -q 'No previous release exists' "$work/output"
grep -q "^$new_id down" "$TEST_LOG"

fixture
run activate
expect_failure run rollback
[[ ! -e $root/current && ! -e $root/pending ]]

# Simulate losing SSH after writing current but before removing pending.
fixture
printf '%s\n' "$old_id" > "$root/previous"
printf '%s\n' "$new_id" > "$root/current"
printf '%s\n' "$new_id" > "$root/pending"
run rollback
assert_state current "$old_id"
[[ ! -e $root/pending ]]

fixture
printf '%s\n' "$old_id" > "$root/pending"
expect_failure run activate
expect_failure run rollback
assert_state pending "$old_id"
[[ ! -s $TEST_LOG ]]

fixture
printf 'invalid\n' > "$root/pending"
expect_failure run activate
[[ ! -s $TEST_LOG ]]

fixture
TEST_LOCKED=yes
expect_failure run activate
[[ ! -s $TEST_LOG ]]

# An unrelated HTTP 200 and a stale revision must not pass public verification.
cat > "$work/bin/curl" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
output='' headers=''
while [[ $# -gt 0 ]]; do
  case "$1" in
    --output) output=$2; shift 2 ;;
    --dump-header) headers=$2; shift 2 ;;
    *) url=$1; shift ;;
  esac
done
if [[ -n $headers ]]; then
  printf 'HTTP/1.1 200 OK\r\nCache-Control: no-cache\r\n\r\n' > "$headers"
fi
case "$url" in
  */healthz) printf '%s\n' "$TEST_HEALTH" > "$output" ;;
  */version.txt) printf '%s\n' "$TEST_REVISION" > "$output" ;;
  *) echo 'Unexpected HTTP request in failure check' >&2; exit 1 ;;
esac
printf 200
SH
chmod +x "$work/bin/curl"
export TEST_HEALTH=ok TEST_REVISION=$old_sha
expect_failure bash "$script_dir/smoke-test.sh" http://example.test "$new_sha"
grep -q 'unexpected deployed revision' "$work/output"
TEST_HEALTH='<html>unrelated app</html>'
expect_failure bash "$script_dir/smoke-test.sh" http://example.test "$new_sha"
grep -q 'unexpected health response' "$work/output"

[[ -z $(find "$work" -type d -name '.registry.*' -print) ]]
echo "Deployment regression checks passed ($count scenarios)."
