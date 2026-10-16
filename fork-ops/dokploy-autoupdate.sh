#!/usr/bin/env bash
# Deploys ghcr.io/turoyt/dokploy:prod to the local `dokploy` swarm service when its digest changes.
# Safety: DB backup first, waits for running builds, swarm auto-rollback on failed healthcheck,
# and a digest that rolled back once is never retried.
set -euo pipefail

IMAGE="${IMAGE:-ghcr.io/turoyt/dokploy:prod}"
SERVICE=dokploy
STATE_DIR="${STATE_DIR:-/var/lib/dokploy-autoupdate}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/dokploy-autoupdate}"
KEEP_BACKUPS=10

mkdir -p "$STATE_DIR" "$BACKUP_DIR"
exec 9>"$STATE_DIR/lock"
flock -n 9 || exit 0

repo="${IMAGE%:*}"
docker pull -q "$IMAGE" >/dev/null
new_digest=$(docker image inspect --format '{{range .RepoDigests}}{{println .}}{{end}}' "$IMAGE" | grep -m1 "^$repo@" | cut -d@ -f2)
current_digest=$(docker service inspect "$SERVICE" --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}' | cut -s -d@ -f2)

[ -n "$new_digest" ] || { echo "no digest for $IMAGE"; exit 1; }
[ "$new_digest" = "$current_digest" ] && exit 0
if grep -qx "$new_digest" "$STATE_DIR/failed" 2>/dev/null; then
  echo "skip $new_digest: rolled back before, push a new commit to retry"
  exit 0
fi

state=$(docker service inspect "$SERVICE" --format '{{if .UpdateStatus}}{{.UpdateStatus.State}}{{end}}')
case "$state" in updating|rollback_started) echo "service busy ($state), retry later"; exit 0 ;; esac

pg=$(docker ps -q -f name=dokploy-postgres | head -1)
[ -n "$pg" ] || { echo "dokploy-postgres container not found"; exit 1; }

# Restarting Dokploy kills in-flight builds; ignore stale "running" rows left by crashes.
running=$(docker exec -i "$pg" sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At' <<'SQL'
select count(*) from deployment
where status = 'running' and "createdAt"::timestamptz > now() - interval '2 hours';
SQL
)
if [ "$running" != "0" ]; then
  echo "$running deployment(s) running, retry later"
  exit 0
fi

backup="$BACKUP_DIR/dokploy-$(date +%Y%m%d-%H%M%S)-${current_digest:7:12}.dump"
docker exec "$pg" sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' >"$backup.tmp"
mv "$backup.tmp" "$backup"
ls -1t "$BACKUP_DIR"/*.dump | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm --
echo "backup: $backup"

echo "deploying $repo@$new_digest (was ${current_digest:-unpinned})"
# Healthcheck in the image gates the task; a failure within the monitor window rolls back.
docker service update --detach=false --quiet \
  --image "$repo@$new_digest" \
  --update-failure-action rollback \
  --update-monitor 3m \
  "$SERVICE" || true

state=$(docker service inspect "$SERVICE" --format '{{if .UpdateStatus}}{{.UpdateStatus.State}}{{end}}')
deployed=$(docker service inspect "$SERVICE" --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}' | cut -s -d@ -f2)
if [ "$deployed" = "$new_digest" ] && [ "$state" = "completed" ]; then
  echo "ok: $new_digest is live"
else
  echo "$new_digest" >>"$STATE_DIR/failed"
  echo "FAILED (state=$state), rolled back. DB backup taken before: $backup"
  exit 1
fi
