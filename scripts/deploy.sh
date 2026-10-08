#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "Deployment error: $*" >&2
  exit 1
}

log() {
  echo "$*" >&2
}

[[ $# -ge 2 && $# -le 3 ]] || fail "usage: deploy.sh ACTION ROOT [RELEASE_ID]"
action=$1
root=$2
candidate=${3:-}
[[ $root =~ ^/[a-zA-Z0-9_./-]+$ && $root != / && $root != *'..'* ]] \
  || fail "invalid deployment root"
[[ -d $root/releases ]] || fail "deployment root must contain releases/"
[[ $action == current || $candidate =~ ^[0-9a-f]{40}-[0-9]+-[0-9]+$ ]] \
  || fail "invalid release ID"
command -v flock >/dev/null || fail "flock (util-linux) is required"
exec 9>"$root/.deploy.lock"
flock -n 9 || fail "another deployment operation holds the lock"
trap 'rm -f "$root/.state.$$"' EXIT

read_state() {
  local name=$1 value
  if [[ ! -e $root/$name ]]; then
    printf '\n'
    return
  fi
  [[ -f $root/$name && ! -L $root/$name ]] || fail "invalid $name state file"
  value=$(cat "$root/$name")
  [[ $value =~ ^[0-9a-f]{40}-[0-9]+-[0-9]+$ ]] || fail "invalid $name release ID"
  [[ -d $root/releases/$value ]] || fail "$name release is missing"
  printf '%s\n' "$value"
}

write_state() {
  printf '%s\n' "$2" > "$root/.state.$$" || return 1
  mv -f "$root/.state.$$" "$root/$1"
}

load_release() {
  local release=$1 key value
  image='' port='' revision=''
  [[ -f $root/releases/$release/.env && -f $root/releases/$release/docker-compose.prod.yml ]] \
    || fail "release files are missing: $release"
  while IFS='=' read -r key value; do
    case "$key" in
      APP_IMAGE) image=$value ;;
      APP_PORT) port=$value ;;
      APP_SHA) revision=$value ;;
      *) fail "unexpected release metadata: $key" ;;
    esac
  done < "$root/releases/$release/.env"
  [[ $image =~ ^ghcr\.io/http400/filetree-explorer@sha256:[0-9a-f]{64}$ ]] \
    || fail "release must use a digest-pinned FileTree image"
  [[ $port =~ ^[1-9][0-9]{3,4}$ && $port -ge 1024 && $port -le 65535 ]] \
    || fail "release port must be between 1024 and 65535"
  [[ $revision =~ ^[0-9a-f]{40}$ && $release == "$revision"-* ]] \
    || fail "release revision does not match its ID"
}

compose() {
  local release=$1
  shift
  load_release "$release"
  APP_IMAGE=$image APP_PORT=$port docker compose \
    --project-name filetree-explorer \
    --file "$root/releases/$release/docker-compose.prod.yml" \
    --env-file "$root/releases/$release/.env" "$@"
}

diagnostics() {
  if ! compose "$candidate" ps >&2; then log "Unable to read container status."; fi
  if ! compose "$candidate" logs --tail 60 >&2; then log "Unable to read container logs."; fi
}

rollback() {
  local current pending target
  current=$(read_state current) || return 1
  pending=$(read_state pending) || return 1
  [[ -z $pending || $pending == "$candidate" ]] \
    || fail "another candidate is pending; refusing to roll it back"
  if [[ $current == "$candidate" ]]; then
    target=$(read_state previous) || return 1
  elif [[ $pending == "$candidate" ]]; then
    target=$current
  else
    log "Candidate is not active or pending; running release is unchanged."
    return 0
  fi
  if [[ -z $target ]]; then
    if ! compose "$candidate" down; then
      log "Initial deployment cleanup failed; pending state retained."
      return 1
    fi
    rm -f "$root/pending" || return 1
    if [[ $current == "$candidate" ]]; then rm -f "$root/current" || return 1; fi
    log "No previous release exists; failed initial deployment removed. Rollback was not possible."
    return 1
  fi
  log "Restoring release $target"
  if ! compose "$target" up -d --no-build --pull never --wait --wait-timeout 90; then
    log "ROLLBACK FAILED. Release state retained for manual recovery."
    return 1
  fi
  if [[ $current == "$candidate" ]]; then
    write_state current "$target" || return 1
    rm -f "$root/previous" || return 1
  fi
  rm -f "$root/pending" || return 1
  log "Restored release $target"
}

case "$action" in
  current)
    current=$(read_state current)
    if [[ -z $current ]]; then
      echo none
    else
      load_release "$current"
      echo "$revision"
    fi
    ;;
  activate)
    pending=$(read_state pending)
    [[ -z $pending ]] || fail "a pending release needs recovery first"
    current=$(read_state current)
    [[ $current != "$candidate" ]] || fail "candidate is already current"
    compose "$candidate" config --quiet
    compose "$candidate" pull
    write_state pending "$candidate"
    if ! compose "$candidate" up -d --no-build --pull never --wait --wait-timeout 90; then
      log "Candidate failed to become healthy."
      diagnostics
      if ! rollback; then log "Automatic recovery did not restore a previous release."; fi
      exit 1
    fi
    log "Candidate is healthy; public smoke checks must pass before finalization."
    ;;
  finalize)
    current=$(read_state current)
    pending=$(read_state pending)
    if [[ $current == "$candidate" && -z $pending ]]; then
      log "Release is already finalized."
      exit 0
    fi
    [[ $pending == "$candidate" ]] || fail "candidate is not the pending release"
    if [[ $current != "$candidate" ]]; then
      if [[ -n $current ]]; then
        write_state previous "$current"
      else
        rm -f "$root/previous"
      fi
      write_state current "$candidate"
    fi
    rm -f "$root/pending"
    log "Finalized release $candidate"
    ;;
  rollback)
    rollback
    ;;
  *)
    fail "unknown action: $action"
    ;;
esac
