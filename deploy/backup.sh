#!/bin/sh
# Runs in the `backup` service: a compressed database dump now, then every 24 hours.
# Restore one with deploy/restore.sh.
set -u
KEEP_DAYS="${KEEP_DAYS:-14}"
mkdir -p /backups
while true; do
  file="/backups/aitutor-$(date -u +%Y%m%d-%H%M%S).dump"
  if pg_dump --format=custom --file="$file.partial" && mv "$file.partial" "$file"; then
    echo "backup: saved $file ($(du -h "$file" | cut -f1))"
  else
    rm -f "$file.partial"
    echo "backup: FAILED at $(date -u)" >&2
  fi
  find /backups -name 'aitutor-*.dump' -mtime +"$KEEP_DAYS" -delete
  sleep 86400
done
