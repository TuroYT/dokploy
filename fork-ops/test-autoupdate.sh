#!/usr/bin/env bash
# Runs dokploy-autoupdate.sh against a stub `docker`: no-op, success, rollback, no retry of a bad digest.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
t=$(mktemp -d); trap 'rm -rf "$t"' EXIT
mkdir "$t/bin"
cat >"$t/bin/docker" <<'STUB'
#!/usr/bin/env bash
s=$STUB
case "$*" in
  "pull "*) ;;
  "image inspect"*) echo "ghcr.io/turoyt/dokploy@$(cat $s/remote)" ;;
  *"ContainerSpec.Image"*) echo "ghcr.io/turoyt/dokploy:prod@$(cat $s/live)" ;;
  *"UpdateStatus"*) cat $s/status 2>/dev/null || true ;;
  "ps "*) echo pgid ;;
  "exec -i "*) cat >/dev/null; cat $s/running ;;
  "exec "*) echo dumpdata ;;
  "service update"*) img=$(echo "$*" | sed 's/.*--image \([^ ]*\).*/\1/'); echo "$img" >>$s/updates
     if [ -f $s/break ]; then echo rollback_completed >$s/status; exit 1; fi
     echo "$img" | cut -d@ -f2 >$s/live; echo completed >$s/status ;;
esac
STUB
chmod +x "$t/bin/docker"
export STUB=$t PATH="$t/bin:$PATH" STATE_DIR=$t/state BACKUP_DIR=$t/bk
run() { "$here/dokploy-autoupdate.sh" >"$t/out" 2>&1 || true; }
updates() { cat "$t/updates" 2>/dev/null | wc -l; }

echo sha256:aaa >$t/live; echo sha256:aaa >$t/remote; echo 0 >$t/running
run; [ "$(updates)" = 0 ] || { echo "FAIL: updated with same digest"; exit 1; }

echo sha256:bbb >$t/remote; echo 1 >$t/running
run; [ "$(updates)" = 0 ] || { echo "FAIL: updated during a build"; exit 1; }

echo 0 >$t/running
run; [ "$(cat $t/live)" = sha256:bbb ] && [ "$(ls $t/bk/*.dump | wc -l)" = 1 ] || { echo "FAIL: deploy"; cat $t/out; exit 1; }

echo sha256:ccc >$t/remote; touch $t/break
run; grep -qx sha256:ccc "$t/state/failed" || { echo "FAIL: rollback not recorded"; cat $t/out; exit 1; }
n=$(updates); run; [ "$(updates)" = "$n" ] || { echo "FAIL: retried a rolled-back digest"; exit 1; }

echo "all ok"
